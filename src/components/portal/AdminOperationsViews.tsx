import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, MessageSquare, Pencil, Plus, Power, QrCode, Search, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TICKET_STATUSES, type HelpAsset, type HelpLaboratory, type HelpProfile, type HelpTicket } from "@/lib/help.types";

const STATUS_COLORS = ["var(--status-amber)", "var(--brand-teal)", "var(--status-lime-foreground)"];
const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--foreground)",
  fontSize: "12px",
};

export function AdminChartsView({
  laboratories,
  tickets,
}: {
  laboratories: HelpLaboratory[];
  tickets: HelpTicket[];
}) {
  const inProgressCount = tickets.filter((t) => t.status === "Em Andamento").length;
  const waitingPartCount = tickets.filter((t) => t.status === "Aguardando Peça").length;
  const closedCount = tickets.filter((t) => t.status === "Concluído").length;

  const statusData = [
    { name: "Em Andamento", value: inProgressCount },
    { name: "Aguardando Peça", value: waitingPartCount },
    { name: "Concluído", value: closedCount },
  ];

  const labData = laboratories.map((lab) => ({
    name: lab.room ? `Sala ${lab.room}` : lab.name.slice(0, 14),
    chamados: tickets.filter((t) => t.laboratory_id === lab.id || t.lab_name === lab.name).length,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="portal-panel p-6">
        <h2 className="text-base font-extrabold text-foreground">Chamados por status</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Distribuição entre atendimentos abertos e concluídos.</p>
        <div className="mt-4 h-60">
          {tickets.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem chamados registrados para exibir no gráfico.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
                  {statusData.map((entry, idx) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-4 border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-status-amber" />
            Em andamento ({inProgressCount})
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-teal" />
            Aguardando peça ({waitingPartCount})
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-status-lime-foreground" />
            Concluídos ({closedCount})
          </span>
        </div>
      </section>

      <section className="portal-panel p-6">
        <h2 className="text-base font-extrabold text-foreground">Chamados por laboratório</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Volume acumulado de solicitações por sala.</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={labData}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
              <Bar dataKey="chamados" fill="var(--brand-teal)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export function AdminUsersLabsView({
  profiles,
  laboratories,
  assets,
  onAddProfessor,
  onEditProfessor,
  onToggleProfessor,
  onDeleteProfessor,
  onAddLab,
  onEditLab,
}: {
  profiles: HelpProfile[];
  laboratories: HelpLaboratory[];
  assets: HelpAsset[];
  onAddProfessor: () => void;
  onEditProfessor: (profile: HelpProfile) => void;
  onToggleProfessor: (profile: HelpProfile) => void;
  onDeleteProfessor: (profile: HelpProfile) => void;
  onAddLab: () => void;
  onEditLab: (lab: HelpLaboratory) => void;
}) {
  const labNameById = (id: string) => laboratories.find((l) => l.id === id)?.name ?? "Laboratório";
  const profileNameById = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "Sem responsável";

  return (
    <div className="space-y-6">
      <section className="portal-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Equipe e acessos ({profiles.length})</h2>
            <p className="text-xs text-muted-foreground">Professores e administradores vinculados ao sistema.</p>
          </div>
          <Button type="button" variant="hero" size="sm" onClick={onAddProfessor}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Novo professor
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-canvas-surface text-xs font-bold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Usuário</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Laboratório / sala</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-canvas-surface/50">
                  <td className="px-5 py-3">
                    <p className="font-bold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                      {p.role === "admin" ? "Administrador" : "Professor"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    {p.lab_id ? labNameById(p.lab_id) : "Acesso global"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!p.active ? (
                      <span className="inline-flex items-center rounded-full bg-status-coral-soft px-2.5 py-0.5 font-semibold text-status-coral">
                        Desativado
                      </span>
                    ) : p.auth_user_id ? (
                      <span className="inline-flex items-center rounded-full bg-status-lime-soft px-2.5 py-0.5 font-semibold text-status-lime-foreground">
                        Conta ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                        Aguardando 1º acesso
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.role !== "admin" ? (
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => onEditProfessor(p)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title={p.active ? "Desativar acesso" : "Reativar acesso"}
                          aria-label={p.active ? "Desativar acesso" : "Reativar acesso"}
                          onClick={() => onToggleProfessor(p)}
                        >
                          <Power className={`h-3.5 w-3.5 ${p.active ? "text-status-amber" : "text-brand-teal"}`} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Remover professor"
                          aria-label="Remover professor"
                          onClick={() => onDeleteProfessor(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Laboratórios cadastrados ({laboratories.length})</h2>
            <p className="text-xs text-muted-foreground">Salas, departamentos, responsáveis e ativos vinculados.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAddLab}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo laboratório
          </Button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {laboratories.map((lab) => {
            const labAssets = assets.filter((a) => a.laboratory_id === lab.id);
            const totalUnits = labAssets.reduce((sum, a) => sum + a.quantity, 0);
            return (
              <div key={lab.id} className="flex items-start gap-3.5 rounded-xl border border-border bg-canvas-surface/60 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-soft text-brand-teal">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-extrabold text-foreground">{lab.name}</p>
                    <div className="flex items-center gap-1.5">
                      {!lab.active ? (
                        <span className="rounded-full bg-status-coral-soft px-2 py-0.5 text-[10px] font-bold text-status-coral">
                          Inativo
                        </span>
                      ) : null}
                      <Badge variant="secondary" className="text-[11px]">{lab.department}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Responsável: <strong className="text-foreground">{profileNameById(lab.responsible_profile_id)}</strong>
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {labAssets.length} {labAssets.length === 1 ? "item" : "itens"} · {totalUnits}{" "}
                      {totalUnits === 1 ? "unidade catalogada" : "unidades catalogadas"}
                    </p>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEditLab(lab)}>
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Editar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function AdminCatalogView({
  assets,
  laboratories,
  highlightedCode,
  onOpenQr,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
}: {
  assets: HelpAsset[];
  laboratories: HelpLaboratory[];
  highlightedCode?: string | null;
  onOpenQr: (asset: HelpAsset) => void;
  onAddAsset: () => void;
  onEditAsset: (asset: HelpAsset) => void;
  onDeleteAsset: (asset: HelpAsset) => void;
}) {
  const [labFilter, setLabFilter] = useState("all");
  const [query, setQuery] = useState("");
  const labNameById = (id: string) => laboratories.find((l) => l.id === id)?.name ?? "Laboratório";
  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesLab = labFilter === "all" || a.laboratory_id === labFilter;
      const matchesQ =
        !q ||
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      return matchesLab && matchesQ;
    });
  }, [assets, labFilter, query]);

  return (
    <section className="portal-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-foreground">Catálogo geral ({filteredAssets.length})</h2>
          <p className="text-xs text-muted-foreground">Todos os equipamentos cadastrados nos laboratórios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar código ou item..."
              className="h-9 pl-9 text-xs"
            />
          </div>
          <select id="admin-catalog-lab" aria-label="Filtrar por laboratório" value={labFilter} onChange={(e) => setLabFilter(e.target.value)} className="portal-select">
            <option value="all">Todos os laboratórios</option>
            {laboratories.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button type="button" variant="hero" size="sm" onClick={onAddAsset}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo ativo
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-canvas-surface text-xs font-bold text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Código</th>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Laboratório</th>
              <th className="px-4 py-3">Qtd.</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  Nenhum ativo cadastrado para o filtro atual.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => {
                const isHighlighted =
                  highlightedCode && asset.code.toLowerCase() === highlightedCode.toLowerCase();
                return (
                  <tr
                    key={asset.id}
                    className={isHighlighted ? "bg-brand-teal-soft/50" : "hover:bg-canvas-surface/50"}
                  >
                    <td className="px-5 py-3 font-mono text-xs font-bold text-brand-teal">{asset.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{labNameById(asset.laboratory_id)}</td>
                    <td className="px-4 py-3 font-bold text-foreground">{asset.quantity}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => onOpenQr(asset)}>
                          <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                          QR
                        </Button>
                        <Button type="button" size="icon" variant="ghost" aria-label="Editar ativo" onClick={() => onEditAsset(asset)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" aria-label="Excluir ativo" onClick={() => onDeleteAsset(asset)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminTicketsView({
  tickets,
  laboratories,
  onOpenTicket,
}: {
  tickets: HelpTicket[];
  laboratories: HelpLaboratory[];
  onOpenTicket: (ticketId: string) => void;
}) {
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const departments = useMemo(() => {
    const set = new Set<string>(laboratories.map((l) => l.department));
    tickets.forEach((t) => set.add(t.department));
    return Array.from(set).sort();
  }, [laboratories, tickets]);

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      const matchesDept = deptFilter === "all" || t.department === deptFilter;
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesQuery =
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.asset_name.toLowerCase().includes(q) ||
        t.requester_name.toLowerCase().includes(q) ||
        t.lab_name.toLowerCase().includes(q) ||
        t.serial.toLowerCase().includes(q);
      return matchesDept && matchesStatus && matchesQuery;
    });
  }, [deptFilter, query, statusFilter, tickets]);

  return (
    <section className="portal-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-foreground">Chamados técnicos ({filteredTickets.length})</h2>
          <p className="text-xs text-muted-foreground">Acompanhe, responda e conclua solicitações abertas pelos docentes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar chamado, ativo ou sala..."
              className="h-9 pl-9 text-xs"
            />
          </div>
          <select aria-label="Filtrar por status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="portal-select">
            <option value="all">Todos os status</option>
            {TICKET_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <select id="admin-dept-filter" aria-label="Filtrar por departamento" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="portal-select">
            <option value="all">Todos os deptos.</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] text-left text-sm">
          <thead className="border-b border-border bg-canvas-surface text-xs font-bold text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Chamado</th>
              <th className="px-4 py-3">Departamento / Lab</th>
              <th className="px-4 py-3">Ativo e série</th>
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                  Nenhum chamado encontrado para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-canvas-surface/50">
                  <td className="px-5 py-3 font-mono text-xs font-bold text-foreground">{ticket.id}</td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold text-foreground">{ticket.department}</p>
                    <p className="text-muted-foreground">{ticket.lab_name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold text-foreground">{ticket.asset_name}</p>
                    <p className="text-muted-foreground">{ticket.serial}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">{ticket.requester_name}</td>
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
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenTicket(ticket.id)}>
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      Atender ({ticket.messages.length})
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}