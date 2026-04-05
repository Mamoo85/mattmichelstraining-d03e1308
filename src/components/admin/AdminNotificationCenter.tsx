/**
 * AdminNotificationCenter — smart notification panel with urgency-based tabs.
 * Shows action required, hot leads, FYI, and celebrations separately.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, AlertCircle, Flame, Info, PartyPopper,
  CheckCheck, Loader2, ExternalLink, Trash2,
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  urgency: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

const TABS = [
  { key: "all", label: "All", icon: Bell, color: "text-foreground" },
  { key: "action", label: "Action", icon: AlertCircle, color: "text-red-400" },
  { key: "hot_lead", label: "Hot Leads", icon: Flame, color: "text-orange-400" },
  { key: "fyi", label: "FYI", icon: Info, color: "text-blue-400" },
  { key: "celebration", label: "Wins", icon: PartyPopper, color: "text-green-400" },
];

export default function AdminNotificationCenter() {
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("id, type, title, body, link, urgency, category, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as Notification[];
    },
    staleTime: 10000,
    refetchInterval: 10000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unread.length === 0) return;
      await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .in("id", unread);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => (n.urgency || "fyi") === activeTab);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const tabCounts = {
    all: notifications.length,
    action: notifications.filter((n) => n.urgency === "action").length,
    hot_lead: notifications.filter((n) => n.urgency === "hot_lead").length,
    fyi: notifications.filter((n) => !n.urgency || n.urgency === "fyi").length,
    celebration: notifications.filter((n) => n.urgency === "celebration").length,
  };

  const urgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "action": return <AlertCircle size={12} className="text-red-400 shrink-0" />;
      case "hot_lead": return <Flame size={12} className="text-orange-400 shrink-0" />;
      case "celebration": return <PartyPopper size={12} className="text-green-400 shrink-0" />;
      default: return <Info size={12} className="text-blue-400 shrink-0" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 h-4">
              {unreadCount} new
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px] gap-1"
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck size={10} /> Mark all read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count = tabCounts[tab.key as keyof typeof tabCounts] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              <tab.icon size={10} className={isActive ? "text-primary" : tab.color} />
              {tab.label}
              {count > 0 && (
                <span className={`text-[8px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`flex gap-2.5 p-3 rounded-lg border transition cursor-pointer hover:bg-muted/10 ${
                n.is_read
                  ? "border-border/20 opacity-60"
                  : "border-border/40 bg-card/80"
              }`}
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.id);
                if (n.link) {
                  window.dispatchEvent(new CustomEvent("navigate-admin", { detail: n.link.replace("/admin#", "") }));
                }
              }}
            >
              {urgencyIcon(n.urgency || "fyi")}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-[11px] font-bold truncate ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                    {n.title}
                  </p>
                  {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                {n.body && (
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                )}
              </div>
              <span className="text-[8px] text-muted-foreground shrink-0 mt-0.5">
                {timeAgo(n.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
