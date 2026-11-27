import { useEffect, useMemo, useRef } from "react";
import { Check, MessageSquareText, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupMessagesByDay } from "@/lib/messages-utils";
import type { AppRole, HelpDirectMessage, HelpProfile } from "@/lib/help.types";

interface MessageThreadProps {
  threadId: string;
  role: AppRole;
  currentProfile: HelpProfile;
  messages: HelpDirectMessage[];
  editingId: string | null;
  editingText: string;
  onEditingTextChange: (value: string) => void;
  onStartEdit: (msg: HelpDirectMessage) => void;
  onCancelEdit: () => void;
  onSaveEdit: (msgId: string) => void;
  onRequestDelete: (msg: HelpDirectMessage) => void;
}

export function MessageThread({
  threadId,
  role,
  currentProfile,
  messages,
  editingId,
  editingText,
  onEditingTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dayGroups = useMemo(() => groupMessagesByDay(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [threadId, messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas-surface/60 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-soft text-brand-teal">
          <MessageSquareText className="h-6 w-6" aria-hidden="true" />
        </span>
        <h4 className="mt-3 text-sm font-extrabold text-foreground">Nenhuma mensagem nesta conversa</h4>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Use o campo abaixo para enviar uma orientação, dúvida ou anexo. O histórico ficará organizado por data aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto bg-canvas-surface/60 px-4 py-5 sm:px-6">
      {dayGroups.map((group) => (
        <div key={group.dayKey} className="space-y-3">
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border/80" aria-hidden="true" />
            <span className="rounded-full border border-border bg-card px-3 py-0.5 text-[11px] font-bold text-muted-foreground">
              {group.label}
            </span>
            <span className="h-px flex-1 bg-border/80" aria-hidden="true" />
          </div>

          {group.messages.map((msg, idx) => {
            const isOwn = msg.sender_profile_id === currentProfile.id;
            const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
            const showHeader = !prevMsg || prevMsg.sender_profile_id !== msg.sender_profile_id;
            const isImageAttachment =
              Boolean(msg.attachment_url) &&
              Boolean(msg.attachment_type?.toLowerCase().startsWith("image/"));
            const canManage = isOwn || role === "admin";
            const timeText = new Intl.DateTimeFormat("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(msg.created_at));

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isOwn ? "items-end" : "items-start"} ${
                  showHeader ? "pt-1" : "pt-0"
                }`}
              >
                {showHeader ? (
                  <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                    <span className="font-bold text-foreground/85">
                      {isOwn ? "Você" : msg.sender_name}
                    </span>
                    <span>{timeText}</span>
                  </div>
                ) : null}

                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-xs sm:max-w-[78%] ${
                    isOwn
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-card text-foreground"
                  }`}
                >
                  {editingId === msg.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingText}
                        onChange={(e) => onEditingTextChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSaveEdit(msg.id);
                          if (e.key === "Escape") onCancelEdit();
                        }}
                        className="h-8 bg-background text-xs text-foreground"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onSaveEdit(msg.id)}
                        aria-label="Salvar edição"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={onCancelEdit}
                        aria-label="Cancelar edição"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : msg.message ? (
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                  ) : null}

                  {msg.attachment_name && msg.attachment_url ? (
                    isImageAttachment ? (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block overflow-hidden rounded-xl border border-border/40"
                      >
                        <img
                          src={msg.attachment_url}
                          alt={msg.attachment_name}
                          className="max-h-52 w-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold underline-offset-2 hover:underline ${
                          isOwn
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "border border-border bg-canvas-surface text-foreground"
                        }`}
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[220px]">{msg.attachment_name}</span>
                      </a>
                    )
                  ) : null}

                  {!showHeader ? (
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
                      }`}
                    >
                      {timeText}
                    </p>
                  ) : null}
                </div>

                {canManage && editingId !== msg.id ? (
                  <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-muted-foreground opacity-80 transition-opacity sm:opacity-65 sm:group-hover:opacity-100">
                    {msg.message ? (
                      <button
                        type="button"
                        onClick={() => onStartEdit(msg)}
                        className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Editar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRequestDelete(msg)}
                      className="inline-flex items-center gap-1 hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" /> Excluir
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}