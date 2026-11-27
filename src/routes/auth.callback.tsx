import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Concluindo acesso — Help!" },
      { name: "description", content: "Validando sua autenticação no portal Help!." },
      { property: "og:title", content: "Concluindo acesso — Help!" },
      { property: "og:description", content: "Validando sua autenticação no portal Help!." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const rawNext = sessionStorage.getItem("help_auth_next") ?? "/portal";
    const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/portal";

    const goNext = () => {
      sessionStorage.removeItem("help_auth_next");
      void navigate({ to: safeNext, replace: true });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        goNext();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        goNext();
      }
    });

    const fallbackTimer = window.setTimeout(() => {
      if (!active) return;
      void supabase.auth.getUser().then(({ data }) => {
        if (!active) return;
        if (data.user) {
          goNext();
        } else {
          void navigate({ to: "/login", search: { redirect: "/portal" }, replace: true });
        }
      });
    }, 3500);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-surface px-4">
      <div className="rounded-2xl border border-border bg-card px-8 py-6 text-center help-card-shadow">
        <p className="text-sm font-bold text-foreground">Confirmando sua autenticação...</p>
        <p className="mt-1 text-xs text-muted-foreground">Você será redirecionado ao portal.</p>
      </div>
    </div>
  );
}