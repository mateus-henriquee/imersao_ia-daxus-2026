import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parse, isValid, format } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Limiar de Confiança — Agente de E-mails" },
      { name: "description", content: "Simule o limiar de confiança ideal do agente de IA que responde e-mails de alunos." },
      { property: "og:title", content: "Limiar de Confiança — Agente de E-mails" },
      { property: "og:description", content: "Simule o limiar de confiança ideal do agente de IA que responde e-mails de alunos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAuOyO4QQcIrQrNNs4sfar_zQBHU7cyv-iH5r6g_V10aUTZSnUR356BoHHYndcYwupXFuVDqpCtJHW/pubhtml/sheet?headers=false&gid=0";

type Email = {
  data: Date | null;
  remetente: string;
  categoria: string;
  resumo: string;
  resposta: string;
  confianca: number;
};

const PRIMARY = "var(--color-primary)";
const MUTED = "var(--color-muted-foreground)";
const GRID = "var(--color-border)";

function parseSheet(html: string): Email[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows: string[][] = Array.from(doc.querySelectorAll("table tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()),
  );
  const hIdx = rows.findIndex((r) => r.includes("Data") && r.some((c) => c.startsWith("Confian")));
  if (hIdx < 0) throw new Error("Cabeçalho não encontrado na planilha");
  const h = rows[hIdx]!;
  const col = (name: string) => h.findIndex((c) => c.toLowerCase().startsWith(name));
  const [iD, iR, iC, iS, iA, iF] = ["data", "remetente", "categoria", "resumo", "resposta", "confian"].map(col) as [number, number, number, number, number, number];
  return rows
    .slice(hIdx + 1)
    .filter((r) => r[iC] && r[iF])
    .map((r) => {
      const d = parse(r[iD] ?? "", "M/d/yyyy", new Date());
      return {
        data: isValid(d) ? d : null,
        remetente: r[iR] ?? "",
        categoria: r[iC] ?? "",
        resumo: r[iS] ?? "",
        resposta: r[iA] ?? "",
        confianca: parseFloat((r[iF] ?? "").replace(",", ".")),
      };
    })
    .filter((e) => !Number.isNaN(e.confianca));
}

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const label = (c: string) => c.replace(/_/g, " ");

function Dashboard() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limiar, setLimiar] = useState(7);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SHEET_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setEmails(parseSheet(await res.text()));
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const total = emails.length;
    const auto = emails.filter((e) => e.confianca >= limiar);
    const media = total ? emails.reduce((s, e) => s + e.confianca, 0) / total : 0;
    const mediaAuto = auto.length ? auto.reduce((s, e) => s + e.confianca, 0) / auto.length : 0;
    return { total, auto: auto.length, pct: total ? (auto.length / total) * 100 : 0, media, mediaAuto };
  }, [emails, limiar]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, { total: number; auto: number; soma: number }>();
    for (const e of emails) {
      const v = m.get(e.categoria) ?? { total: 0, auto: 0, soma: 0 };
      v.total++; v.soma += e.confianca; if (e.confianca >= limiar) v.auto++;
      m.set(e.categoria, v);
    }
    return Array.from(m, ([categoria, v]) => ({
      categoria: label(categoria),
      total: v.total,
      pctAuto: (v.auto / v.total) * 100,
      media: v.soma / v.total,
    })).sort((a, b) => b.total - a.total);
  }, [emails, limiar]);

  const distribuicao = useMemo(() => {
    const bins = Array.from({ length: 20 }, (_, i) => ({ faixa: i * 0.5, qtd: 0 }));
    for (const e of emails) bins[Math.min(19, Math.max(0, Math.floor(e.confianca / 0.5)))]!.qtd++;
    return bins;
  }, [emails]);

  const tooltipStyle = {
    contentStyle: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 },
    labelStyle: { color: "var(--color-foreground)" },
    itemStyle: { color: "var(--color-foreground)" },
    cursor: { fill: "var(--color-primary-soft)" },
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Limiar de confiança do agente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            E-mails de alunos respondidos por IA
            {updatedAt && ` · atualizado às ${format(updatedAt, "HH:mm:ss")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Carregando..." : "Atualizar"}
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-primary-soft"
          >
            Sair
          </button>
        </div>
      </header>

      {error && <p className="mb-6 text-sm text-destructive">Erro ao carregar: {error}</p>}

      {loading && emails.length === 0 ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Kpi titulo="Total de e-mails" valor={kpis.total.toLocaleString("pt-BR")} sub={`${kpis.auto} acima do limiar`} />
            <Kpi titulo="% automatizável" valor={`${fmt(kpis.pct)}%`} sub={`confiança ≥ ${fmt(limiar)}`} destaque />
            <Kpi titulo="Confiança média" valor={fmt(kpis.media, 2)} sub={`${fmt(kpis.mediaAuto, 2)} entre os automatizados`} />
          </section>

          <section className="mt-6 rounded-xl border bg-surface p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">Simulador de limiar</h2>
              <span className="text-3xl font-semibold text-primary">{fmt(limiar)}</span>
            </div>
            <input
              type="range" min={0} max={10} step={0.5} value={limiar}
              onChange={(e) => setLimiar(Number(e.target.value))}
              className="mt-4 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0</span><span>5</span><span>10</span>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card titulo="E-mails por categoria" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porCategoria} margin={{ bottom: 40 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="categoria" tick={{ fill: MUTED, fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "E-mails"]} />
                  <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card titulo="Distribuição de confiança" sub="Barras à direita da linha seriam automatizadas">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distribuicao}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v: number) => `${fmt(v)} – ${fmt(v + 0.5)}`} formatter={(v: number) => [v, "E-mails"]} />
                  <ReferenceLine x={limiar} stroke="var(--color-foreground)" strokeDasharray="4 4" />
                  <Bar dataKey="qtd" radius={[3, 3, 0, 0]}>
                    {distribuicao.map((b) => (
                      <Cell key={b.faixa} fill={b.faixa >= limiar ? PRIMARY : "var(--color-border)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card titulo="% automatizável por categoria" sub={`No limiar ${fmt(limiar)}`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porCategoria} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: MUTED, fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="categoria" tick={{ fill: MUTED, fontSize: 11 }} width={130} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmt(v)}%`, "Automatizável"]} />
                  <Bar dataKey="pctAuto" fill={PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </section>
        </>
      )}
    </main>
  );
}

function Kpi({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface p-5 ${destaque ? "border-primary" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className={`mt-2 text-3xl font-semibold ${destaque ? "text-primary" : ""}`}>{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Card({ titulo, sub, className = "", children }: { titulo: string; sub?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border bg-surface p-5 ${className}`}>
      <h3 className="text-sm font-medium">{titulo}</h3>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
