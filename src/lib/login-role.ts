import type { AppRole } from "./help.types";

export function validateSelectedLoginRole(
  selectedRole: AppRole,
  verifiedRole: AppRole,
): { ok: true } | { ok: false; message: string } {
  if (selectedRole === "admin" && verifiedRole !== "admin") {
    return {
      ok: false,
      message:
        "Esta conta não tem permissão de administrador. Selecione Funcionário / Professor para entrar.",
    };
  }
  if (selectedRole === "user" && verifiedRole === "admin") {
    return {
      ok: false,
      message: "Esta conta é de administrador. Clique no botão Administrador para entrar.",
    };
  }
  return { ok: true };
}