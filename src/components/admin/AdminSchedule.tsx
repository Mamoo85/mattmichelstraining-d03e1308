import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay, subDays, eachDayOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, X, Ban, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AiAssistButton from "./AiAssistButton";

const SLOT_TIMES: string[] = [];
for (let h = 5; h <= 21; h++) {
  SLOT_TIMES.push(`${h.toString().padStart(2, "0")}:00:00`);
  if (h < 21) SLOT_TIMES.push(`${h.toString().padStart(2, "0")}:30:00`);
}

const formatTime12 = (t: string) => {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
};

type Slot = {
  id: string;
  slot_date: string;
  start_time: string;
  is_available: boolean;
  booked_by: string | null;
  booking_id: string | null;
};

type Booking = {
  id: string;
  user_email: string | null;
  user_name: string | null;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  amount_cents: number;
  status: string;
  created_at: string;
  session_type: string;
  credit_id: string | null;
};

const WEEK_OPTIONS = [2, 3, 4, 5, 6];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_OPEN_TIMES = [
  "06:00:00", "06:30:00", "07:00:00", "07:30:00",
  "08:00:00", "08:30:00", "09:00:00",
  "15:00:00", "15:30:00", "16:00:00", "16:30:00",
  "17:00:00", "17:30:00", "18:00:00", "18:30:00",
];

