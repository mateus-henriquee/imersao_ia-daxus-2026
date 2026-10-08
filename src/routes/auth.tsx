import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Limiar de Confiança" },
      { name: "description", content: "Entre ou crie sua conta para acessar o dashboard do agente de e-mails." },
      { property: "og:title", content: "Entrar — Limiar de Confiança" },
      { property: "og:description", content: "Entre ou crie sua conta para acessar o dashboard do agente de e-mails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(null); setAviso(null);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password: senha, options: { emailRedirectTo: window.location.origin },
      });
      if (error) setErro(error.message);
      else if (!data.session) setAviso("Conta criada! Confirme pelo link enviado ao seu e-mail para entrar.");
    }
    setLoading(false);
  }

  async function google() {
    setErro(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setErro("Não foi possível entrar com Google.");
  }

  const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-surface p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {modo === "entrar" ? "Entrar no dashboard" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Limiar de confiança do agente</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <input type="password" required minLength={6} placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} className={input} />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {aviso && <p className="text-sm text-primary">{aviso}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50">
            {loading ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button onClick={google} className="mt-3 w-full rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-primary-soft">
          Continuar com Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {modo === "entrar" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button type="button" onClick={() => { setModo(modo === "entrar" ? "criar" : "entrar"); setErro(null); setAviso(null); }} className="font-medium text-primary hover:underline">
            {modo === "entrar" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
