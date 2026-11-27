import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, GraduationCap, Info, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getVerifiedUserRoleFn } from "@/lib/help.functions";
import { validateSelectedLoginRole } from "@/lib/login-role";
import type { AppRole } from "@/lib/help.types";
import helpLogo from "@/assets/help-logo.png";

function sanitizeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/portal";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/portal";
  return raw;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeNextPath(search["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Login — Help! Portal de Gestão" },
      {
        name: "description",
        content: "Acesse sua conta cadastrada no portal Help! com e-mail e senha.",
      },
      { property: "og:title", content: "Login — Help!" },
      { property: "og:description", content: "Acesso ao portal de gestão de ativos e chamados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function GoogleGLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: nextPath } = Route.useSearch();
  const getVerifiedUserRole = useServerFn(getVerifiedUserRoleFn);

  const [selectedRole, setSelectedRole] = useState<AppRole>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        void navigate({ href: nextPath, replace: true });
      }
    });
  }, [navigate, nextPath]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      toast.error("Informe seu e-mail e sua senha.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Confirme seu e-mail pelo link enviado antes de entrar.");
        } else {
          toast.error(
            "E-mail ou senha inválidos. Confira os dados da sua conta cadastrada e tente novamente.",
          );
        }
        return;
      }

      const { role: verifiedRole } = await getVerifiedUserRole();
      const roleCheck = validateSelectedLoginRole(selectedRole, verifiedRole);
      if (!roleCheck.ok) {
        await supabase.auth.signOut();
        toast.error(roleCheck.message);
        return;
      }

      toast.success(
        verifiedRole === "admin" ? "Acesso administrativo liberado!" : "Acesso liberado!",
      );
      void navigate({ href: nextPath, replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Link de redefinição enviado. Verifique sua caixa de entrada.");
      setForgotMode(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialAuth(provider: "google") {
    setBusy(true);
    try {
      sessionStorage.setItem("help_auth_next", nextPath);
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error("Não foi possível concluir o login social. Tente novamente.");
        return;
      }
      if (result.redirected) return;
      void navigate({ href: nextPath, replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas-surface text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <img
              src={helpLogo}
              alt="Help!"
              className="h-9 w-auto object-contain dark:brightness-125"
            />
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground">
              PORTAL
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar ao início
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:py-16">
        <div className="space-y-6 lg:col-span-5">
          <p className="text-xs font-extrabold tracking-[0.14em] text-brand-teal uppercase">
            Acesso ao Portal Help!
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Acesse seu espaço de gestão
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Entre com sua conta institucional para consultar o catálogo de ativos, abrir e
            acompanhar chamados técnicos ou acessar a visão administrativa.
          </p>

          <div className="rounded-2xl border border-border bg-card p-5 help-card-shadow">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal">
                <Info className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">
                  Acesso exclusivo para contas cadastradas
                </p>
                <p>
                  Use o e-mail e a senha da sua conta. O sistema confirma suas credenciais e libera
                  somente o perfil e os laboratórios vinculados ao seu cadastro.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8 help-card-shadow">
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal-soft text-brand-teal">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Escolha o tipo de acesso</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione Funcionário / Professor ou Administrador para entrar com seu cadastro.
                </p>
              </div>
            </div>

            {forgotMode ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <KeyRound className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                  Recuperar senha
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">E-mail cadastrado</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@instituicao.com"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" variant="hero" disabled={busy} className="flex-1">
                    {busy ? "Enviando..." : "Enviar link de redefinição"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForgotMode(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Dedicated profile switcher with explicit Admin button */}
                <div
                  role="tablist"
                  aria-label="Tipo de conta"
                  className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-canvas-surface p-1.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedRole === "user"}
                    onClick={() => setSelectedRole("user")}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all cursor-pointer sm:text-sm ${
                      selectedRole === "user"
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                    Funcionário / Professor
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedRole === "admin"}
                    onClick={() => setSelectedRole("admin")}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all cursor-pointer sm:text-sm ${
                      selectedRole === "admin"
                        ? "bg-navy text-navy-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Administrador
                  </button>
                </div>

                <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email">
                      {selectedRole === "admin" ? "E-mail do administrador" : "E-mail do professor"}
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                    />
                  </div>
                  {selectedRole === "admin" ? (
                    <p className="rounded-xl border border-border bg-canvas-surface px-3.5 py-2.5 text-xs text-muted-foreground">
                      Este perfil apresenta o painel geral de todos os laboratórios, usuários,
                      relatórios e chamados.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      O laboratório e a sala são carregados automaticamente conforme o perfil
                      cadastrado no banco de dados.
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant={selectedRole === "admin" ? "navy" : "hero"}
                    size="xl"
                    disabled={busy}
                    className="w-full"
                  >
                    {busy
                      ? "Entrando..."
                      : selectedRole === "admin"
                        ? "Entrar como administrador"
                        : "Entrar como professor"}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 font-semibold text-muted-foreground">
                      Ou continue com
                    </span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleSocialAuth("google")}
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#747775",
                      color: "#1F1F1F",
                    }}
                    className="h-11 gap-2.5 px-3 text-sm font-medium hover:opacity-95"
                  >
                    <GoogleGLogo />
                    Continuar com Google
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
