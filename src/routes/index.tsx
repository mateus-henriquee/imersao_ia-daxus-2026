import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
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
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth" });
  },
});
