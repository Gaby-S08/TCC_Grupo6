import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRegisteredPortalAccess } from "./portal-access";
import type {
  AppRole,
  HelpAsset,
  HelpDirectMessage,
  HelpLaboratory,
  HelpNotification,
  HelpProfile,
  HelpTicket,
  HelpTicketMessage,
  PortalBootstrapData,
} from "./help.types";

const BUCKET = "help-attachments";

export const getPortalBootstrapFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalBootstrapData> => {
    const { supabase, userId } = context;

    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    let role: AppRole = isAdminData ? "admin" : "user";

    // Check current user's profile; if missing (e.g. OAuth first login before trigger), claim or create safely
    let { data: ownProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!ownProfile) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUserResult } = await supabaseAdmin.auth.admin.getUserById(userId);
      const authUser = authUserResult.user;
      const verifiedEmail = authUser?.email?.trim().toLowerCase() ?? "";
      const isEmailVerified = Boolean(authUser?.email_confirmed_at);

      if (verifiedEmail && isEmailVerified) {
        const { data: preProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("email", verifiedEmail)
          .is("auth_user_id", null)
          .maybeSingle();

        if (preProfile) {
          await supabaseAdmin
            .from("profiles")
            .update({ auth_user_id: userId })
            .eq("id", preProfile.id);

          const { data: preRole } = await supabaseAdmin
            .from("pre_registered_roles")
            .select("role")
            .eq("email", verifiedEmail)
            .maybeSingle();

          const assignedRole: AppRole = preRole?.role === "admin" ? "admin" : "user";
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: assignedRole }, { onConflict: "user_id,role" });
          role = assignedRole;
          ownProfile = { ...preProfile, auth_user_id: userId };
        }
      }
    }

    assertRegisteredPortalAccess(ownProfile);

    const [
      profilesRes,
      labsRes,
      assetsRes,
      ticketsRes,
      ticketMessagesRes,
      directMessagesRes,
      notificationsRes,
      rolesRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("name", { ascending: true }),
      supabase.from("laboratories").select("*").order("name", { ascending: true }),
      supabase.from("assets").select("*").order("code", { ascending: true }),
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("ticket_messages").select("*").order("created_at", { ascending: true }),
      supabase.from("direct_messages").select("*").order("created_at", { ascending: true }),
      supabase
        .from("notifications")
        .select("*")
        .eq("recipient_profile_id", ownProfile.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const roleByAuthId = new Map<string, AppRole>();
    for (const row of rolesRes.data ?? []) {
      if (row.role === "admin") {
        roleByAuthId.set(row.user_id, "admin");
      } else if (!roleByAuthId.has(row.user_id)) {
        roleByAuthId.set(row.user_id, "user");
      }
    }

    // Collect storage paths for signed URLs
    const paths = new Set<string>();
    for (const p of profilesRes.data ?? []) {
      if (p.avatar_path) paths.add(p.avatar_path);
    }
    for (const t of ticketsRes.data ?? []) {
      if (t.photo_path) paths.add(t.photo_path);
    }
    for (const dm of directMessagesRes.data ?? []) {
      if (dm.attachment_path) paths.add(dm.attachment_path);
    }

    const signedUrlMap = new Map<string, string>();
    if (paths.size > 0) {
      const { data: signedList } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(Array.from(paths), 3600);
      for (const item of signedList ?? []) {
        if (item.path && item.signedUrl) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      }
    }

    const profiles: HelpProfile[] = (profilesRes.data ?? []).map((p) => {
      const computedRole: AppRole =
        (p.auth_user_id ? roleByAuthId.get(p.auth_user_id) : undefined) ??
        (p.id === "admin-guilherme" ? "admin" : "user");
      return {
        id: p.id,
        auth_user_id: p.auth_user_id,
        name: p.name,
        email: p.email,
        role: computedRole,
        department: p.department,
        room: p.room,
        lab_id: p.lab_id,
        avatar_path: p.avatar_path,
        avatar_url: p.avatar_path ? (signedUrlMap.get(p.avatar_path) ?? null) : null,
        active: p.active,
      };
    });

    const currentProfile: HelpProfile = profiles.find((p) => p.id === ownProfile.id) ?? {
      id: ownProfile.id,
      auth_user_id: ownProfile.auth_user_id,
      name: ownProfile.name,
      email: ownProfile.email,
      role,
      department: ownProfile.department,
      room: ownProfile.room,
      lab_id: ownProfile.lab_id,
      avatar_path: ownProfile.avatar_path,
      avatar_url: ownProfile.avatar_path
        ? (signedUrlMap.get(ownProfile.avatar_path) ?? null)
        : null,
      active: ownProfile.active,
    };

    const messagesByTicket = new Map<string, HelpTicketMessage[]>();
    for (const msg of ticketMessagesRes.data ?? []) {
      const list = messagesByTicket.get(msg.ticket_id) ?? [];
      list.push({
        id: msg.id,
        ticket_id: msg.ticket_id,
        author_profile_id: msg.author_profile_id,
        sender_name: msg.sender_name,
        sender_role: msg.sender_role,
        message: msg.message,
        created_at: msg.created_at,
      });
      messagesByTicket.set(msg.ticket_id, list);
    }

    const laboratories: HelpLaboratory[] = (labsRes.data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      room: l.room,
      department: l.department,
      responsible_profile_id: l.responsible_profile_id,
      active: l.active,
    }));

    const assets: HelpAsset[] = (assetsRes.data ?? []).map((a) => ({
      id: a.id,
      code: a.code,
      laboratory_id: a.laboratory_id,
      name: a.name,
      description: a.description,
      quantity: a.quantity,
      status: a.status,
    }));

    const tickets: HelpTicket[] = (ticketsRes.data ?? []).map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      requester_profile_id: t.requester_profile_id,
      laboratory_id: t.laboratory_id,
      asset_id: t.asset_id,
      department: t.department,
      lab_name: t.lab_name,
      asset_name: t.asset_name,
      serial: t.serial,
      requester_name: t.requester_name,
      request_type: t.request_type,
      description: t.description,
      photo_path: t.photo_path,
      photo_url: t.photo_path ? (signedUrlMap.get(t.photo_path) ?? null) : null,
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
      resolved_at: t.resolved_at,
      messages: messagesByTicket.get(t.id) ?? [],
    }));

    const directMessages: HelpDirectMessage[] = (directMessagesRes.data ?? []).map((dm) => ({
      id: dm.id,
      profile_id: dm.profile_id,
      sender_profile_id: dm.sender_profile_id,
      sender_name: dm.sender_name,
      message: dm.message,
      attachment_name: dm.attachment_name,
      attachment_path: dm.attachment_path,
      attachment_url: dm.attachment_path ? (signedUrlMap.get(dm.attachment_path) ?? null) : null,
      attachment_type: dm.attachment_type,
      created_at: dm.created_at,
    }));

    const notifications: HelpNotification[] = (notificationsRes.data ?? []).map((n) => ({
      id: n.id,
      recipient_profile_id: n.recipient_profile_id,
      type: n.type,
      reference_id: n.reference_id,
      text: n.text,
      read: n.read,
      created_at: n.created_at,
    }));

    return {
      currentProfile,
      role,
      profiles,
      laboratories,
      assets,
      tickets,
      directMessages,
      notifications,
    };
  });

const createProfessorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  department: z.string().trim().min(2).max(100),
  labId: z.string().trim().min(1).max(64),
  initialPassword: z.string().trim().max(128).optional(),
});

export const adminCreateProfessorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof createProfessorSchema>) =>
    createProfessorSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem cadastrar professores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedEmail = data.email.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing) {
      throw new Error("Já existe um cadastro com este e-mail.");
    }

    const { data: lab } = await supabaseAdmin
      .from("laboratories")
      .select("id, room, department")
      .eq("id", data.labId)
      .maybeSingle();

    const slug = normalizedEmail
      .split("@")[0]!
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28);
    const profileId = `prof-${slug || "docente"}-${Date.now().toString(36).slice(-4)}`;

    const { error: insertError } = await supabaseAdmin.from("profiles").insert({
      id: profileId,
      name: data.name,
      email: normalizedEmail,
      department: lab?.department ?? data.department,
      room: lab?.room ?? null,
      lab_id: lab?.id ?? data.labId,
      active: true,
    });
    if (insertError) throw new Error(insertError.message);

    await supabaseAdmin.from("pre_registered_roles").upsert(
      {
        email: normalizedEmail,
        role: "user",
        profile_id: profileId,
      },
      { onConflict: "email" },
    );

    if (lab) {
      await supabaseAdmin
        .from("laboratories")
        .update({ responsible_profile_id: profileId })
        .eq("id", lab.id);
    }

    let immediateAccess = false;
    if (data.initialPassword && data.initialPassword.length > 0) {
      if (data.initialPassword.length < 6) {
        await supabaseAdmin.from("profiles").delete().eq("id", profileId);
        throw new Error("A senha inicial deve ter pelo menos 6 caracteres.");
      }
      const { error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: data.initialPassword,
        email_confirm: true,
        user_metadata: { full_name: data.name },
      });
      if (authError) {
        await supabaseAdmin.from("profiles").delete().eq("id", profileId);
        const msg = authError.message.toLowerCase().includes("weak")
          ? "A senha escolhida é muito fraca. Combine letras, números e um símbolo (ex.: HelpLab!2026)."
          : authError.message;
        throw new Error(msg);
      }
      immediateAccess = true;
    }

    return { ok: true, profileId, immediateAccess };
  });

