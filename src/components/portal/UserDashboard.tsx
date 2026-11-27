import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Pencil,
  Plus,
  QrCode,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { HelpAsset, HelpTicket, PortalBootstrapData } from "@/lib/help.types";
import { DirectMessagesPanel } from "./DirectMessagesPanel";
import {
  AssetDialog,
  ConfirmActionDialog,
  OpenTicketDialog,
  QrCodeDialog,
  TicketChatDialog,
} from "./PortalModals";

export function UserDashboard({
  data,
  activeTab,
  onRefresh,
  initialAssetCode,
}: {
  data: PortalBootstrapData;
  activeTab: string;
  onRefresh: () => void;
  initialAssetCode?: string | null;
}) {
  const { currentProfile, laboratories, assets, tickets, profiles, directMessages } = data;

  const [selectedLabId, setSelectedLabId] = useState<string>(
    currentProfile.lab_id ?? laboratories[0]?.id ?? "all",
  );
  const [search, setSearch] = useState("");
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<HelpAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<HelpAsset | null>(null);
  const [ticketAsset, setTicketAsset] = useState<HelpAsset | null>(null);
  const [qrAsset, setQrAsset] = useState<HelpAsset | null>(null);
  const [chatTicketId, setChatTicketId] = useState<string | null>(null);
  const handledQrRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialAssetCode || handledQrRef.current === initialAssetCode) return;
    const found = assets.find((a) => a.code.toLowerCase() === initialAssetCode.toLowerCase());
    if (found) {
      handledQrRef.current = initialAssetCode;
      setTicketAsset(found);
    }
  }, [assets, initialAssetCode]);

  const accessibleLabs = useMemo(() => {
    if (currentProfile.lab_id) {
      const own = laboratories.filter((l) => l.id === currentProfile.lab_id);
      if (own.length > 0) return own;
    }
    return laboratories;
  }, [currentProfile.lab_id, laboratories]);

  const labAssets = useMemo(
    () => (selectedLabId === "all" ? assets : assets.filter((a) => a.laboratory_id === selectedLabId)),
    [assets, selectedLabId],
  );

  const visibleAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return labAssets;
    return labAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [labAssets, search]);

  const totalUnits = useMemo(() => labAssets.reduce((sum, a) => sum + a.quantity, 0), [labAssets]);
  const openTicketsCount = tickets.filter((t) => t.status !== "Concluído").length;
  const closedTicketsCount = tickets.filter((t) => t.status === "Concluído").length;
  const chatTicket: HelpTicket | null = tickets.find((t) => t.id === chatTicketId) ?? null;
  const labNameById = (id: string) => laboratories.find((l) => l.id === id)?.name ?? "Laboratório";
  const assignedLab = currentProfile.lab_id ? labNameById(currentProfile.lab_id) : null;

  async function handleConfirmDeleteAsset() {
    if (!assetToDelete) return;
    const target = assetToDelete;
    setAssetToDelete(null);
    const { error } = await supabase.from("assets").delete().eq("id", target.id);
    if (error) {
      toast.error("Não foi possível excluir este equipamento.");
      return;
    }
    toast.success("Ativo removido.");
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <section className="portal-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-brand-teal uppercase">
            Espaço do Professor
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{currentProfile.name}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {assignedLab ?? (currentProfile.department ?? "Informática")}
            {currentProfile.room && !assignedLab?.includes(currentProfile.room)
              ? ` · Sala ${currentProfile.room}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="hero"
          onClick={() => {
            setEditingAsset(null);
            setAssetModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo ativo
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="portal-panel flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal-soft text-brand-teal">
            <Box className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Ativos no laboratório</p>
            <p className="text-2xl font-extrabold text-foreground">{labAssets.length}</p>
            <p className="text-[11px] text-muted-foreground">{totalUnits} unidades totais</p>
          </div>
        </div>
        <div className="portal-panel flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-amber-soft text-status-amber">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Chamados em andamento</p>
            <p className="text-2xl font-extrabold text-foreground">{openTicketsCount}</p>
            <p className="text-[11px] text-muted-foreground">Aguardando atendimento</p>
          </div>
        </div>
        <div className="portal-panel flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-lime-soft text-status-lime-foreground">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Chamados concluídos</p>
            <p className="text-2xl font-extrabold text-foreground">{closedTicketsCount}</p>
            <p className="text-[11px] text-muted-foreground">Resolvidos pela equipe</p>
          </div>
        </div>
      </div>

      {activeTab === "catalog" ? (
        <section className="space-y-4">
          <div className="portal-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:min-w-[300px]">
              <label htmlFor="user-lab-select" className="text-xs font-bold text-muted-foreground">
                Sala
              </label>
              <select id="user-lab-select" value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} className="portal-select w-full">
                {accessibleLabs.length > 1 ? <option value="all">Todos os laboratórios</option> : null}
                {accessibleLabs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar equipamento por nome ou código..."
                className="pl-9"
              />
            </div>
          </div>

          {visibleAssets.length === 0 ? (
            <div className="portal-panel p-10 text-center text-sm text-muted-foreground">
              Nenhum equipamento encontrado para o filtro atual.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleAssets.map((asset) => (
                <article key={asset.id} className="portal-panel flex flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-mono text-[11px]">{asset.code}</Badge>
                    <span className="rounded-full bg-brand-teal-soft px-2.5 py-0.5 text-xs font-bold text-brand-teal">
                      {asset.quantity} {asset.quantity === 1 ? "unidade" : "unidades"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-extrabold text-foreground">{asset.name}</h2>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{labNameById(asset.laboratory_id)}</p>
                  <p className="mt-2.5 flex-1 text-xs leading-relaxed text-muted-foreground">{asset.description}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
                    <Button type="button" size="sm" variant="hero" onClick={() => setTicketAsset(asset)}>
                      <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                      Abrir chamado
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => setQrAsset(asset)} title="Etiqueta QR">
                        <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                        QR
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Editar ativo"
                        onClick={() => {
                          setEditingAsset(asset);
                          setAssetModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Excluir ativo" onClick={() => setAssetToDelete(asset)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="portal-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-extrabold text-foreground">Histórico de chamados ({tickets.length})</h2>
            <p className="text-xs text-muted-foreground">Acompanhe o andamento das suas ocorrências e responda à equipe técnica.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-border bg-canvas-surface text-xs font-bold text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Chamado</th>
                  <th className="px-4 py-3">Evidência</th>
                  <th className="px-4 py-3">Ativo e série</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      Você ainda não abriu nenhum chamado técnico.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-canvas-surface/50">
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs font-bold text-foreground">{ticket.id}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(ticket.created_at))}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {ticket.photo_url ? (
                          <img src={ticket.photo_url} alt="Evidência" className="h-10 w-10 rounded-lg border border-border object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{ticket.asset_name}</p>
                        <p className="text-xs text-muted-foreground">{ticket.serial}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground">{ticket.request_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            ticket.priority === "Alta"
                              ? "bg-status-coral-soft text-status-coral"
                              : ticket.priority === "Baixa"
                                ? "bg-muted text-muted-foreground"
                                : "bg-status-amber-soft text-status-amber"
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            ticket.status === "Concluído"
                              ? "bg-status-lime-soft text-status-lime-foreground"
                              : ticket.status === "Aguardando Peça"
                                ? "bg-brand-teal-soft text-brand-teal"
                                : "bg-status-amber-soft text-status-amber"
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => setChatTicketId(ticket.id)}>
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Conversa ({ticket.messages.length})
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "messages" ? (
        <DirectMessagesPanel
          role="user"
          currentProfile={currentProfile}
          profiles={profiles}
          directMessages={directMessages}
          onRefresh={onRefresh}
        />
      ) : null}

      <AssetDialog
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        editingAsset={editingAsset}
        defaultLabId={selectedLabId === "all" ? (accessibleLabs[0]?.id ?? "") : selectedLabId}
        laboratories={accessibleLabs}
        onSaved={onRefresh}
      />
      <OpenTicketDialog
        asset={ticketAsset}
        lab={ticketAsset ? (laboratories.find((l) => l.id === ticketAsset.laboratory_id) ?? null) : null}
        currentProfile={currentProfile}
        onOpenChange={(open) => {
          if (!open) setTicketAsset(null);
        }}
        onCreated={onRefresh}
      />
      <QrCodeDialog
        asset={qrAsset}
        labName={qrAsset ? labNameById(qrAsset.laboratory_id) : ""}
        onOpenChange={(open) => {
          if (!open) setQrAsset(null);
        }}
      />
      <TicketChatDialog
        ticket={chatTicket}
        role="user"
        currentProfile={currentProfile}
        onOpenChange={(open) => {
          if (!open) setChatTicketId(null);
        }}
        onUpdated={onRefresh}
      />
      <ConfirmActionDialog
        open={Boolean(assetToDelete)}
        title="Remover equipamento?"
        description={
          assetToDelete
            ? `Deseja remover "${assetToDelete.name}" (${assetToDelete.code}) do catálogo?`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void handleConfirmDeleteAsset()}
        onOpenChange={(open) => {
          if (!open) setAssetToDelete(null);
        }}
      />
    </div>
  );
}