import { describe, expect, it } from "vitest";
import { validateSelectedLoginRole } from "@/lib/login-role";

describe("validateSelectedLoginRole", () => {
  it("allows an admin account when Administrador is selected", () => {
    expect(validateSelectedLoginRole("admin", "admin")).toEqual({ ok: true });
  });

  it("blocks a non-admin account when Administrador is selected", () => {
    const result = validateSelectedLoginRole("admin", "user");
    expect(result.ok).toBe(false);
  });

  it("allows a professor account when Funcionário / Professor is selected", () => {
    expect(validateSelectedLoginRole("user", "user")).toEqual({ ok: true });
  });

  it("directs an admin account to the Administrador button when professor is selected", () => {
    const result = validateSelectedLoginRole("user", "admin");
    expect(result.ok).toBe(false);
  });
});