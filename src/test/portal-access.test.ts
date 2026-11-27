import { describe, expect, it } from "vitest";
import { validateRegisteredPortalAccess } from "@/lib/portal-access";

describe("validateRegisteredPortalAccess", () => {
  it("allows the registered Rafael account when it is active", () => {
    expect(
      validateRegisteredPortalAccess({ email: "rafael.conceicao@gmail.com", active: true }),
    ).toEqual({ ok: true });
  });

  it("blocks an authenticated account without a registered profile", () => {
    expect(validateRegisteredPortalAccess(null)).toEqual({
      ok: false,
      message: "Esta conta não possui um cadastro autorizado no Help!. Procure a administração.",
    });
  });

  it("blocks the registered Lucas account when access is deactivated", () => {
    expect(
      validateRegisteredPortalAccess({ email: "lucas.oliveira@gmail.com", active: false }),
    ).toEqual({
      ok: false,
      message: "Seu acesso está desativado. Procure a administração.",
    });
  });
});