const manageProfessorSchema = z.object({
  profileId: z.string().trim().min(1).max(120),
  action: z.enum(["toggle", "delete"]),
});

export const adminManageProfessorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof manageProfessorSchema>) =>
    manageProfessorSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem gerenciar professores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, email, active")
      .eq("id", data.profileId)
      .maybeSingle();

    if (!target) throw new Error("Cadastro não encontrado.");
    if (target.auth_user_id === context.userId || target.id === "admin-guilherme") {
      throw new Error("Não é possível remover ou desativar uma conta administrativa.");
    }
    if (target.auth_user_id) {
      const { data: targetIsAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: target.auth_user_id,
        _role: "admin",
      });
      if (targetIsAdmin) throw new Error("Não é possível alterar outro administrador aqui.");
    }

    if (data.action === "toggle") {
      const nextActive = !target.active;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ active: nextActive })
        .eq("id", target.id);
      if (error) throw new Error(error.message);
      return { ok: true, mode: nextActive ? "activated" : "deactivated" };
    }

    const [ticketsRes, ticketMsgsRes, directMsgsRes] = await Promise.all([
      supabaseAdmin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("requester_profile_id", target.id),
      supabaseAdmin
        .from("ticket_messages")
        .select("id", { count: "exact", head: true })
        .eq("author_profile_id", target.id),
      supabaseAdmin
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_profile_id", target.id),
    ]);
    const hasHistory =
      (ticketsRes.count ?? 0) > 0 ||
      (ticketMsgsRes.count ?? 0) > 0 ||
      (directMsgsRes.count ?? 0) > 0;

    await supabaseAdmin
      .from("laboratories")
      .update({ responsible_profile_id: null })
      .eq("responsible_profile_id", target.id);

    if (hasHistory) {
      await supabaseAdmin
        .from("profiles")
        .update({ active: false, lab_id: null, room: null })
        .eq("id", target.id);
      return { ok: true, mode: "deactivated_history" };
    }

    await supabaseAdmin.from("pre_registered_roles").delete().eq("profile_id", target.id);
    const { error: delErr } = await supabaseAdmin.from("profiles").delete().eq("id", target.id);
    if (delErr) throw new Error(delErr.message);
    if (target.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(target.auth_user_id);
    }
    return { ok: true, mode: "deleted" };
  });

const notifyAdminsSchema = z.object({
  type: z.string().trim().min(1).max(60),
  referenceId: z.string().trim().max(80).optional(),
  text: z.string().trim().min(1).max(400),
});

export const notifyAdminsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof notifyAdminsSchema>) => notifyAdminsSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminAuthIds = (adminRoles ?? []).map((r) => r.user_id);
    const recipientIds = new Set<string>(["admin-guilherme"]);

    if (adminAuthIds.length > 0) {
      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("auth_user_id", adminAuthIds);
      for (const p of adminProfiles ?? []) {
        recipientIds.add(p.id);
      }
    }

    const rows = Array.from(recipientIds).map((recipientId) => ({
      recipient_profile_id: recipientId,
      type: data.type,
      reference_id: data.referenceId ?? null,
      text: data.text,
      read: false,
    }));

    if (rows.length > 0) {
      await supabaseAdmin.from("notifications").insert(rows);
    }
    return { ok: true };
  });

export const getVerifiedUserRoleFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: AppRole; email: string | null }> => {
    const { supabase, userId } = context;

    const { data: isAdminData } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (isAdminData) {
      return { role: "admin", email: null };
    }

    // Check if this verified user has an unclaimed pre-registered profile (e.g. first login right after confirmation)
    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!ownProfile) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUserResult } = await supabaseAdmin.auth.admin.getUserById(userId);
      const authUser = authUserResult.user;
      const verifiedEmail = authUser?.email?.trim().toLowerCase() ?? "";
      if (verifiedEmail && authUser?.email_confirmed_at) {
        const { data: preRole } = await supabaseAdmin
          .from("pre_registered_roles")
          .select("role")
          .eq("email", verifiedEmail)
          .maybeSingle();
        if (preRole?.role === "admin") {
          return { role: "admin", email: verifiedEmail };
        }
      }
    }

    return { role: "user", email: ownProfile?.email ?? null };
  });
