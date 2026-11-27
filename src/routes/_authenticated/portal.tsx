import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Box,
  ClipboardList,
  FileDown,
  LayoutDashboard,
  MessageSquare,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalBootstrapFn } from "@/lib/help.functions";
import { UserDashboard } from "@/components/portal/UserDashboard";
import { AdminDashboard } from "@/components/portal/AdminDashboard";
import { ProfileDialog } from "@/components/portal/PortalModals";
import { PortalShell, type PortalNavGroup } from "@/components/portal/PortalShell";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const portalQueryOptions = queryOptions({
  queryKey: ["help-portal-bootstrap"],
  queryFn: () => getPortalBootstrapFn(),
});

export const Route = createFileRoute("/_authenticated/portal")({
  validateSearch: (search: Record<string, unknown>): { asset?: string } => {
    const raw = typeof search["asset"] === "string" ? search["asset"].trim() : "";
    return raw ? { asset: raw } : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(portalQueryOptions),
  head: () => ({
    meta: [
      { title: "Portal — Help! Gestão de Ativos e Chamados" },
      {
        name: "description",
        content: "Gerencie ativos, laboratórios, chamados técnicos e mensagens no portal Help!.",
      },
      { property: "og:title", content: "Portal Help!" },
      { property: "og:description", content: "Portal interno de gestão Help!." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { asset: initialAssetCode } = Route.useSearch();
  const { data, isFetching, refetch } = useSuspenseQuery(portalQueryOptions);

  usePortalRealtime(data.currentProfile.id);

  const [userTab, setUserTab] = useState("catalog");
  const [adminTab, setAdminTab] = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);

  const openTicketsCount = data.tickets.filter((t) => t.status !== "Concluído").length;
  const userVisibleAssetsCount = data.currentProfile.lab_id
    ? data.assets.filter((a) => a.laboratory_id === data.currentProfile.lab_id).length
    : data.assets.length;

  const navGroups = useMemo<PortalNavGroup[]>(() => {
    if (data.role === "admin") {
      return [
        {
          title: "Painel",
          items: [
            { id: "overview", label: "Visão geral", icon: LayoutDashboard },
            { id: "charts", label: "Gráficos", icon: BarChart3 },
          ],
        },
        {
          title: "Operação",
          items: [
            { id: "tickets", label: "Chamados", icon: Wrench, count: openTicketsCount },
            { id: "catalog", label: "Catálogo", icon: Box, count: data.assets.length },
            { id: "users", label: "Usuários e labs", icon: Users, count: data.profiles.length },
          ],
        },
        {
          title: "Relatórios e contato",
          items: [
            { id: "reports", label: "Relatórios PNG", icon: FileDown },
            { id: "messages", label: "Mensagens", icon: MessageSquare },
          ],
        },
      ];
    }
    return [
      {
        title: "Meu espaço",
        items: [
          { id: "catalog", label: "Catálogo de ativos", icon: Box, count: userVisibleAssetsCount },
          { id: "history", label: "Meus chamados", icon: ClipboardList, count: openTicketsCount },
          { id: "messages", label: "Mensagens", icon: MessageSquare },
        ],
      },
    ];
  }, [data.assets.length, data.profiles.length, data.role, openTicketsCount, userVisibleAssetsCount]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/login", search: { redirect: "/portal" }, replace: true });
  }

  async function handleMarkAllRead() {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_profile_id", data.currentProfile.id)
      .eq("read", false);
    void refetch();
  }

  async function handleOpenNotification(id: string, type: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (type.includes("message")) {
      if (data.role === "admin") setAdminTab("messages");
      else setUserTab("messages");
    } else if (type.includes("ticket")) {
      if (data.role === "admin") setAdminTab("tickets");
      else setUserTab("history");
    }
    void refetch();
  }

  return (
    <>
      <PortalShell
        role={data.role}
        profile={data.currentProfile}
        notifications={data.notifications}
        navGroups={navGroups}
        activeTab={data.role === "admin" ? adminTab : userTab}
        onTabChange={data.role === "admin" ? setAdminTab : setUserTab}
        onOpenProfile={() => setProfileOpen(true)}
        onSignOut={() => void handleSignOut()}
        onMarkAllRead={() => void handleMarkAllRead()}
        onOpenNotification={(id, type) => void handleOpenNotification(id, type)}
      >
        {data.role === "admin" ? (
          <AdminDashboard
            data={data}
            activeTab={adminTab}
            onTabChange={setAdminTab}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            initialAssetCode={initialAssetCode ?? null}
          />
        ) : (
          <UserDashboard
            data={data}
            activeTab={userTab}
            onRefresh={() => void refetch()}
            initialAssetCode={initialAssetCode ?? null}
          />
        )}
      </PortalShell>
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={data.currentProfile}
        onUpdated={() => void refetch()}
        onSignOut={() => void handleSignOut()}
      />
    </>
  );
}