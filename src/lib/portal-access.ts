export type PortalAccessProfile = {
  email: string;
  active: boolean;
};

export type PortalAccessResult = { ok: true } | { ok: false; message: string };

export function validateRegisteredPortalAccess(
  profile: PortalAccessProfile | null | undefined,
): PortalAccessResult {
  if (!profile?.email) {
    return {
      ok: false,
      message: "Esta conta não possui um cadastro autorizado no Help!. Procure a administração.",
    };
  }

  if (!profile.active) {
    return {
      ok: false,
      message: "Seu acesso está desativado. Procure a administração.",
    };
  }

  return { ok: true };
}

export function assertRegisteredPortalAccess(
  profile: PortalAccessProfile | null | undefined,
): asserts profile is PortalAccessProfile {
  const result = validateRegisteredPortalAccess(profile);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
