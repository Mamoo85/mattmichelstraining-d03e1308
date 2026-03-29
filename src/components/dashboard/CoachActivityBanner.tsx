import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CoachActivity {
  lastMessageAt: string | null;
  hasUnread: boolean;
}

export default function CoachActivityBanner() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<CoachActivity | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("coach_direct_messages")
          .select("created_at, sender_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!data || data.length === 0) return;

        const lastCoachMsg = data.find((m: { sender_id: string }) => m.sender_id !== user.id);
        const lastUserMsg = data[0];

        // Unread = most recent message was from coach (not user)
        const hasUnread = lastCoachMsg && lastCoachMsg.created_at > (lastUserMsg?.created_at ?? "");

        setActivity({
          lastMessageAt: lastCoachMsg?.created_at ?? null,
          hasUnread: !!hasUnread,
        });
      } catch (e) {
        console.warn("[CoachActivityBanner] Failed to load coach activity:", e);
      }
    };
    load();
  }, [user]);

  if (!activity?.lastMessageAt) return null;

  const lastDate = new Date(activity.lastMessageAt);
  const now = new Date();
  const diffHours = Math.round((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  const timeLabel =
    diffHours < 1 ? "just now" :
    diffHours < 24 ? `${diffHours}h ago` :
    diffDays === 1 ? "yesterday" :
    `${diffDays} days ago`;

  if (activity.hasUnread) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all"
        style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)" }}
      >
        <div className="relative">
          <MessageCircle size={18} style={{ color: "#f97316" }} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white leading-none">Matt replied · {timeLabel}</p>
          <p className="text-[10px] text-orange-300/80 mt-0.5">Tap to read your coaching feedback</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">New</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white/70 leading-none">
          Matt reviewed your last submission · <span className="text-white/50">{timeLabel}</span>
        </p>
      </div>
      <Clock size={13} style={{ color: "#525252" }} />
    </div>
  );
}
