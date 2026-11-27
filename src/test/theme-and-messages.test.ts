import { describe, expect, it } from "vitest";
import { resolveInitialTheme } from "@/lib/theme";
import { buildConversationSummaries, groupMessagesByDay } from "@/lib/messages-utils";
import type { HelpDirectMessage, HelpProfile } from "@/lib/help.types";

const adminProfile: HelpProfile = {
  id: "admin-1",
  auth_user_id: "auth-admin",
  name: "Guilherme Admin",
  email: "admin@help.local",
  role: "admin",
  department: "TI",
  room: null,
  lab_id: null,
  avatar_path: null,
  active: true,
};

const profAna: HelpProfile = {
  id: "prof-ana",
  auth_user_id: "auth-ana",
  name: "Ana Costa",
  email: "ana@help.local",
  role: "user",
  department: "Informática",
  room: "102",
  lab_id: "lab-1",
  avatar_path: null,
  active: true,
};

const profBruno: HelpProfile = {
  id: "prof-bruno",
  auth_user_id: "auth-bruno",
  name: "Bruno Lima",
  email: "bruno@help.local",
  role: "user",
  department: "Mecânica",
  room: "205",
  lab_id: "lab-2",
  avatar_path: null,
  active: true,
};

const sampleMessages: HelpDirectMessage[] = [
  {
    id: "m1",
    profile_id: "prof-bruno",
    sender_profile_id: "prof-bruno",
    sender_name: "Bruno Lima",
    message: "Torno precisa de ajuste",
    attachment_name: null,
    attachment_path: null,
    attachment_type: null,
    created_at: "2026-11-26T15:00:00Z",
  },
  {
    id: "m2",
    profile_id: "prof-bruno",
    sender_profile_id: "admin-1",
    sender_name: "Guilherme Admin",
    message: "Agendado para hoje",
    attachment_name: null,
    attachment_path: null,
    attachment_type: null,
    created_at: "2026-11-27T11:30:00Z",
  },
];

describe("Theme resolution", () => {
  it("respects explicit stored light or dark preference over system preference", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("falls back to system preference when storage is empty or invalid", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme("invalid", false)).toBe("light");
  });
});

describe("Direct messages structuring", () => {
  it("sorts conversations with recent messages ahead of empty threads and filters active ones", () => {
    const all = buildConversationSummaries({
      role: "admin",
      currentProfile: adminProfile,
      profiles: [adminProfile, profAna, profBruno],
      directMessages: sampleMessages,
      search: "",
    });
    expect(all.map((c) => c.threadId)).toEqual(["prof-bruno", "prof-ana"]);
    expect(all[0]?.messageCount).toBe(2);

    const onlyActive = buildConversationSummaries({
      role: "admin",
      currentProfile: adminProfile,
      profiles: [adminProfile, profAna, profBruno],
      directMessages: sampleMessages,
      search: "",
      onlyWithMessages: true,
    });
    expect(onlyActive.map((c) => c.threadId)).toEqual(["prof-bruno"]);
  });

  it("filters admin conversations by room number or message text", () => {
    const byRoom = buildConversationSummaries({
      role: "admin",
      currentProfile: adminProfile,
      profiles: [adminProfile, profAna, profBruno],
      directMessages: sampleMessages,
      search: "102",
    });
    expect(byRoom.map((c) => c.threadId)).toEqual(["prof-ana"]);

    const byText = buildConversationSummaries({
      role: "admin",
      currentProfile: adminProfile,
      profiles: [adminProfile, profAna, profBruno],
      directMessages: sampleMessages,
      search: "agendado",
    });
    expect(byText.map((c) => c.threadId)).toEqual(["prof-bruno"]);
  });

  it("groups messages by calendar day with Hoje and Ontem labels", () => {
    const now = new Date("2026-11-27T14:00:00Z");
    const groups = groupMessagesByDay(sampleMessages, now);
    expect(groups.map((g) => g.label)).toEqual(["Ontem", "Hoje"]);
    expect(groups[0]?.messages.map((m) => m.id)).toEqual(["m1"]);
    expect(groups[1]?.messages.map((m) => m.id)).toEqual(["m2"]);
  });
});