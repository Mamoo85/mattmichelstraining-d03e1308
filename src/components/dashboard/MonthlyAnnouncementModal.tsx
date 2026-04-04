import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Target, Trophy, Megaphone } from "lucide-react";

interface AnnouncementData {
  type: "focus" | "challenge" | "broadcast";
  title: string;
  subtitle: string;
  detail?: string;
}

export default function MonthlyAnnouncementModal() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const storageKey = `m2_seen_announcements_${currentYear}_${currentMonth}`;

  const { data: focus } = useQuery({
    queryKey: ["monthly-focus-popup", currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_focus")
        .select("title, topic")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("status", "published")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: challenge } = useQuery({
    queryKey: ["monthly-challenge-popup", currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_challenges")
        .select("title, description, metric_label")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: broadcast } = useQuery({
    queryKey: ["admin-broadcast-popup", currentMonth, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("title, body")
        .eq("type", "broadcast")
        .gte("created_at", new Date(currentYear, currentMonth - 1, 1).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const seen = localStorage.getItem(storageKey);
    if (seen) {
      setDismissed(true);
      return;
    }

    const items: AnnouncementData[] = [];
    if (focus) {
      items.push({
        type: "focus",
        title: focus.title,
        subtitle: `This Month's Focus: ${focus.topic}`,
      });
    }
    if (challenge) {
      items.push({
        type: "challenge",
        title: challenge.title,
        subtitle: challenge.description || "",
        detail: challenge.metric_label ? `Track: ${challenge.metric_label}` : undefined,
      });
    }
    if (broadcast) {
      items.push({
        type: "broadcast",
        title: broadcast.title || "Announcement",
        subtitle: broadcast.body || "",
      });
    }

    if (items.length > 0) {
      setAnnouncements(items);
      setDismissed(false);
    }
  }, [user, focus, challenge, broadcast, storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, "true");
  };

  if (dismissed || announcements.length === 0) return null;

  const iconMap = {
    focus: <Target size={20} className="text-primary" />,
    challenge: <Trophy size={20} className="text-yellow-400" />,
    broadcast: <Megaphone size={20} className="text-blue-400" />,
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">What's New This Month</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {now.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="px-6 py-4 space-y-4">
          {announcements.map((a, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="mt-0.5 shrink-0">{iconMap[a.type]}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.subtitle}</p>
                {a.detail && (
                  <p className="text-[10px] text-primary font-semibold mt-1 uppercase tracking-wider">{a.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border">
          <button
            onClick={handleDismiss}
            className="w-full bg-primary text-primary-foreground py-2.5 text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            Let's Go
          </button>
        </div>
      </div>
    </div>
  );
}
