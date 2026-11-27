import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DirectMessagesPanel } from "@/components/portal/DirectMessagesPanel";
import type { HelpDirectMessage, HelpProfile } from "@/lib/help.types";

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    useServerFn: () => vi.fn().mockResolvedValue({ ok: true }),
  };
});

vi.mock("@/lib/help.functions", () => ({
  notifyAdminsFn: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const adminProfile: HelpProfile = {
  id: "admin-1",
  auth_user_id: "auth-admin",
  name: "Administrador Guilherme",
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
  name: "Professora Ana",
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
  name: "Professor Bruno",
  email: "bruno@help.local",
  role: "user",
  department: "Mecânica",
  room: "205",
  lab_id: "lab-2",
  avatar_path: null,
  active: true,
};

const messages: HelpDirectMessage[] = [
  {
    id: "msg-1",
    profile_id: "prof-bruno",
    sender_profile_id: "prof-bruno",
    sender_name: "Professor Bruno",
    message: "Preciso verificar o torno da sala 205.",
    attachment_name: null,
    attachment_path: null,
    attachment_type: null,
    created_at: new Date().toISOString(),
  },
];

describe("DirectMessagesPanel", () => {
  it("renders structured admin inbox with filter tabs and confirmation dialog before delete", () => {
    render(
      <DirectMessagesPanel
        role="admin"
        currentProfile={adminProfile}
        profiles={[adminProfile, profAna, profBruno]}
        directMessages={messages}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Todas (2)")).toBeInTheDocument();
    expect(screen.getByText("Com mensagens (1)")).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getAllByText("Preciso verificar o torno da sala 205.")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Com mensagens/i }));
    expect(screen.queryByText("Professora Ana")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Excluir/i }));
    expect(screen.getByText("Excluir mensagem")).toBeInTheDocument();
  });

  it("renders a focused single-channel direct layout for professors", () => {
    render(
      <DirectMessagesPanel
        role="user"
        currentProfile={profBruno}
        profiles={[adminProfile, profBruno]}
        directMessages={messages}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Canal direto")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Buscar professor/i)).not.toBeInTheDocument();
    expect(screen.getByText("Preciso verificar o torno da sala 205.")).toBeInTheDocument();
  });
});