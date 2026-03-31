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

    // Poll for new notifications every 10 seconds
    let lastChecked = new Date().toISOString();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("notifications")
        .select("title, body")
        .eq("user_id", user.id)
        .gt("created_at", lastChecked)
        .order("created_at", { ascending: false });
      if (data && data.length > 0 && Notification.permission === "granted") {
        const n = data[0] as { title: string; body: string | null };
        new Notification(n.title, { body: n.body || undefined, icon: "/pwa-192x192.png" });
      }
      lastChecked = new Date().toISOString();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [user]);
}
