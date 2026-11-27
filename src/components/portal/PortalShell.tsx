import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, LogOut, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { AppRole, HelpNotification, HelpProfile } from "@/lib/help.types";
import helpLogo from "@/assets/help-logo.png";

export interface PortalNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export interface PortalNavGroup {
  title: string;
  items: PortalNavItem[];
}

export function PortalShell({
  role,
  profile,
  notifications,
  navGroups,
  activeTab,
  onTabChange,
  onOpenProfile,
  onSignOut,
  onMarkAllRead,
  onOpenNotification,
  children,
}: {
  role: AppRole;
  profile: HelpProfile;
  notifications: HelpNotification[];
  navGroups: PortalNavGroup[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  onMarkAllRead: () => void;
  onOpenNotification: (id: string, type: string) => void;
  children: ReactNode;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const allItems = navGroups.flatMap((g) => g.items);

  return (
    <div className="min-h-screen bg-canvas-surface text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <img src={helpLogo} alt="Help!" className="h-8 w-auto object-contain dark:brightness-125" />
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase ${
                  role === "admin"
                    ? "bg-navy text-navy-foreground"
                    : "bg-brand-teal-soft text-brand-teal"
                }`}
              >
                {role === "admin" ? "Admin" : "Professor"}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Início
              </Link>
            </Button>

            <ThemeToggle />

            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="relative" aria-label="Notificações">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-coral px-1 text-[10px] font-bold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-xs font-extrabold text-foreground">Notificações</span>
                  {unreadCount > 0 ? (
                    <button type="button" onClick={onMarkAllRead} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
                      Marcar lidas
                    </button>
                  ) : null}
                </div>
                <div className="max-h-72 divide-y divide-border/70 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma notificação por enquanto.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenNotification(n.id, n.type)}
                        className={`block w-full px-4 py-3 text-left text-xs transition-colors hover:bg-muted/60 cursor-pointer ${
                          n.read ? "opacity-75" : "bg-brand-teal-soft/40 font-semibold"
                        }`}
                      >
                        <p className="text-foreground">{n.text}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(n.created_at))}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-muted cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-brand-teal-soft text-xs font-extrabold text-brand-teal">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  profile.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="hidden md:block">
                <span className="block max-w-[150px] truncate text-xs font-bold leading-tight text-foreground">
                  {profile.name}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {role === "admin" ? "Administrador" : profile.room ? `Sala ${profile.room}` : "Professor"}
                </span>
              </span>
            </button>

            <Button type="button" variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Mobile & tablet navigation bar */}
        <nav aria-label="Navegação do portal" className="border-t border-border/80 bg-canvas-surface/70 px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-1.5">
            {allItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? role === "admin"
                        ? "bg-navy text-navy-foreground shadow-sm"
                        : "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground border border-border hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                  {typeof item.count === "number" && item.count > 0 ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? "bg-background/20" : "bg-muted text-foreground"}`}>
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="hidden lg:block">
          <nav aria-label="Menu lateral do portal" className="sticky top-20 space-y-5 portal-panel p-3.5">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-2.5 pb-1 text-[10px] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? role === "admin"
                            ? "bg-navy text-navy-foreground shadow-sm"
                            : "bg-brand-teal-soft text-brand-teal"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.count === "number" && item.count > 0 ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            active
                              ? role === "admin"
                                ? "bg-background/20 text-navy-foreground"
                                : "bg-background text-brand-teal"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}