import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePortalRealtime(profileId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["help-portal-bootstrap"] });
      }, 350);
    };

    const channel = supabase
      .channel(`portal-rt-${profileId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, scheduleRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, scheduleRefresh)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${profileId}`,
        },
        scheduleRefresh,
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "assets" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "assets" }, scheduleRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "laboratories" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "laboratories" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);
}