import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { uploadHelpAttachment } from "@/lib/help-storage";
import { notifyAdminsFn } from "@/lib/help.functions";
import { buildConversationSummaries, formatConversationTime } from "@/lib/messages-utils";
import type { AppRole, HelpDirectMessage, HelpProfile } from "@/lib/help.types";
import { ConfirmActionDialog } from "./PortalModals";
import { MessageThread } from "./MessageThread";

interface DirectMessagesPanelProps {
  role: AppRole;
  currentProfile: HelpProfile;
  profiles: HelpProfile[];
  directMessages: HelpDirectMessage[];
  onRefresh: () => void;
  onEditProfessor?: (profile: HelpProfile) => void;
}

export function DirectMessagesPanel({
  role,
  currentProfile,
  profiles,
  directMessages,
  onRefresh,
  onEditProfessor,
}: DirectMessagesPanelProps) {
  const notifyAdmins = useServerFn(notifyAdminsFn);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "active">("all");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    role === "admin" ? "" : currentProfile.id,
  );
  const [mobileView, setMobileView] = useState<"list" | "chat">(role === "admin" ? "list" : "chat");
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMessage, setDeletingMessage] = useState<HelpDirectMessage | null>(null);

  const allSummaries = useMemo(
    () =>
      buildConversationSummaries({
        role,
        currentProfile,
        profiles,
        directMessages,
        search: "",
      }),
    [currentProfile, directMessages, profiles, role],
  );

  const conversations = useMemo(
    () =>
      buildConversationSummaries({
        role,
        currentProfile,
        profiles,
        directMessages,
        search,
        onlyWithMessages: role === "admin" && filterMode === "active",
      }),
    [currentProfile, directMessages, filterMode, profiles, role, search],
  );

  const activeThreadsCount = useMemo(
    () => allSummaries.filter((c) => c.messageCount > 0).length,
    [allSummaries],
  );

  const activeThreadId =
    role !== "admin"
      ? currentProfile.id
      : conversations.some((c) => c.threadId === selectedProfileId)
        ? selectedProfileId
        : (conversations[0]?.threadId ?? "");

  const activeConversation =
    conversations.find((c) => c.threadId === activeThreadId) ??
    allSummaries.find((c) => c.threadId === activeThreadId) ??
    null;
  const activeContact = activeConversation?.contact ?? null;

  const threadMessages = useMemo(
    () => directMessages.filter((m) => m.profile_id === activeThreadId),
    [activeThreadId, directMessages],
  );

  async function submitMessage() {
    if (!activeThreadId) return;
    const text = draft.trim();
    if ((!text && !pendingFile) || sending) return;

    setSending(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (pendingFile && currentProfile.auth_user_id) {
        attachmentPath = await uploadHelpAttachment(
          currentProfile.auth_user_id,
          "chat",
          pendingFile,
        );
        attachmentName = pendingFile.name;
        attachmentType = pendingFile.type || "application/octet-stream";
      }

      const { error } = await supabase.from("direct_messages").insert({
        profile_id: activeThreadId,
        sender_profile_id: currentProfile.id,
        sender_name: currentProfile.name,
        message: text,
        attachment_name: attachmentName,
        attachment_path: attachmentPath,
        attachment_type: attachmentType,
      });
      if (error) throw error;

      if (role === "admin") {
        await supabase.from("notifications").insert({
          recipient_profile_id: activeThreadId,
          type: "direct-message",
          reference_id: activeThreadId,
          text: `Nova mensagem da administração: ${(text || attachmentName || "").slice(0, 70)}`,
        });
      } else {
        await notifyAdmins({
          data: {
            type: "teacher-message",
            referenceId: currentProfile.id,
            text: `Mensagem de ${currentProfile.name}: ${(text || attachmentName || "").slice(0, 70)}`,
          },
        });
      }

      setDraft("");
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEdit(msgId: string) {
    const clean = editingText.trim();
    if (!clean) return;
    const { error } = await supabase
      .from("direct_messages")
      .update({ message: clean })
      .eq("id", msgId);
    if (error) {
      toast.error("Não foi possível editar a mensagem.");
      return;
    }
    setEditingId(null);
    setEditingText("");
    onRefresh();
  }

  async function handleDelete(msgId: string) {
    const { error } = await supabase.from("direct_messages").delete().eq("id", msgId);
    if (error) {
      toast.error("Não foi possível excluir a mensagem.");
      return;
    }
    setDeletingMessage(null);
    onRefresh();
  }

  function handleSelectConversation(threadId: string) {
    setSelectedProfileId(threadId);
    setEditingId(null);
    setMobileView("chat");
  }

  const isAdmin = role === "admin";

  return (
    <>
      <div
        className={`portal-panel overflow-hidden ${
          isAdmin
            ? "grid h-[min(680px,calc(100vh-14rem))] min-h-[520px] md:grid-cols-12"
            : "flex h-[min(660px,calc(100vh-14rem))] min-h-[500px] flex-col"
        }`}
      >
        {isAdmin ? (
          <aside
            className={`${
              mobileView === "list" ? "flex" : "hidden"
            } min-h-0 flex-col border-border bg-card md:col-span-5 md:flex md:border-r lg:col-span-4`}
          >
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.14em] text-brand-teal uppercase">
                    Caixa de entrada
                  </p>
                  <h3 className="text-base font-extrabold text-foreground">Conversas</h3>
                </div>
                <span className="rounded-full bg-brand-teal-soft px-2.5 py-0.5 text-xs font-extrabold text-brand-teal">
                  {allSummaries.length}
                </span>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar professor, sala ou texto..."
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-canvas-surface p-1">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    filterMode === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todas ({allSummaries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("active")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    filterMode === "active"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Com mensagens ({activeThreadsCount})
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Nenhuma conversa encontrada com esse filtro.
                  </p>
                </div>
              ) : (
                conversations.map(({ threadId, contact, messageCount, lastMessage }) => {
                  const isSelected = threadId === activeThreadId;
                  const previewText = lastMessage
                    ? `${lastMessage.sender_profile_id === currentProfile.id ? "Você: " : ""}${
                        lastMessage.message || lastMessage.attachment_name || "Anexo"
                      }`
                    : contact.room
                      ? `Sala ${contact.room}${contact.department ? ` · ${contact.department}` : ""}`
                      : contact.email;

                  return (
                    <button
                      key={threadId}
                      type="button"
                      onClick={() => handleSelectConversation(threadId)}
                      className={`flex w-full items-start gap-3 border-l-3 px-4 py-3.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "border-l-primary bg-brand-teal-soft/55"
                          : "border-l-transparent hover:bg-muted/55"
                      }`}
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal-soft text-sm font-extrabold text-brand-teal">
                        {contact.avatar_url ? (
                          <img src={contact.avatar_url} alt={contact.name} className="h-full w-full object-cover" />
                        ) : (
                          contact.name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-foreground">{contact.name}</p>
                          {lastMessage ? (
                            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                              {formatConversationTime(lastMessage.created_at)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{previewText}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-muted-foreground/85">
                            {contact.room ? `Sala ${contact.room}` : contact.department || "Docente"}
                          </span>
                          {messageCount > 0 ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
                              {messageCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        ) : null}

        <section
          className={`${
            isAdmin && mobileView === "list" ? "hidden md:flex" : "flex"
          } min-h-0 flex-1 flex-col ${isAdmin ? "md:col-span-7 lg:col-span-8" : ""}`}
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {isAdmin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  onClick={() => setMobileView("list")}
                  aria-label="Voltar para a lista de conversas"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}

              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal-soft text-sm font-extrabold text-brand-teal">
                {!isAdmin ? (
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                ) : activeContact?.avatar_url ? (
                  <img src={activeContact.avatar_url} alt={activeContact.name} className="h-full w-full object-cover" />
                ) : (
                  (activeContact?.name.charAt(0) ?? "?").toUpperCase()
                )}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-sm font-extrabold text-foreground">
                    {activeContact?.name ?? "Selecione uma conversa"}
                  </h4>
                  {!isAdmin ? (
                    <span className="rounded-full bg-brand-teal-soft px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                      Canal direto
                    </span>
                  ) : activeContact?.room ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
                      Sala {activeContact.room}
                    </span>
                  ) : null}
                </div>
                {activeContact ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {activeContact.email}
                    {activeContact.department ? ` · ${activeContact.department}` : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-canvas-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {threadMessages.length} {threadMessages.length === 1 ? "mensagem" : "mensagens"}
              </span>
              {isAdmin && activeContact && onEditProfessor ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditProfessor(activeContact)}
                >
                  <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Editar cadastro</span>
                </Button>
              ) : null}
            </div>
          </header>

          <MessageThread
            threadId={activeThreadId}
            role={role}
            currentProfile={currentProfile}
            messages={threadMessages}
            editingId={editingId}
            editingText={editingText}
            onEditingTextChange={setEditingText}
            onStartEdit={(msg) => {
              setEditingId(msg.id);
              setEditingText(msg.message);
            }}
            onCancelEdit={() => {
              setEditingId(null);
              setEditingText("");
            }}
            onSaveEdit={(msgId) => void handleSaveEdit(msgId)}
            onRequestDelete={(msg) => setDeletingMessage(msg)}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitMessage();
            }}
            className="border-t border-border bg-card p-3.5 sm:p-4"
          >
            {pendingFile ? (
              <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-border bg-canvas-surface px-3 py-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-foreground">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-brand-teal" aria-hidden="true" />
                  <span className="truncate">{pendingFile.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-destructive hover:bg-status-coral-soft cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Remover
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Anexar arquivo"
                onClick={() => fileRef.current?.click()}
                disabled={!activeThreadId || sending}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
                rows={1}
                placeholder={
                  activeContact
                    ? `Escreva para ${activeContact.name}...`
                    : "Selecione uma conversa para escrever..."
                }
                maxLength={1200}
                disabled={!activeThreadId || sending}
                className="min-h-10 max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                variant="hero"
                className="h-10 shrink-0 px-3.5"
                disabled={!activeThreadId || sending || (!draft.trim() && !pendingFile)}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </div>
            <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">
              Pressione Enter para enviar ou Shift + Enter para quebrar linha.
            </p>
          </form>
        </section>
      </div>

      <ConfirmActionDialog
        open={Boolean(deletingMessage)}
        title="Excluir mensagem"
        description="Tem certeza que deseja remover esta mensagem da conversa? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (deletingMessage) void handleDelete(deletingMessage.id);
        }}
        onOpenChange={(open) => {
          if (!open) setDeletingMessage(null);
        }}
      />
    </>
  );
}