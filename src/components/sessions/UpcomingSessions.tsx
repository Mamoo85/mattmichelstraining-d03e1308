import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Booking {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  amount_cents: number;
}

const UpcomingSessions = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("session_bookings")
      .select("id, slot_date, start_time, duration_minutes, status, amount_cents")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gte("slot_date", today)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data }) => {
        setBookings((data as Booking[]) || []);
        setLoading(false);
      });
  }, [user]);

  const handleCancel = async (booking: Booking) => {
    if (!confirm("Cancel this session? You'll receive a full refund.")) return;
    setCancellingId(booking.id);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-session", {
        body: { bookingId: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      toast({ title: "Session cancelled", description: "Your refund is being processed." });
    } catch (e: any) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  if (loading) return null;
  if (bookings.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Upcoming Sessions
          </span>
        </div>
        <Link
          to="/schedule"
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
        >
          Book More →
        </Link>
      </div>

      <div className="space-y-2">
        {bookings.map((b) => (
          <div key={b.id} className="bg-card border border-border p-4 flex items-center gap-4">
            {/* Date badge */}
            <div className="bg-primary/10 border border-primary/20 px-3 py-2 text-center shrink-0 min-w-[70px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                {formatDate(b.slot_date).split(" ")[0]}
              </span>
              <span className="text-lg font-mono font-bold text-foreground block leading-tight">
                {formatDate(b.slot_date) === "Today" || formatDate(b.slot_date) === "Tomorrow"
                  ? formatDate(b.slot_date)
                  : formatDate(b.slot_date).split(" ").slice(1).join(" ")}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-bold text-foreground">
                  {formatTime(b.start_time)}
                </span>
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 font-bold uppercase tracking-widest">
                  {b.duration_minutes} min
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={10} />
                M² Training Studio
              </div>
            </div>

            {/* Cancel */}
            <button
              onClick={() => handleCancel(b)}
              disabled={cancellingId === b.id}
              className="text-muted-foreground hover:text-destructive transition-all p-2 shrink-0"
              title="Cancel session"
            >
              {cancellingId === b.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingSessions;
