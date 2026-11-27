import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Camera, Download, KeyRound, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { uploadHelpAttachment } from "@/lib/help-storage";
import { adminCreateProfessorFn, notifyAdminsFn } from "@/lib/help.functions";
import {
  DEFAULT_DEPARTMENTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type AppRole,
  type HelpAsset,
  type HelpLaboratory,
  type HelpProfile,
  type HelpTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/help.types";

export function AssetDialog({
  open,
  onOpenChange,
  editingAsset,
  defaultLabId,
  laboratories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAsset: HelpAsset | null;
  defaultLabId: string;
  laboratories: HelpLaboratory[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [labId, setLabId] = useState(defaultLabId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setDescription(editingAsset.description);
      setQuantity(String(editingAsset.quantity));
      setLabId(editingAsset.laboratory_id);
    } else {
      setName("");
      setDescription("");
      setQuantity("1");
      setLabId(defaultLabId || laboratories[0]?.id || "");
    }
  }, [defaultLabId, editingAsset, laboratories, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qtyNum = Number(quantity);
    if (!name.trim() || !description.trim() || !labId) {
      toast.error("Preencha todos os campos do equipamento.");
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 5000) {
      toast.error("Informe uma quantidade inteira entre 1 e 5000.");
      return;
    }
    setSaving(true);
    try {
      if (editingAsset) {
        const { error } = await supabase
          .from("assets")
          .update({
            name: name.trim(),
            description: description.trim(),
            quantity: qtyNum,
            laboratory_id: labId,
          })
          .eq("id", editingAsset.id);
        if (error) throw error;
        toast.success("Ativo atualizado com sucesso.");
      } else {
        const lab = laboratories.find((l) => l.id === labId);
        const roomTag = (lab?.room || "LAB").replace(/[^A-Z0-9]/gi, "").toUpperCase() || "LAB";
        const suffix = Date.now().toString(36).toUpperCase().slice(-4);
        const id = `asset-${Date.now().toString(36)}`;
        const code = `EQ-${roomTag}-${suffix}`;
        const { error } = await supabase.from("assets").insert({
          id,
          code,
          laboratory_id: labId,
          name: name.trim(),
          description: description.trim(),
          quantity: qtyNum,
        });
        if (error) throw error;
        toast.success("Ativo cadastrado no catálogo.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar ativo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingAsset ? "Editar ativo" : "Adicionar ativo"}</DialogTitle>
          <DialogDescription>
            Informe as especificações e a quantidade disponível no laboratório.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {laboratories.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="asset-lab">Laboratório / sala</Label>
              <select
                id="asset-lab"
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {laboratories.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Nome do equipamento</Label>
            <Input
              id="asset-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Estação de trabalho"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asset-specs">Especificações técnicas</Label>
            <Textarea
              id="asset-specs"
              required
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as especificações do ativo."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asset-qty">Quantidade no laboratório</Label>
            <Input
              id="asset-qty"
              type="number"
              required
              min={1}
              max={5000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Salvando..." : editingAsset ? "Salvar alterações" : "Cadastrar ativo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OpenTicketDialog({
  asset,
  lab,
  currentProfile,
  onOpenChange,
  onCreated,
}: {
  asset: HelpAsset | null;
  lab: HelpLaboratory | null;
  currentProfile: HelpProfile;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const notifyAdmins = useServerFn(notifyAdminsFn);
  const [serial, setSerial] = useState("#01");
  const [requestType, setRequestType] = useState<string>(TICKET_TYPES[0]!);
  const [priority, setPriority] = useState<TicketPriority>("Média");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const serialOptions = Array.from({ length: Math.min(Math.max(asset?.quantity ?? 1, 1), 100) }).map(
    (_, idx) => `#${String(idx + 1).padStart(2, "0")}`,
  );

  useEffect(() => {
    if (asset) {
      setSerial("#01");
      setRequestType(TICKET_TYPES[0]!);
      setPriority("Média");
      setDescription("");
      setPhotoFile(null);
    }
  }, [asset]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !description.trim()) {
      toast.error("Descreva a ocorrência antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      let photoPath: string | null = null;
      if (photoFile && currentProfile.auth_user_id) {
        photoPath = await uploadHelpAttachment(currentProfile.auth_user_id, "tickets", photoFile);
      }
      const ticketId = `CH-${Date.now().toString().slice(-5)}`;
      const { error } = await supabase.from("tickets").insert({
        id: ticketId,
        requester_profile_id: currentProfile.id,
        laboratory_id: lab?.id ?? asset.laboratory_id,
        asset_id: asset.id,
        department: lab?.department ?? currentProfile.department ?? "Informática",
        lab_name: lab?.name ?? "Laboratório",
        asset_name: asset.name,
        serial: `${asset.code} · ${serial}`,
        requester_name: currentProfile.name,
        request_type: requestType,
        priority,
        description: description.trim(),
        photo_path: photoPath,
        status: "Em Andamento",
      });
      if (error) throw error;

      await notifyAdmins({
        data: {
          type: "new-ticket",
          referenceId: ticketId,
          text: `Novo chamado ${ticketId} (${priority}) aberto por ${currentProfile.name}: ${asset.name} (${serial}).`,
        },
      });

      toast.success(`Chamado ${ticketId} registrado!`);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir chamado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir chamado técnico</DialogTitle>
          <DialogDescription>
            Vincule a ocorrência ao equipamento e informe o número da unidade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item selecionado</Label>
            <Input value={asset ? `${asset.name} (${asset.code})` : ""} readOnly />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-serial">Número do equipamento</Label>
              <select
                id="ticket-serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {serialOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    Unidade {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-priority">Prioridade</Label>
              <select
                id="ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-type">Tipo de solicitação</Label>
            <select
              id="ticket-type"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TICKET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-desc">Descrição do defeito</Label>
            <Textarea
              id="ticket-desc"
              required
              rows={3}
              maxLength={1200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que aconteceu com o equipamento."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-photo">Foto de evidência (opcional)</Label>
            <Input
              id="ticket-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Salvando..." : "Salvar chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TicketChatDialog({
  ticket,
  role,
  currentProfile,
  onOpenChange,
  onUpdated,
}: {
  ticket: HelpTicket | null;
  role: AppRole;
  currentProfile: HelpProfile;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const notifyAdmins = useServerFn(notifyAdminsFn);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_profile_id: currentProfile.id,
        sender_name: currentProfile.name,
        sender_role: role,
        message: message.trim(),
      });
      if (error) throw error;

      if (role === "admin") {
        await supabase.from("notifications").insert({
          recipient_profile_id: ticket.requester_profile_id,
          type: "ticket-message",
          reference_id: ticket.id,
          text: `Nova resposta no chamado ${ticket.id}: ${message.trim().slice(0, 70)}`,
        });
      } else {
        await notifyAdmins({
          data: {
            type: "ticket-message",
            referenceId: ticket.id,
            text: `${currentProfile.name} respondeu no chamado ${ticket.id}.`,
          },
        });
      }
      setMessage("");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(status: TicketStatus) {
    if (!ticket) return;
    const { error } = await supabase
      .from("tickets")
      .update({
        status,
        resolved_at: status === "Concluído" ? new Date().toISOString() : null,
      })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }
    await supabase.from("notifications").insert({
      recipient_profile_id: ticket.requester_profile_id,
      type: "ticket-update",
      reference_id: ticket.id,
      text: `Chamado ${ticket.id} atualizado para: ${status}.`,
    });
    toast.success(`Status alterado para ${status}.`);
    onUpdated();
  }

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atendimento · {ticket?.id}</DialogTitle>
          <DialogDescription>
            {ticket ? `${ticket.asset_name} (${ticket.serial}) — ${ticket.lab_name}` : ""}
          </DialogDescription>
        </DialogHeader>
        {ticket ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-canvas-surface p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-foreground">{ticket.request_type}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    ticket.priority === "Alta"
                      ? "bg-status-coral-soft text-status-coral"
                      : ticket.priority === "Baixa"
                        ? "bg-muted text-muted-foreground"
                        : "bg-status-amber-soft text-status-amber"
                  }`}
                >
                  Prioridade {ticket.priority}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{ticket.description}</p>
              {ticket.photo_url ? (
                <a
                  href={ticket.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block"
                >
                  <img
                    src={ticket.photo_url}
                    alt="Foto de evidência do chamado"
                    className="h-24 w-auto rounded-lg border border-border object-cover"
                  />
                </a>
              ) : null}
            </div>

            <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-xl border border-border p-3">
              {ticket.messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhuma mensagem registrada neste chamado.
                </p>
              ) : (
                ticket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-xs ${
                      m.author_profile_id === currentProfile.id
                        ? "ml-6 bg-primary text-primary-foreground"
                        : "mr-6 bg-muted text-foreground"
                    }`}
                  >
                    <div className="mb-0.5 flex justify-between gap-2 font-bold opacity-85">
                      <span>{m.sender_name}</span>
                      <span>
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(m.created_at))}
                      </span>
                    </div>
                    <p>{m.message}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva uma mensagem..."
                maxLength={800}
              />
              <Button type="submit" variant="hero" size="icon" disabled={sending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {role === "admin" ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs font-bold text-muted-foreground">Status do chamado</span>
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_STATUSES.map((st) => (
                    <Button
                      key={st}
                      type="button"
                      size="sm"
                      variant={
                        ticket.status === st
                          ? st === "Concluído"
                            ? "navy"
                            : "default"
                          : "outline"
                      }
                      onClick={() => void handleStatus(st)}
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function QrCodeDialog({
  asset,
  labName,
  onOpenChange,
}: {
  asset: HelpAsset | null;
  labName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    if (!asset) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const payload = `${origin}/portal?asset=${encodeURIComponent(asset.code)}`;
    void QRCode.toDataURL(payload, { width: 220, margin: 2 }).then(setQrUrl);
  }, [asset, labName]);

  function buildLabelDataUrl(onReady: (dataUrl: string) => void) {
    if (!asset || !qrUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 580;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0d3038";
      ctx.fillRect(0, 0, canvas.width, 76);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HELP! · ETIQUETA DE ATIVO", canvas.width / 2, 46);
      ctx.drawImage(img, 110, 100, 260, 260);
      ctx.fillStyle = "#117e87";
      ctx.font = "800 24px monospace";
      ctx.fillText(asset.code, canvas.width / 2, 405);
      ctx.fillStyle = "#102c35";
      ctx.font = "700 20px sans-serif";
      ctx.fillText(asset.name.slice(0, 34), canvas.width / 2, 444);
      ctx.fillStyle = "#5f7278";
      ctx.font = "500 15px sans-serif";
      ctx.fillText(labName.slice(0, 44), canvas.width / 2, 478);
      ctx.fillText("Aponte a câmera para abrir chamado", canvas.width / 2, 526);
      onReady(canvas.toDataURL("image/png"));
    };
    img.src = qrUrl;
  }

  function handleDownload() {
    if (!asset) return;
    buildLabelDataUrl((dataUrl) => {
      const link = document.createElement("a");
      link.download = `etiqueta-${asset.code}.png`;
      link.href = dataUrl;
      link.click();
    });
  }

  function handlePrint() {
    if (!asset) return;
    buildLabelDataUrl((dataUrl) => {
      const popup = window.open("", "_blank", "width=540,height=660");
      if (!popup) {
        toast.error("Permita pop-ups no navegador para imprimir a etiqueta.");
        return;
      }
      popup.document.write(
        `<!doctype html><html><head><title>Etiqueta ${asset.code}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}img{max-width:340px;height:auto;border:1px solid #ddd;border-radius:12px}</style></head><body><img src="${dataUrl}" onload="window.print()" /></body></html>`,
      );
      popup.document.close();
    });
  }

  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>Etiqueta QR do ativo</DialogTitle>
          <DialogDescription>
            {asset ? `${asset.code} · ${asset.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-3">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`QR Code do ativo ${asset?.code ?? ""}`}
              className="rounded-xl border border-border bg-background p-3"
            />
          ) : null}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{labName}</p>
            <p className="text-[11px] text-muted-foreground">
              Ao escanear, o portal abre direto este equipamento.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-center">
          <Button type="button" variant="hero" size="sm" onClick={handleDownload} disabled={!qrUrl}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Baixar PNG
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={!qrUrl}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Imprimir
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LabDialog({
  open,
  onOpenChange,
  editingLab = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLab?: HelpLaboratory | null;
  onSaved: () => void;
}) {
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENTS[0]!);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingLab) {
      setDepartment(editingLab.department);
      setName(editingLab.name);
      setRoom(editingLab.room);
      setActive(editingLab.active);
    } else {
      setDepartment(DEFAULT_DEPARTMENTS[0]!);
      setName("");
      setRoom("");
      setActive(true);
    }
  }, [editingLab, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do laboratório.");
      return;
    }
    setSaving(true);
    try {
      const cleanRoom = room.trim();
      if (editingLab) {
        const { error } = await supabase
          .from("laboratories")
          .update({
            department,
            name: name.trim(),
            room: cleanRoom,
            active,
          })
          .eq("id", editingLab.id);
        if (error) throw error;
        toast.success("Laboratório atualizado!");
      } else {
        const id = `lab-${cleanRoom || Date.now().toString(36).slice(-4)}-${Date.now().toString(36).slice(-3)}`;
        const { error } = await supabase.from("laboratories").insert({
          id,
          department,
          name: name.trim(),
          room: cleanRoom,
          active: true,
        });
        if (error) throw error;
        toast.success("Laboratório cadastrado!");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar laboratório.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingLab ? "Editar laboratório" : "Cadastrar laboratório"}</DialogTitle>
          <DialogDescription>
            {editingLab
              ? "Atualize o nome, departamento, sala ou disponibilidade do laboratório."
              : "Associe uma nova sala ou oficina a um departamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lab-dept">Curso / departamento</Label>
            <select
              id="lab-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DEFAULT_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-name">Nome do laboratório / sala</Label>
            <Input
              id="lab-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Laboratório de Redes · Sala 310"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-room">Número da sala</Label>
            <Input
              id="lab-room"
              maxLength={24}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ex.: 310"
            />
          </div>
          {editingLab ? (
            <label className="flex items-center gap-2.5 rounded-xl border border-border bg-canvas-surface px-3.5 py-2.5 text-sm font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Laboratório ativo (visível para os professores)
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Salvando..." : editingLab ? "Salvar alterações" : "Salvar laboratório"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfessorDialog({
  open,
  onOpenChange,
  laboratories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: HelpLaboratory[];
  onSaved: () => void;
}) {
  const createProfessor = useServerFn(adminCreateProfessorFn);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [labId, setLabId] = useState(laboratories[0]?.id ?? "");
  const [initialPassword, setInitialPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !labId && laboratories[0]) {
      setLabId(laboratories[0].id);
    }
  }, [labId, laboratories, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lab = laboratories.find((l) => l.id === labId);
    if (!name.trim() || !email.trim() || !lab) {
      toast.error("Preencha nome, e-mail e laboratório.");
      return;
    }
    setSaving(true);
    try {
      const res = await createProfessor({
        data: {
          name: name.trim(),
          email: email.trim(),
          department: lab.department,
          labId: lab.id,
          ...(initialPassword.trim() ? { initialPassword: initialPassword.trim() } : {}),
        },
      });
      toast.success(
        res.immediateAccess
          ? "Professor cadastrado com acesso imediato! Ele já pode entrar com o e-mail e a senha informados."
          : "Professor pré-cadastrado! No primeiro acesso ele confirmará o e-mail e escolherá sua senha.",
      );
      setName("");
      setEmail("");
      setInitialPassword("");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar professor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar professor</DialogTitle>
          <DialogDescription>
            Vincule o professor a um laboratório. Defina uma senha inicial para acesso imediato ou deixe em branco para primeiro acesso por e-mail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-name">Nome completo</Label>
            <Input
              id="prof-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Professora Ana Souza"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-email">E-mail de acesso</Label>
            <Input
              id="prof-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="professor@escola.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-lab">Laboratório / sala</Label>
            <select
              id="prof-lab"
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-pass">Senha inicial (opcional)</Label>
            <Input
              id="prof-pass"
              type="password"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              placeholder="Ex.: HelpLab!2026 (libera acesso imediato)"
            />
            <p className="text-[11px] text-muted-foreground">
              Use letras, números e um símbolo para evitar bloqueio de senha fraca.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar professor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditProfessorDialog({
  profile,
  laboratories,
  onOpenChange,
  onSaved,
}: {
  profile: HelpProfile | null;
  laboratories: HelpLaboratory[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [labId, setLabId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setLabId(profile.lab_id ?? laboratories[0]?.id ?? "");
    }
  }, [laboratories, profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    const lab = laboratories.find((l) => l.id === labId);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          lab_id: lab?.id ?? null,
          room: lab?.room ?? null,
          department: lab?.department ?? profile.department,
        })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Cadastro atualizado.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar professor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(profile)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cadastro do professor</DialogTitle>
          <DialogDescription>{profile?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-prof-name">Nome</Label>
            <Input
              id="edit-prof-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-prof-lab">Laboratório</Label>
            <select
              id="edit-prof-lab"
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  onUpdated,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: HelpProfile;
  onUpdated: () => void;
  onSignOut: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPass !== confirmPass) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSavingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        const msg = error.message.toLowerCase().includes("weak")
          ? "Senha muito fraca. Combine letras, números e um símbolo."
          : error.message;
        toast.error(msg);
        return;
      }
      toast.success("Senha atualizada com sucesso!");
      setNewPass("");
      setConfirmPass("");
      setChangingPass(false);
    } finally {
      setSavingPass(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile.auth_user_id) return;
    setUploading(true);
    try {
      const path = await uploadHelpAttachment(profile.auth_user_id, "avatars", file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Foto de perfil atualizada.");
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>Informações do seu cadastro no Help!.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-teal-soft text-2xl font-extrabold text-brand-teal">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
            <label
              htmlFor="profile-avatar-upload"
              className="absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted"
              title="Alterar foto"
            >
              <Camera className="h-4 w-4" />
              <input
                id="profile-avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                className="hidden"
                onChange={(e) => void handleAvatarChange(e)}
              />
            </label>
          </div>
          <div>
            <p className="text-base font-extrabold text-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
          <div className="w-full space-y-1.5 rounded-xl border border-border bg-canvas-surface p-3 text-left text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perfil</span>
              <span className="font-bold text-foreground">
                {profile.role === "admin" ? "Administrador" : "Professor / Funcionário"}
              </span>
            </div>
            {profile.department ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Departamento</span>
                <span className="font-bold text-foreground">{profile.department}</span>
              </div>
            ) : null}
            {profile.room ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sala</span>
                <span className="font-bold text-foreground">Sala {profile.room}</span>
              </div>
            ) : null}
          </div>
          {changingPass ? (
            <form onSubmit={handleChangePassword} className="w-full space-y-2.5 rounded-xl border border-border bg-canvas-surface p-3 text-left">
              <p className="text-xs font-bold text-foreground">Alterar senha</p>
              <Input
                type="password"
                required
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Nova senha"
              />
              <Input
                type="password"
                required
                minLength={6}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Confirmar nova senha"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="hero" className="flex-1" disabled={savingPass}>
                  {savingPass ? "Salvando..." : "Salvar senha"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setChangingPass(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setChangingPass(true)}>
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Alterar minha senha
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="navy" className="w-full" onClick={onSignOut}>
            Sair da conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}