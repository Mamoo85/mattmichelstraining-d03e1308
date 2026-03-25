import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useBrowserNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || typeof Notification === "undefined") return;

    // Request permission on mount
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Subscribe to realtime notifications
    const channel = supabase
      .channel("browser-notifs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (Notification.permission === "granted") {
            const { title, body } = payload.new as { title: string; body: string | null };
            new Notification(title, {
              body: body || undefined,
              icon: "/pwa-192x192.png",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
