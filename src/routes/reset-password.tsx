import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import helpLogo from "@/assets/help-logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Help!" },
      { name: "description", content: "Defina uma nova senha para acessar o portal Help!." },
      { property: "og:title", content: "Redefinir senha — Help!" },
      { property: "og:description", content: "Defina uma nova senha para sua conta Help!." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Senha atualizada com sucesso!");
      void navigate({ to: "/portal", replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 help-card-shadow">
        <Link to="/" className="mb-6 inline-block">
          <img src={helpLogo} alt="Help!" className="h-8 w-auto object-contain dark:brightness-125" />
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">Definir nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma nova senha para continuar usando o portal Help!.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Nova senha</Label>
            <Input
              id="new-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
            <Input
              id="confirm-pass"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="hero" size="xl" disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Atualizar senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}