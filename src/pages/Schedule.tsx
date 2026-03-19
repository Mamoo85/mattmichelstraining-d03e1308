import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import AppNavbar from "@/components/AppNavbar";
import PaywallGate from "@/components/PaywallGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay } from "date-fns";
import { Loader2, Clock, DollarSign, Info, Calendar, CheckCircle, Video, MapPin, Ticket, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScheduleSneakPeek from "@/components/landing/ScheduleSneakPeek";
import InstagramSocialBox from "@/components/landing/InstagramSocialBox";

const formatTime12 = (t: string) => {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
};

const addMinutes = (time: string, mins: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}:00`;
};

type Slot = {
  id: string;
  slot_date: string;
  start_time: string;
  is_available: boolean;
  booked_by: string | null;
};

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, subscriptionTier } = useAuth();
  const { toast } = useToast();

  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sessionType, setSessionType] = useState<"in_person" | "video">("in_person");
  const [hasCredit, setHasCredit] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [hasGift, setHasGift] = useState(false);
  const [giftId, setGiftId] = useState<string | null>(null);
  const [useGift, setUseGift] = useState(false);

  const isElite = subscriptionTier === "custom" || subscriptionTier === "team_elite";

  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const currentDate = days[selectedDay];
  const dateStr = format(currentDate, "yyyy-MM-dd");

  // Check for available session credits (Elite only) and gifted sessions
  useEffect(() => {
    if (!user) { setHasCredit(false); setHasGift(false); return; }

    const checkEntitlements = async () => {
      setLoadingCredit(true);

      // Check gifted sessions for ANY tier
      const { data: giftData } = await supabase
        .from("gifted_sessions")
        .select("id")
        .eq("status", "pending")
        .eq("claimed_by", user.id)
        .limit(1);

      // Also check by receiver_email if not claimed yet
      const userEmail = user.email;
      let pendingGift = giftData && giftData.length > 0 ? giftData[0] : null;
      if (!pendingGift && userEmail) {
        const { data: emailGifts } = await supabase
          .from("gifted_sessions")
          .select("id")
          .eq("status", "pending")
          .eq("receiver_email", userEmail)
          .limit(1);
        pendingGift = emailGifts && emailGifts.length > 0 ? emailGifts[0] : null;
      }
      setHasGift(!!pendingGift);
      setGiftId(pendingGift?.id || null);

      // Check Elite credits
      if (isElite) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const { data: usedData } = await supabase
          .from("session_credits")
          .select("id")
          .eq("user_id", user.id)
          .eq("month", month)
          .eq("year", year)
          .eq("is_used", true);
        setHasCredit(!usedData || usedData.length === 0);
      } else {
        setHasCredit(false);
      }
      setLoadingCredit(false);
    };
    checkEntitlements();
  }, [user, isElite]);

  // Verify session on return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId && !verified) {
      setVerifying(true);
      supabase.functions.invoke("verify-session-booking", { body: { session_id: sessionId } })
        .then(({ data, error }) => {
          if (error || data?.error) {
            toast({ title: "Verification issue", description: data?.error || error?.message, variant: "destructive" });
          } else {
            setVerified(true);
            toast({ title: "Session booked!", description: "Confirmation emails sent. See you soon!" });
          }
          setVerifying(false);
        });
    }
  }, [searchParams]);

  const fetchSlots = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("schedule_slots")
      .select("*")
      .eq("slot_date", dateStr)
      .eq("is_available", true);
    setSlots((data as any[]) || []);
    setSelectedSlots([]);
    setLoading(false);
  };

  useEffect(() => { fetchSlots(); }, [dateStr]);

  const now = new Date();
  const cutoffMs = 2.5 * 60 * 60 * 1000;

  const availableSlots = useMemo(() => {
    return slots
      .filter(s => !s.booked_by)
      .filter(s => {
        const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
        return slotDateTime.getTime() - now.getTime() > cutoffMs;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, now]);

  const availableTimeSet = useMemo(() => new Set(availableSlots.map(s => s.start_time)), [availableSlots]);

  const toggleSlot = (time: string) => {
    setSelectedSlots(prev => {
      if (prev.includes(time)) return prev.filter(t => t !== time);
      if (useCredit || useGift) return [time]; // credits/gifts = single slot only
      if (prev.length === 0) return [time];
      if (prev.length === 1) {
        const existing = prev[0];
        const next = addMinutes(existing, 30);
        const prev30 = addMinutes(existing, -30);
        if (time === next && availableTimeSet.has(time)) return [existing, time].sort();
        if (time === prev30 && availableTimeSet.has(time)) return [time, existing].sort();
        return [time];
      }
      return [time];
    });
  };

  const isConsecutive = selectedSlots.length === 2 &&
    addMinutes(selectedSlots[0], 30) === selectedSlots[1];
  const isFreeSession = useCredit || useGift;
  const duration = isFreeSession ? 30 : (isConsecutive ? 60 : 30);
  const price = isFreeSession ? 0 : (isConsecutive ? 90 : 50);

  const handlePurchase = async () => {
    if (!user) {
      window.location.href = `/auth?redirect=/schedule`;
      return;
    }
    if (selectedSlots.length === 0) return;

    setPurchasing(true);
    try {
      if (useCredit) {
        // Redeem Elite credit directly
        const { data, error } = await supabase.functions.invoke("redeem-session-credit", {
          body: {
            slot_date: dateStr,
            start_time: selectedSlots[0],
            session_type: sessionType,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setVerified(true);
        setHasCredit(false);
        toast({ title: "Session booked!", description: "Your Elite session credit has been redeemed. Confirmation emails sent!" });
      } else if (useGift && giftId) {
        // Redeem gifted session — book free via edge function
        const { data, error } = await supabase.functions.invoke("redeem-session-credit", {
          body: {
            slot_date: dateStr,
            start_time: selectedSlots[0],
            session_type: sessionType,
            gift_id: giftId,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setVerified(true);
        setHasGift(false);
        setGiftId(null);
        setUseGift(false);
        toast({ title: "Session booked!", description: "Your gifted session has been redeemed. Confirmation emails sent!" });
      } else {
        // Stripe checkout
        const { data, error } = await supabase.functions.invoke("create-session-checkout", {
          body: {
            slot_date: dateStr,
            start_time: selectedSlots[0],
            duration_minutes: duration,
            session_type: sessionType,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.url) window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Booking error", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container pt-24 pb-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm text-muted-foreground">Verifying your booking...</p>
        </div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container pt-24 pb-12 max-w-lg text-center space-y-4">
          <CheckCircle size={48} className="text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Session Booked!</h1>
          <p className="text-sm text-muted-foreground">
            Your training session is confirmed. Check your email for details.
            Matt has been notified and is ready for you.
          </p>
          <Button onClick={() => { setVerified(false); navigate("/schedule"); }} className="mt-4">Book Another Session</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Schedule a Session — In-Person Training"
        description="Book an in-person strength training session with Coach Matt in Grosse Pointe Park, MI. 30-min ($50) and 60-min ($90) sessions available."
        path="/schedule"
      />
      <AppNavbar />
      <div className="container pt-20 pb-12 max-w-2xl">
        <PaywallGate featureKey="priority_scheduling" featureName="1-on-1 Session Booking">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-foreground tracking-display">Schedule a Session</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Book a training session with Matt. Select a day, pick your time, and checkout.
          </p>
        </div>

        {/* Session Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSessionType("in_person")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 border transition-m2 text-sm font-bold ${
              sessionType === "in_person"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin size={14} /> In-Person
          </button>
          <button
            onClick={() => setSessionType("video")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 border transition-m2 text-sm font-bold ${
              sessionType === "video"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Video size={14} /> Video Call
          </button>
        </div>

        {/* Elite Credit Banner */}
        {isElite && hasCredit && !loadingCredit && (
          <div className="bg-accent/20 border border-accent p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket size={14} className="text-accent-foreground" />
                <div>
                  <div className="text-xs font-bold text-foreground">Elite Session Credit Available</div>
                  <div className="text-[10px] text-muted-foreground">1× free 30-min session included with your Elite membership this month</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setUseCredit(!useCredit);
                  if (!useCredit) setSelectedSlots(prev => prev.slice(0, 1));
                }}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-m2 ${
                  useCredit
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {useCredit ? "Using Credit" : "Use Credit"}
              </button>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-primary/10 border border-primary/20 p-4 mb-6 space-y-1">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              {useCredit || useGift ? (
                <p><strong className="text-foreground">Free 30-min session</strong> — Select one time slot to redeem your {useCredit ? "Elite credit" : "gifted session"}.</p>
              ) : (
                <>
                  <p><strong className="text-foreground">30-minute session: $50</strong> — Select one time slot.</p>
                  <p><strong className="text-foreground">1-hour session: $90</strong> — Select two consecutive slots to automatically combine into an hour.</p>
                </>
              )}
              <p>Slots close 2.5 hours before start time. Sessions available up to 2 weeks out.</p>
            </div>
          </div>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex-shrink-0 px-3 py-2 text-center transition-m2 min-w-[60px] ${
                selectedDay === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="text-[9px] font-bold uppercase">{format(day, "EEE")}</div>
              <div className="text-sm font-mono font-bold">{format(day, "d")}</div>
              <div className="text-[9px]">{format(day, "MMM")}</div>
            </button>
          ))}
        </div>

        {/* Time slots */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : availableSlots.length === 0 ? (
          <div className="bg-muted p-8 text-center">
            <Calendar size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-bold text-foreground">No available slots</p>
            <p className="text-xs text-muted-foreground mt-1">Try another day or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-6">
            {availableSlots.map(slot => {
              const selected = selectedSlots.includes(slot.start_time);
              return (
                <button
                  key={slot.start_time}
                  onClick={() => toggleSlot(slot.start_time)}
                  className={`p-3 text-center transition-m2 border ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  <Clock size={12} className={`mx-auto mb-1 ${selected ? "text-primary-foreground" : "text-primary"}`} />
                  <div className="text-sm font-mono font-bold">{formatTime12(slot.start_time)}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Purchase section */}
        {selectedSlots.length > 0 && (
          <div className="bg-card shadow-m2 p-5 sticky bottom-4 pb-safe">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  {sessionType === "video" ? <Video size={14} /> : <MapPin size={14} />}
                  {isConsecutive && !isFreeSession ? "1-Hour Session" : "30-Minute Session"}
                  <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground font-bold uppercase">
                    {sessionType === "video" ? "Video" : "In-Person"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(currentDate, "EEEE, MMM d")} at {formatTime12(selectedSlots[0])}
                  {isConsecutive && !isFreeSession && ` – ${formatTime12(addMinutes(selectedSlots[1], 30))}`}
                </div>
              </div>
              <div className="text-right">
                {isFreeSession ? (
                  <div>
                    <div className="text-xs line-through text-muted-foreground">$50</div>
                    <div className="text-lg font-mono font-bold text-primary">FREE</div>
                  </div>
                ) : (
                  <div className="text-2xl font-mono font-bold text-primary">${price}</div>
                )}
              </div>
            </div>
            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full text-xs font-bold uppercase tracking-widest"
            >
              {purchasing ? <Loader2 size={14} className="animate-spin mr-2" /> : 
                isFreeSession ? (useGift ? <Gift size={14} className="mr-2" /> : <Ticket size={14} className="mr-2" />) : <DollarSign size={14} className="mr-2" />}
              {!user ? "Sign In to Book" : useCredit ? "Redeem Credit" : useGift ? "Redeem Gift" : `Book Session · $${price}`}
            </Button>
          </div>
        )}
        </PaywallGate>
      </div>
    </div>
  );
};

export default Schedule;
