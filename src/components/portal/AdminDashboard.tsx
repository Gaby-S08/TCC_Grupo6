import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  MessageSquare,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminManageProfessorFn } from "@/lib/help.functions";
import { exportLabAssetsCsv, exportLabReportPng, exportLabTicketsCsv } from "@/lib/report-png";
import type {
  HelpAsset,
  HelpLaboratory,
  HelpProfile,
  HelpTicket,
  PortalBootstrapData,
} from "@/lib/help.types";
import {
  AdminCatalogView,
  AdminChartsView,
  AdminTicketsView,
  AdminUsersLabsView,
} from "./AdminOperationsViews";
import { DirectMessagesPanel } from "./DirectMessagesPanel";
import {
  AssetDialog,
  ConfirmActionDialog,
  EditProfessorDialog,
  LabDialog,
  ProfessorDialog,
  QrCodeDialog,
  TicketChatDialog,
} from "./PortalModals";

export function AdminDashboard({
  data,
  activeTab,
  onTabChange,
  onRefresh,
  isRefreshing,
  initialAssetCode,
}: {
  data: PortalBootstrapData;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  initialAssetCode?: string | null;
}) {
  const { currentProfile, profiles, laboratories, assets, tickets, directMessages } = data;
  const manageProfessor = useServerFn(adminManageProfessorFn);

  const [reportLabId, setReportLabId] = useState(laboratories[0]?.id ?? "");
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<HelpLaboratory | null>(null);
  const [profModalOpen, setProfModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<HelpProfile | null>(null);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<HelpAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<HelpAsset | null>(null);
  const [profToDelete, setProfToDelete] = useState<HelpProfile | null>(null);
  const [chatTicketId, setChatTicketId] = useState<string | null>(null);
  const [qrAsset, setQrAsset] = useState<HelpAsset | null>(null);

  useEffect(() => {
    if (!initialAssetCode) return;
    const found = assets.find((a) => a.code.toLowerCase() === initialAssetCode.toLowerCase());
    if (found) {
      onTabChange("catalog");
    }
  }, [assets, initialAssetCode, onTabChange]);

  async function handleConfirmDeleteAsset() {
    if (!assetToDelete) return;
    const target = assetToDelete;
    setAssetToDelete(null);
    const { error } = await supabase.from("assets").delete().eq("id", target.id);
    if (error) {
      toast.error("Não foi possível excluir este equipamento.");
      return;
    }
    toast.success("Equipamento removido do catálogo.");
    onRefresh();
  }

  async function handleToggleProfessor(prof: HelpProfile) {
    try {
      const res = await manageProfessor({ data: { profileId: prof.id, action: "toggle" } });
      toast.success(res.mode === "activated" ? "Acesso reativado." : "Acesso desativado.");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar status do professor.");
    }
  }

  async function handleConfirmDeleteProfessor() {
    if (!profToDelete) return;
    const target = profToDelete;
    setProfToDelete(null);
    try {
      const res = await manageProfessor({ data: { profileId: target.id, action: "delete" } });
      toast.success(
        res.mode === "deactivated_history"
          ? "Professor desativado e desvinculado da sala (mantido no histórico de chamados)."
          : "Professor removido do sistema.",
      );
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover professor.");
    }
  }

  const openTicketsCount = tickets.filter((t) => t.status !== "Concluído").length;
  const closedTicketsCount = tickets.filter((t) => t.status === "Concluído").length;
  const totalUnits = useMemo(() => assets.reduce((sum, a) => sum + a.quantity, 0), [assets]);
  const chatTicket: HelpTicket | null = tickets.find((t) => t.id === chatTicketId) ?? null;
  const labNameById = (id: string) => laboratories.find((l) => l.id === id)?.name ?? "Laboratório";
  const profileNameById = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "Sem responsável";

  const selectedReportLab = laboratories.find((l) => l.id === reportLabId) ?? laboratories[0] ?? null;
  const reportAssets = selectedReportLab
    ? assets.filter((a) => a.laboratory_id === selectedReportLab.id)
    : [];
  const reportTickets = selectedReportLab
    ? tickets.filter((t) => t.laboratory_id === selectedReportLab.id || t.lab_name === selectedReportLab.name)
    : [];

  return (
    <div className="space-y-6">
      <section className="portal-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-brand-teal uppercase">
            Visão Administrativa
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Gestão global de chamados e laboratórios
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="hero"
            size="sm"
            onClick={() => {
              setEditingLab(null);
              setLabModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo laboratório
          </Button>
        </div>
      </section>

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="portal-panel flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-amber-soft text-status-amber">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Em andamento</p>
                <p className="text-2xl font-extrabold text-foreground">{openTicketsCount}</p>
              </div>
            </div>
            <div className="portal-panel flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-lime-soft text-status-lime-foreground">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-extrabold text-foreground">{closedTicketsCount}</p>
              </div>
            </div>
            <div className="portal-panel flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal-soft text-brand-teal">
                <Box className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Ativos catalogados</p>
                <p className="text-2xl font-extrabold text-foreground">{assets.length}</p>
                <p className="text-[11px] text-muted-foreground">{totalUnits} unidades</p>
              </div>
            </div>
            <div className="portal-panel flex items-center gap-3.5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Laboratórios</p>
                <p className="text-2xl font-extrabold text-foreground">{laboratories.length}</p>
                <p className="text-[11px] text-muted-foreground">{profiles.length} usuários</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            <section className="portal-panel overflow-hidden xl:col-span-7">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Últimos chamados</h2>
                  <p className="text-xs text-muted-foreground">Acompanhamento rápido das solicitações recentes.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("tickets")}>
                  Ver todos
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
              <div className="divide-y divide-border/70">
                {tickets.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum chamado registrado até o momento.
                  </p>
                ) : (
                  tickets.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas-surface/50">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-teal">{ticket.id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              ticket.status === "Concluído"
                                ? "bg-status-lime-soft text-status-lime-foreground"
                                : ticket.status === "Aguardando Peça"
                                  ? "bg-brand-teal-soft text-brand-teal"
                                  : "bg-status-amber-soft text-status-amber"
                            }`}
                          >
                            {ticket.status}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            · {ticket.priority}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{ticket.asset_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ticket.lab_name} · {ticket.requester_name}
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => setChatTicketId(ticket.id)}>
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        Atender
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="portal-panel overflow-hidden xl:col-span-5">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Laboratórios ativos</h2>
                  <p className="text-xs text-muted-foreground">Salas e professores responsáveis.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("users")}>
                  Gerenciar
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
              <div className="divide-y divide-border/70">
                {laboratories.map((lab) => {
                  const labAssetCount = assets.filter((a) => a.laboratory_id === lab.id).length;
                  return (
                    <div key={lab.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{lab.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profileNameById(lab.responsible_profile_id)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-canvas-surface px-2.5 py-1 text-xs font-bold text-foreground">
                        {labAssetCount} {labAssetCount === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === "charts" ? <AdminChartsView laboratories={laboratories} tickets={tickets} /> : null}

      {activeTab === "users" ? (
        <AdminUsersLabsView
          profiles={profiles}
          laboratories={laboratories}
          assets={assets}
          onAddProfessor={() => setProfModalOpen(true)}
          onEditProfessor={(prof) => setEditingProfessor(prof)}
          onToggleProfessor={(prof) => void handleToggleProfessor(prof)}
          onDeleteProfessor={(prof) => setProfToDelete(prof)}
          onAddLab={() => {
            setEditingLab(null);
            setLabModalOpen(true);
          }}
          onEditLab={(lab) => {
            setEditingLab(lab);
            setLabModalOpen(true);
          }}
        />
      ) : null}

      {activeTab === "catalog" ? (
        <AdminCatalogView
          assets={assets}
          laboratories={laboratories}
          highlightedCode={initialAssetCode ?? null}
          onOpenQr={(asset) => setQrAsset(asset)}
          onAddAsset={() => {
            setEditingAsset(null);
            setAssetModalOpen(true);
          }}
          onEditAsset={(asset) => {
            setEditingAsset(asset);
            setAssetModalOpen(true);
          }}
          onDeleteAsset={(asset) => setAssetToDelete(asset)}
        />
      ) : null}

      {activeTab === "tickets" ? (
        <AdminTicketsView tickets={tickets} laboratories={laboratories} onOpenTicket={(id) => setChatTicketId(id)} />
      ) : null}

      {activeTab === "reports" ? (
        <section className="portal-panel space-y-5 p-6">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Relatório visual por laboratório</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Escolha a sala para conferir os indicadores e baixar o resumo completo em PNG ou planilhas CSV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={reportLabId} onChange={(e) => setReportLabId(e.target.value)} className="portal-select min-w-[260px]">
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="hero"
              onClick={() => {
                if (selectedReportLab) exportLabReportPng(selectedReportLab, assets, tickets);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Gerar imagem PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selectedReportLab) exportLabAssetsCsv(selectedReportLab, assets);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Equipamentos (CSV)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selectedReportLab) exportLabTicketsCsv(selectedReportLab, tickets);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Chamados (CSV)
            </Button>
          </div>
          {selectedReportLab ? (
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
              <div className="rounded-xl bg-canvas-surface p-3.5">
                <p className="text-xs text-muted-foreground">Itens</p>
                <p className="mt-1 text-xl font-extrabold text-foreground">{reportAssets.length}</p>
              </div>
              <div className="rounded-xl bg-canvas-surface p-3.5">
                <p className="text-xs text-muted-foreground">Unidades</p>
                <p className="mt-1 text-xl font-extrabold text-foreground">
                  {reportAssets.reduce((sum, a) => sum + a.quantity, 0)}
                </p>
              </div>
              <div className="rounded-xl bg-canvas-surface p-3.5">
                <p className="text-xs text-muted-foreground">Chamados abertos</p>
                <p className="mt-1 text-xl font-extrabold text-foreground">
                  {reportTickets.filter((t) => t.status !== "Concluído").length}
                </p>
              </div>
              <div className="rounded-xl bg-canvas-surface p-3.5">
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="mt-1 text-xl font-extrabold text-foreground">
                  {reportTickets.filter((t) => t.status === "Concluído").length}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "messages" ? (
        <DirectMessagesPanel
          role="admin"
          currentProfile={currentProfile}
          profiles={profiles}
          directMessages={directMessages}
          onRefresh={onRefresh}
          onEditProfessor={(prof) => setEditingProfessor(prof)}
        />
      ) : null}

      <LabDialog
        open={labModalOpen}
        onOpenChange={setLabModalOpen}
        editingLab={editingLab}
        onSaved={onRefresh}
      />
      <AssetDialog
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        editingAsset={editingAsset}
        defaultLabId={laboratories[0]?.id ?? ""}
        laboratories={laboratories}
        onSaved={onRefresh}
      />
      <ProfessorDialog open={profModalOpen} onOpenChange={setProfModalOpen} laboratories={laboratories} onSaved={onRefresh} />
      <EditProfessorDialog
        profile={editingProfessor}
        laboratories={laboratories}
        onOpenChange={(open) => {
          if (!open) setEditingProfessor(null);
        }}
        onSaved={onRefresh}
      />
      <TicketChatDialog
        ticket={chatTicket}
        role="admin"
        currentProfile={currentProfile}
        onOpenChange={(open) => {
          if (!open) setChatTicketId(null);
        }}
        onUpdated={onRefresh}
      />
      <QrCodeDialog
        asset={qrAsset}
        labName={qrAsset ? labNameById(qrAsset.laboratory_id) : ""}
        onOpenChange={(open) => {
          if (!open) setQrAsset(null);
        }}
      />
      <ConfirmActionDialog
        open={Boolean(assetToDelete)}
        title="Remover equipamento?"
        description={
          assetToDelete
            ? `O equipamento "${assetToDelete.name}" (${assetToDelete.code}) será excluído do catálogo.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void handleConfirmDeleteAsset()}
        onOpenChange={(open) => {
          if (!open) setAssetToDelete(null);
        }}
      />
      <ConfirmActionDialog
        open={Boolean(profToDelete)}
        title="Remover professor?"
        description={
          profToDelete
            ? `Deseja remover "${profToDelete.name}"? Se já houver chamados registrados por este docente, o acesso será desativado preservando o histórico.`
            : ""
        }
        confirmLabel="Remover"
        destructive
        onConfirm={() => void handleConfirmDeleteProfessor()}
        onOpenChange={(open) => {
          if (!open) setProfToDelete(null);
        }}
      />
    </div>
  );
}