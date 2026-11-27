export type AppRole = "admin" | "user";

export type TicketRequestType =
  | "Manutenção / Reparo"
  | "Troca de Peça"
  | "Calibração / Ajuste"
  | "Substituição Integral";

export type TicketStatus = "Em Andamento" | "Aguardando Peça" | "Concluído";

export type TicketPriority = "Baixa" | "Média" | "Alta";

export const TICKET_STATUSES: TicketStatus[] = [
  "Em Andamento",
  "Aguardando Peça",
  "Concluído",
];

export const TICKET_PRIORITIES: TicketPriority[] = ["Baixa", "Média", "Alta"];

export const TICKET_TYPES: TicketRequestType[] = [
  "Manutenção / Reparo",
  "Troca de Peça",
  "Calibração / Ajuste",
  "Substituição Integral",
];

export const DEFAULT_DEPARTMENTS = [
  "Informática",
  "Engenharia Mecânica",
  "Automação Industrial",
];

export interface HelpProfile {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: AppRole;
  department: string | null;
  room: string | null;
  lab_id: string | null;
  avatar_path: string | null;
  avatar_url?: string | null;
  active: boolean;
}

export interface HelpLaboratory {
  id: string;
  name: string;
  room: string;
  department: string;
  responsible_profile_id: string | null;
  active: boolean;
}

export interface HelpAsset {
  id: string;
  code: string;
  laboratory_id: string;
  name: string;
  description: string;
  quantity: number;
  status: string;
}

export interface HelpTicketMessage {
  id: string;
  ticket_id: string;
  author_profile_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface HelpTicket {
  id: string;
  ticket_number: number;
  requester_profile_id: string;
  laboratory_id: string | null;
  asset_id: string | null;
  department: string;
  lab_name: string;
  asset_name: string;
  serial: string;
  requester_name: string;
  request_type: string;
  description: string;
  photo_path: string | null;
  photo_url?: string | null;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  messages: HelpTicketMessage[];
}

export interface HelpDirectMessage {
  id: string;
  profile_id: string;
  sender_profile_id: string;
  sender_name: string;
  message: string;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_url?: string | null;
  attachment_type: string | null;
  created_at: string;
}

export interface HelpNotification {
  id: string;
  recipient_profile_id: string;
  type: string;
  reference_id: string | null;
  text: string;
  read: boolean;
  created_at: string;
}

export interface PortalBootstrapData {
  currentProfile: HelpProfile;
  role: AppRole;
  profiles: HelpProfile[];
  laboratories: HelpLaboratory[];
  assets: HelpAsset[];
  tickets: HelpTicket[];
  directMessages: HelpDirectMessage[];
  notifications: HelpNotification[];
}