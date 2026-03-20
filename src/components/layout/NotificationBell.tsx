import { useState, useEffect, useRef } from "react";
import { Bell, MessageSquare, Check, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data as unknown as Notification[]);
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications" as any).update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications" as any).update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications" as any).update({ is_deleted: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications" as any).update({ is_deleted: true, is_read: true }).in("id", ids);
    setNotifications([]);
    setClearAllConfirm(false);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground transition-all"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1 animate-in fade-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 max-h-[400px] overflow-y-auto bg-card border border-border shadow-lg z-50"
          style={{ boxShadow: "0 8px 30px hsl(0 0% 0% / 0.4)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Notifications
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-all flex items-center gap-1"
                >
                  <Check size={10} />
                  Read All
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => setClearAllConfirm(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:opacity-80 transition-all flex items-center gap-1"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={20} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-0 ${!n.is_read ? "bg-primary/5" : ""}`}>
                  <button
                    onClick={() => handleClick(n)}
                    className="flex-1 text-left px-3 py-3 flex items-start gap-2.5 hover:bg-muted/50 transition-all min-w-0"
                  >
                    <div
                      className={`mt-0.5 flex-shrink-0 w-7 h-7 flex items-center justify-center ${
                        !n.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <MessageSquare size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <span className="text-[9px] text-muted-foreground/70 font-mono mt-1 block">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="p-2 mt-2 mr-1 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                    title="Delete notification"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmActionModal
        open={clearAllConfirm}
        onOpenChange={setClearAllConfirm}
        onConfirm={clearAll}
        title="Clear All Notifications"
        description="Remove all notifications? This cannot be undone."
        confirmLabel="Clear All"
      />
    </div>
  );
};

export default NotificationBell;
