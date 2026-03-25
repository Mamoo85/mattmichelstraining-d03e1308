import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Loader2, CheckCircle, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { safeLocalStorage } from "@/lib/browserStorage";

const DEFERRED_KEY = "m2_coupon_deferred";

const CustomProgramRequest = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deferred, setDeferred] = useState(() => safeLocalStorage.getItem(DEFERRED_KEY) === "true");

  // Check profile for is_in_person + free_program_redeemed
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-program-coupon", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_in_person, free_program_redeemed, full_name, athlete_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    staleTime: 30_000,
  });

  // Check if there's already a pending/approved request
  const { data: existingRequest } = useQuery({
    queryKey: ["custom-program-request", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_program_requests" as any)
        .select("id, status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data as any)?.[0] ?? null;
    },
    staleTime: 30_000,
  });

  const [form, setForm] = useState({
    name: "",
    age: "",
    sport: "",
    experience: "",
    goals: "",
    equipment: "",
    injuries: "",
    days_per_week: "",
    additional_notes: "",
  });

  // Pre-fill name from profile
  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        name: f.name || profile.athlete_name || profile.full_name || "",
      }));
    }
  }, [profile]);

  // Don't show if: not in-person, already redeemed, loading, or deferred
  if (profileLoading) return null;
  if (!profile?.is_in_person) return null;
  if (deferred) return null;
  if (profile.free_program_redeemed || existingRequest) {
    // Show status if request exists
    if (existingRequest) {
      const statusMap: Record<string, string> = {
        pending: "Coach Matt is reviewing your request",
        generating: "AI is drafting your custom workout",
        ready_for_review: "Your workout is being finalized",
        approved: "Your custom workout is in your Workouts tab!",
      };
      return (
        <div className="bg-card border border-border p-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Custom Program Request
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {statusMap[existingRequest.status] || "Request submitted"}
          </p>
        </div>
      );
    }
    return null;
  }

  const handleDefer = () => {
    safeLocalStorage.setItem(DEFERRED_KEY, "true");
    setDeferred(true);
    toast.success("Saved! You can claim your free program from your Profile tab anytime.");
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("custom_program_requests" as any)
        .insert({
          user_id: user!.id,
          name: form.name.trim(),
          age: form.age.trim() || null,
          sport: form.sport.trim() || null,
          experience: form.experience.trim() || null,
          goals: form.goals.trim() || null,
          equipment: form.equipment.trim() || null,
          injuries: form.injuries.trim() || null,
          days_per_week: form.days_per_week.trim() || null,
          additional_notes: form.additional_notes.trim() || null,
        } as any);
      if (insertError) throw insertError;

      // Notify admin
      const { data: adminIds } = await supabase
        .from("user_roles" as any)
        .select("user_id")
        .eq("role", "admin");

      if (adminIds && adminIds.length > 0) {
        const notifications = (adminIds as any[]).map((a: any) => ({
          user_id: a.user_id,
          type: "custom_program_request",
          title: "New Custom Program Request",
          body: `${form.name.trim()} submitted a free custom program request`,
          link: "/admin",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast.success("Request submitted! Coach Matt will build your custom workout.");
      queryClient.invalidateQueries({ queryKey: ["custom-program-request"] });
      queryClient.invalidateQueries({ queryKey: ["profile-program-coupon"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border-2 border-primary/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Free Custom Program
          </span>
        </div>
        <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
          1 Free Coupon
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        As an in-person client, you get one free custom workout program built personally by Coach Matt.
        Fill out the form below and submit — Matt will review and build your program.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:text-foreground transition-colors py-2"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Collapse Form" : "Claim My Free Program"}
        </button>
        <button
          onClick={handleDefer}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-colors"
        >
          <Clock size={12} />
          Do Later
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Name — required */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground mb-1 block">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="h-9 text-sm"
            />
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Age</label>
              <Input
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="e.g. 16"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Sport</label>
              <Input
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value })}
                placeholder="e.g. Football, Track"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Experience Level</label>
            <Input
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              placeholder="e.g. Beginner, 2 years lifting"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Goals</label>
            <Textarea
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="e.g. Get stronger for football season, improve squat"
              className="text-sm min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Equipment Access</label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="e.g. Full gym, Home"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Days/Week</label>
              <Input
                value={form.days_per_week}
                onChange={(e) => setForm({ ...form, days_per_week: e.target.value })}
                placeholder="e.g. 3, 4"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Injuries / Limitations</label>
            <Input
              value={form.injuries}
              onChange={(e) => setForm({ ...form, injuries: e.target.value })}
              placeholder="e.g. Bad right knee, shoulder impingement"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Anything else Coach Matt should know</label>
            <Textarea
              value={form.additional_notes}
              onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
              placeholder="Any other details..."
              className="text-sm min-h-[60px]"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim()}
            className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Dumbbell size={14} />}
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomProgramRequest;
