import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Check, X, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface CustomRequest {
  id: string;
  user_id: string;
  status: string;
  name: string;
  age: string | null;
  sport: string | null;
  experience: string | null;
  goals: string | null;
  equipment: string | null;
  injuries: string | null;
  days_per_week: string | null;
  additional_notes: string | null;
  generated_program_id: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  generating: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready_for_review: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
};

const AdminCustomRequests = () => {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<{ id: string; programId: string; userId: string } | null>(null);

  // Manual AI generation params (for sparse intakes)
  const [manualParams, setManualParams] = useState<Record<string, {
    category: string; level: string; sport: string; weeks: string; daysPerWeek: string; description: string;
  }>>({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-custom-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_program_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CustomRequest[];
    },
    refetchInterval: 15_000,
  });

  const getManualParams = (id: string) =>
    manualParams[id] || { category: "General", level: "Beginner", sport: "", weeks: "8", daysPerWeek: "3", description: "" };

  const updateManualParam = (id: string, field: string, value: string) => {
    setManualParams((prev) => ({
      ...prev,
      [id]: { ...getManualParams(id), [field]: value },
    }));
  };

  const hasFilledIntake = (req: CustomRequest) => {
    return !!(req.goals || req.sport || req.experience || req.equipment);
  };

  const handleGenerateAI = async (req: CustomRequest) => {
    setGenerating(req.id);
    try {
      // Update status to generating
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "generating" } as any)
        .eq("id", req.id);

      // Build params from intake or manual input
      const filled = hasFilledIntake(req);
      const params = filled
        ? {
            category: req.sport ? "Sport-Specific" : "General",
            level: req.experience?.toLowerCase().includes("begin") ? "Beginner" : req.experience?.toLowerCase().includes("advanc") ? "Advanced" : "Intermediate",
            sport: req.sport || "",
            weeks: 8,
            daysPerWeek: parseInt(req.days_per_week || "3") || 3,
            description: [
              req.goals && `Goals: ${req.goals}`,
              req.equipment && `Equipment: ${req.equipment}`,
              req.injuries && `Injuries/limitations: ${req.injuries}`,
              req.age && `Age: ${req.age}`,
              req.additional_notes && `Notes: ${req.additional_notes}`,
            ].filter(Boolean).join(". "),
            exercisesPerDay: 8,
            explanationDetail: "detailed",
            includeFixIt: true,
            focusAreas: [],
          }
        : {
            category: getManualParams(req.id).category,
            level: getManualParams(req.id).level,
            sport: getManualParams(req.id).sport,
            weeks: parseInt(getManualParams(req.id).weeks) || 8,
            daysPerWeek: parseInt(getManualParams(req.id).daysPerWeek) || 3,
            description: getManualParams(req.id).description || `Custom program for ${req.name}`,
            exercisesPerDay: 8,
            explanationDetail: "detailed",
            includeFixIt: true,
            focusAreas: [],
          };

      // Call the existing generate-program function
      const { data, error } = await supabase.functions.invoke("generate-program", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Save the generated program to training_programs
      const { data: program, error: progError } = await supabase
        .from("training_programs")
        .insert({
          title: data.title || `Custom Program for ${req.name}`,
          description: data.description || "Custom program",
          category: params.category,
          experience_level: params.level,
          sport: params.sport || null,
          weeks: params.weeks || 8,
          days_per_week: params.daysPerWeek || 3,
          is_purchasable: false,
          created_by: (await supabase.auth.getUser()).data.user!.id,
        } as any)
        .select("id")
        .single();
      if (progError) throw progError;

      // Insert workouts
      if (data.workouts?.length > 0 && program?.id) {
        const workouts = data.workouts.map((w: any, i: number) => ({
          program_id: program.id,
          week_number: w.week_number,
          day_number: w.day_number,
          exercise_id: w.exercise_id,
          prescribed_sets_reps: w.prescribed_sets_reps,
          coach_instructions: w.coach_instructions,
          sort_order: w.sort_order ?? i,
        }));
        await supabase.from("program_workouts").insert(workouts);
      }

      // Update the request with the generated program ID
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "ready_for_review", generated_program_id: program?.id } as any)
        .eq("id", req.id);

      toast.success(`Program generated: ${data.title}`);
      queryClient.invalidateQueries({ queryKey: ["admin-custom-requests"] });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
      // Revert status
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "pending" } as any)
        .eq("id", req.id);
    } finally {
      setGenerating(null);
    }
  };

  const handleApprove = async (req: CustomRequest) => {
    if (!req.generated_program_id) {
      toast.error("No program generated yet");
      return;
    }
    setConfirmApprove({ id: req.id, programId: req.generated_program_id, userId: req.user_id });
  };

  const executeApproval = async () => {
    if (!confirmApprove) return;
    setApproving(confirmApprove.id);
    try {
      // Assign program to user's library
      await supabase.from("user_active_programs").insert({
        user_id: confirmApprove.userId,
        program_id: confirmApprove.programId,
        current_week: 1,
        current_day: 1,
      } as any);

      // Mark request as approved
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("id", confirmApprove.id);

      // Mark free_program_redeemed on their profile (service role needed — use RPC or direct)
      // Since we're admin, the trigger allows us to update
      await supabase
        .from("profiles")
        .update({ free_program_redeemed: true } as any)
        .eq("user_id", confirmApprove.userId);

      // Notify the user
      await supabase.from("notifications").insert({
        user_id: confirmApprove.userId,
        type: "custom_program_approved",
        title: "Your Custom Program is Ready!",
        body: "Coach Matt approved your custom program — it's in your My Programs tab now.",
        link: "/dashboard",
      });

      toast.success("Program approved and added to athlete's library!");
      queryClient.invalidateQueries({ queryKey: ["admin-custom-requests"] });
    } catch (e: any) {
      toast.error(e.message || "Approval failed");
    } finally {
      setApproving(null);
      setConfirmApprove(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-card border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">No custom program requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
        Custom Program Requests ({requests.filter((r) => r.status !== "approved").length} active)
      </h3>

      {requests.map((req) => {
        const filled = hasFilledIntake(req);
        const mp = getManualParams(req.id);

        return (
          <div key={req.id} className="bg-card border border-border p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <User size={14} className="text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{req.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[8px] uppercase tracking-widest border ${STATUS_COLORS[req.status] || ""}`}>
                  {req.status.replace(/_/g, " ")}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Intake data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {req.age && <div><span className="text-muted-foreground">Age:</span> <span className="text-foreground">{req.age}</span></div>}
              {req.sport && <div><span className="text-muted-foreground">Sport:</span> <span className="text-foreground">{req.sport}</span></div>}
              {req.experience && <div><span className="text-muted-foreground">Experience:</span> <span className="text-foreground">{req.experience}</span></div>}
              {req.equipment && <div><span className="text-muted-foreground">Equipment:</span> <span className="text-foreground">{req.equipment}</span></div>}
              {req.days_per_week && <div><span className="text-muted-foreground">Days/wk:</span> <span className="text-foreground">{req.days_per_week}</span></div>}
              {req.injuries && <div className="col-span-2"><span className="text-muted-foreground">Injuries:</span> <span className="text-foreground">{req.injuries}</span></div>}
            </div>
            {req.goals && (
              <div className="text-[11px]">
                <span className="text-muted-foreground">Goals:</span>{" "}
                <span className="text-foreground">{req.goals}</span>
              </div>
            )}
            {req.additional_notes && (
              <div className="text-[11px]">
                <span className="text-muted-foreground">Notes:</span>{" "}
                <span className="text-foreground">{req.additional_notes}</span>
              </div>
            )}

            {/* Manual params for sparse intakes */}
            {!filled && req.status === "pending" && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  No intake details — fill in AI parameters:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Category</label>
                    <Input value={mp.category} onChange={(e) => updateManualParam(req.id, "category", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Level</label>
                    <Input value={mp.level} onChange={(e) => updateManualParam(req.id, "level", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Sport</label>
                    <Input value={mp.sport} onChange={(e) => updateManualParam(req.id, "sport", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Weeks</label>
                    <Input value={mp.weeks} onChange={(e) => updateManualParam(req.id, "weeks", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Days/Week</label>
                    <Input value={mp.daysPerWeek} onChange={(e) => updateManualParam(req.id, "daysPerWeek", e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase">Description / Notes for AI</label>
                  <Textarea
                    value={mp.description}
                    onChange={(e) => updateManualParam(req.id, "description", e.target.value)}
                    className="text-xs min-h-[50px]"
                    placeholder="Any specific instructions for the AI..."
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            {req.status !== "approved" && req.status !== "rejected" && (
              <div className="flex gap-2 pt-1">
                {(req.status === "pending" || req.status === "generating") && (
                  <button
                    onClick={() => handleGenerateAI(req)}
                    disabled={generating === req.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {generating === req.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {generating === req.id ? "Generating…" : filled ? "Auto-Generate" : "Generate with Params"}
                  </button>
                )}
                {req.status === "ready_for_review" && (
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={approving === req.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {approving === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Approve & Deliver
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmActionModal
        open={!!confirmApprove}
        onOpenChange={(open) => { if (!open) setConfirmApprove(null); }}
        title="Approve Custom Program"
        description="This will add the generated program to the athlete's library permanently and mark their free coupon as redeemed."
        confirmLabel="Approve & Deliver"
        onConfirm={executeApproval}
      />
    </div>
  );
};

export default AdminCustomRequests;