const AdminSchedule = () => {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [bulkWeeks, setBulkWeeks] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTimes, setBulkTimes] = useState<string[]>(DEFAULT_OPEN_TIMES);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const { toast } = useToast();

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const fetchData = async () => {
    setLoading(true);
    const [slotsRes, bookingsRes] = await Promise.all([
      supabase.from("schedule_slots").select("*").eq("slot_date", dateStr),
      supabase.from("session_bookings").select("*").eq("slot_date", dateStr).neq("status", "cancelled"),
    ]);
    setSlots((slotsRes.data as any[]) || []);
    setBookings((bookingsRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateStr]);

  const slotMap = useMemo(() => {
    const m: Record<string, Slot> = {};
    slots.forEach(s => { m[s.start_time] = s; });
    return m;
  }, [slots]);

  const bookingMap = useMemo(() => {
    const m: Record<string, Booking> = {};
    bookings.forEach(b => { m[b.start_time] = b; });
    return m;
  }, [bookings]);

  const toggleSlot = async (time: string) => {
    setToggling(time);
    const existing = slotMap[time];
    if (existing) {
      if (existing.booked_by) {
        toast({ title: "Slot is booked", description: "Cancel the booking first.", variant: "destructive" });
        setToggling(null);
        return;
      }
      const { error } = await supabase.from("schedule_slots").update({ is_available: !existing.is_available }).eq("id", existing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("schedule_slots").insert({ slot_date: dateStr, start_time: time, is_available: true });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    await fetchData();
    setToggling(null);
  };

  const cancelBooking = async (booking: Booking) => {
    if (!confirm(`Cancel this booking and refund $${(booking.amount_cents / 100).toFixed(2)} to ${booking.user_email}?`)) return;
    setCancelling(booking.id);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-session", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Booking cancelled", description: "Refund issued and user notified." });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  const bulkPopulate = async (weeks: number) => {
    const dayNames = selectedDays.map(d => DAY_LABELS[d]).join(", ");
    if (!confirm(`Open slots for the next ${weeks} weeks (${bulkTimes.length} time slots/day on ${dayNames})? This won't overwrite existing booked slots.`)) return;
    setBulkLoading(true);
    try {
      const startDate = startOfDay(new Date());
      const endDate = addDays(startDate, weeks * 7 - 1);
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const days = allDays.filter(d => selectedDays.includes(d.getDay()));

      const rows = days.flatMap(day =>
        bulkTimes.map(time => ({
          slot_date: format(day, "yyyy-MM-dd"),
          start_time: time,
          is_available: true,
        }))
      );

      // Batch insert in chunks of 500
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("schedule_slots")
          .upsert(chunk, { onConflict: "slot_date,start_time", ignoreDuplicates: false });
        if (error) throw error;
        inserted += chunk.length;
      }

      toast({ title: "Slots populated", description: `Opened ${inserted} slots across ${days.length} days.` });
      setBulkWeeks(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Bulk populate failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const aiContext = useMemo(() => {
    const bookedTimes = bookings.map(b => `${b.start_time} (${b.duration_minutes}min, ${b.user_name || b.user_email})`);
    const availableTimes = SLOT_TIMES.filter(t => {
      const s = slotMap[t];
      return s?.is_available && !s?.booked_by && !bookingMap[t];
    }).map(t => formatTime12(t));
    return {
      date: dateStr,
      dayOfWeek: format(selectedDate, "EEEE"),
      totalBookings: bookings.length,
      bookedTimes: bookedTimes.join(", ") || "None",
      currentAvailable: availableTimes.join(", ") || "None",
      totalSlots: SLOT_TIMES.length,
    };
  }, [dateStr, selectedDate, bookings, slotMap, bookingMap]);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between bg-card shadow-m2 p-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <div className="text-center">
          <div className="text-sm font-bold text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</div>
          <div className="text-[10px] text-muted-foreground">Click a time slot to toggle availability</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* AI Suggest */}
      <div className="flex items-center gap-2">
        <AiAssistButton
          type="schedule_suggest"
          context={aiContext}
          onResult={(text) => setAiSuggestion(text)}
          label="AI Suggest Slots"
        />
        {aiSuggestion && (
          <button onClick={() => setAiSuggestion(null)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>
      {aiSuggestion && (
        <div className="bg-accent/20 border border-accent p-3 text-xs text-foreground whitespace-pre-wrap">
          <div className="text-[9px] font-bold uppercase tracking-widest text-accent-foreground mb-1">AI Recommendation</div>
          {aiSuggestion}
        </div>
      )}

      {/* Bulk Populate */}
      <div className="bg-card shadow-m2 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bulk Open Slots</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Populate availability for multiple weeks at once</p>
          </div>
          <CalendarPlus size={16} className="text-primary" />
        </div>

        <div className="flex flex-wrap gap-2">
          {WEEK_OPTIONS.map(w => (
            <Button
              key={w}
              size="sm"
              variant={bulkWeeks === w ? "default" : "outline"}
              onClick={() => setBulkWeeks(bulkWeeks === w ? null : w)}
              className="text-[10px] font-bold uppercase tracking-widest"
            >
              {w} Weeks
            </Button>
          ))}
        </div>

        {bulkWeeks && (
          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Days of the week ({selectedDays.length} selected)
              </div>
              <div className="flex flex-wrap gap-1">
                {DAY_LABELS.map((label, idx) => {
                  const active = selectedDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() =>
                        setSelectedDays(prev =>
                          active ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                        )
                      }
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 border ${
                        active
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-muted border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Time slots to open ({bulkTimes.length} selected)
              </div>
              <div className="flex flex-wrap gap-1">
                {SLOT_TIMES.map(time => {
                  const selected = bulkTimes.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() =>
                        setBulkTimes(prev =>
                          selected ? prev.filter(t => t !== time) : [...prev, time].sort()
                        )
                      }
                      className={`px-2 py-1 text-[9px] font-mono transition-m2 border ${
                        selected
                          ? "bg-primary/20 border-primary/40 text-primary font-bold"
                          : "bg-muted border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {formatTime12(time)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => bulkPopulate(bulkWeeks)}
                disabled={bulkLoading || bulkTimes.length === 0 || selectedDays.length === 0}
                className="text-[10px] font-bold uppercase tracking-widest"
              >
                {bulkLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <CalendarPlus size={12} className="mr-1" />}
                Open {bulkTimes.length} slots/day on {selectedDays.map(d => DAY_LABELS[d]).join(", ")} for {bulkWeeks} weeks
              </Button>
              <button
                onClick={() => setBulkWeeks(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-muted border border-border" /> Closed</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-primary/20 border border-primary" /> Open</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-600" /> Booked</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
          {SLOT_TIMES.map(time => {
            const slot = slotMap[time];
            const booking = bookingMap[time];
            const isAvailable = slot?.is_available && !slot?.booked_by;
            const isBooked = !!slot?.booked_by || !!booking;

            return (
              <button
                key={time}
                onClick={() => !isBooked && toggleSlot(time)}
                disabled={toggling === time}
                className={`relative p-3 text-left transition-m2 border ${
                  isBooked
                    ? "bg-green-600/20 border-green-600/40 cursor-default"
                    : isAvailable
                    ? "bg-primary/15 border-primary/40 hover:bg-primary/25"
                    : "bg-muted border-border hover:bg-muted/80"
                }`}
              >
                <div className="text-sm font-mono font-bold text-foreground">
                  {formatTime12(time)}
                </div>
                {isBooked && booking && (
                  <div className="mt-1">
                    <div className="flex items-center gap-1">
                      <div className="text-[9px] text-green-400 font-bold uppercase">Booked</div>
                      <div className={`text-[8px] px-1 py-0.5 font-bold uppercase ${
                        booking.session_type === "video" ? "bg-blue-500/20 text-blue-400" : "bg-primary/20 text-primary"
                      }`}>
                        {booking.session_type === "video" ? "Video" : "In-Person"}
                      </div>
                      {booking.credit_id && (
                        <div className="text-[8px] px-1 py-0.5 bg-accent/20 text-accent-foreground font-bold uppercase">Credit</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{booking.user_name || booking.user_email}</div>
                    <div className="text-[9px] text-muted-foreground">
                      {booking.duration_minutes}min · {booking.credit_id ? "Free (Credit)" : `$${(booking.amount_cents / 100).toFixed(0)}`}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelBooking(booking); }}
                      disabled={cancelling === booking.id}
                      className="mt-1 text-[8px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest flex items-center gap-1"
                    >
                      {cancelling === booking.id ? <Loader2 size={8} className="animate-spin" /> : <Ban size={8} />}
                      Cancel & Refund
                    </button>
                  </div>
                )}
                {isAvailable && !isBooked && (
                  <div className="text-[9px] text-primary font-bold uppercase mt-1">Available</div>
                )}
                {toggling === time && <Loader2 size={12} className="absolute top-2 right-2 animate-spin text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Upcoming bookings summary */}
      {bookings.length > 0 && (
        <div className="bg-card shadow-m2 p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Bookings for {format(selectedDate, "MMM d")}
          </h3>
          <div className="space-y-2">
            {bookings.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-muted p-3">
                <div>
                  <span className="text-sm font-bold text-foreground">{formatTime12(b.start_time)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{b.duration_minutes}min</span>
                  <span className={`text-[9px] ml-2 px-1.5 py-0.5 font-bold uppercase ${
                    b.session_type === "video" ? "bg-blue-500/20 text-blue-400" : "bg-primary/20 text-primary"
                  }`}>
                    {b.session_type === "video" ? "Video" : "In-Person"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">{b.user_name || b.user_email}</span>
                </div>
                <span className="text-xs font-mono text-primary">
                  {b.credit_id ? "Credit" : `$${(b.amount_cents / 100).toFixed(0)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSchedule;
