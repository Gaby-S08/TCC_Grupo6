import type { AppRole, HelpDirectMessage, HelpProfile } from "@/lib/help.types";

export interface ConversationSummary {
  threadId: string;
  contact: HelpProfile;
  messageCount: number;
  lastMessage: HelpDirectMessage | null;
  lastMessageAt: number;
}

export interface MessageDayGroup {
  dayKey: string;
  label: string;
  messages: HelpDirectMessage[];
}

const FALLBACK_ADMIN_PROFILE: HelpProfile = {
  id: "admin-guilherme",
  auth_user_id: null,
  name: "Administração Help!",
  email: "administracao@help.local",
  role: "admin",
  department: "Administração",
  room: null,
  lab_id: null,
  avatar_path: null,
  active: true,
};

export function buildConversationSummaries({
  role,
  currentProfile,
  profiles,
  directMessages,
  search,
  onlyWithMessages = false,
}: {
  role: AppRole;
  currentProfile: HelpProfile;
  profiles: HelpProfile[];
  directMessages: HelpDirectMessage[];
  search: string;
  onlyWithMessages?: boolean;
}): ConversationSummary[] {
  const byThread = new Map<string, HelpDirectMessage[]>();
  for (const msg of directMessages) {
    const list = byThread.get(msg.profile_id);
    if (list) list.push(msg);
    else byThread.set(msg.profile_id, [msg]);
  }

  if (role !== "admin") {
    const adminContact = profiles.find((p) => p.role === "admin") ?? FALLBACK_ADMIN_PROFILE;
    const msgs = byThread.get(currentProfile.id) ?? [];
    const lastMessage = msgs.at(-1) ?? null;
    return [
      {
        threadId: currentProfile.id,
        contact: adminContact,
        messageCount: msgs.length,
        lastMessage,
        lastMessageAt: lastMessage ? new Date(lastMessage.created_at).getTime() : 0,
      },
    ];
  }

  const query = search.trim().toLowerCase();
  return profiles
    .filter((p) => p.role !== "admin")
    .map((contact): ConversationSummary => {
      const msgs = byThread.get(contact.id) ?? [];
      const lastMessage = msgs.at(-1) ?? null;
      return {
        threadId: contact.id,
        contact,
        messageCount: msgs.length,
        lastMessage,
        lastMessageAt: lastMessage ? new Date(lastMessage.created_at).getTime() : 0,
      };
    })
    .filter((item) => (!onlyWithMessages ? true : item.messageCount > 0))
    .filter((item) => {
      if (!query) return true;
      const { contact, lastMessage } = item;
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        (contact.room ?? "").toLowerCase().includes(query) ||
        (contact.department ?? "").toLowerCase().includes(query) ||
        (lastMessage?.message ?? "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (a.lastMessageAt !== b.lastMessageAt) return b.lastMessageAt - a.lastMessageAt;
      return a.contact.name.localeCompare(b.contact.name, "pt-BR");
    });
}

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const todayKey = toLocalDayKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = toLocalDayKey(yesterday);
  const key = toLocalDayKey(date);

  if (key === todayKey) return "Hoje";
  if (key === yesterdayKey) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function groupMessagesByDay(
  messages: HelpDirectMessage[],
  now: Date = new Date(),
): MessageDayGroup[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const groups: MessageDayGroup[] = [];

  for (const msg of sorted) {
    const date = new Date(msg.created_at);
    const dayKey = toLocalDayKey(date);
    const lastGroup = groups.at(-1);
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({
        dayKey,
        label: formatDayLabel(date, now),
        messages: [msg],
      });
    }
  }

  return groups;
}

export function formatConversationTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  const todayKey = toLocalDayKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const key = toLocalDayKey(date);

  if (key === todayKey) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (key === toLocalDayKey(yesterday)) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}