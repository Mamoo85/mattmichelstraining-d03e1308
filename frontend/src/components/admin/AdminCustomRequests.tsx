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
  const [confirmApprove, setConfirmApprove] = useState<{ id: string; workoutId: string; userId: string } | null>(null);

  // Manual AI generation params (for sparse intakes)
  const [manualParams, setManualParams] = useState<Record<string, { description: string }>>({});

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

  const getManualDesc = (id: string) => manualParams[id]?.description || "";

  const hasFilledIntake = (req: CustomRequest) => {
    return !!(req.goals || req.sport || req.experience || req.equipment);
  };

  /** Build a natural-language prompt from intake data for ai-workout-suggest */
  const buildPromptFromIntake = (req: CustomRequest): string => {
    const parts: string[] = [];
    if (req.name) parts.push(`Athlete: ${req.name}`);
    if (req.age) parts.push(`Age: ${req.age}`);
    if (req.sport) parts.push(`Sport: ${req.sport}`);
    if (req.experience) parts.push(`Experience: ${req.experience}`);
    if (req.goals) parts.push(`Goals: ${req.goals}`);
    if (req.equipment) parts.push(`Equipment: ${req.equipment}`);
    if (req.injuries) parts.push(`Injuries/limitations: ${req.injuries}`);
    if (req.days_per_week) parts.push(`Training ${req.days_per_week} days per week`);
    if (req.additional_notes) parts.push(`Additional notes: ${req.additional_notes}`);
    return parts.join(". ") + ". Build a complete custom training workout for this athlete.";
  };

  const handleGenerateAI = async (req: CustomRequest) => {
    setGenerating(req.id);
    try {
      // Update status to generating
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "generating" } as any)
        .eq("id", req.id);

      // Build prompt from intake or manual description
      const filled = hasFilledIntake(req);
      const userText = filled
        ? buildPromptFromIntake(req)
        : getManualDesc(req.id) || `Build a custom workout program for ${req.name}`;

      // Call ai-workout-suggest (the newest/only generator)
      const { data, error } = await supabase.functions.invoke("ai-workout-suggest", {
        body: {
          mode: "dual-path",
          path: "workout",
          userText,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Save the generated workout into the user's community_workouts library
      const sourceType = "coach_seeded";
      const { data: saved, error: saveErr } = await supabase
        .from("community_workouts")
        .insert({
          user_id: req.user_id,
          title: data.title || `Custom Program for ${req.name}`,
          description: data.description || "Custom program built by Coach Matt",
          creator_name: "Coach Matt",
          is_public: false,
          exercises: data.exercises || [],
          source_type: sourceType,
        })
        .select("id")
        .single();
      if (saveErr) throw saveErr;

      // Update the request with the generated workout ID
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "ready_for_review", generated_program_id: saved?.id } as any)
        .eq("id", req.id);

      toast.success(`Workout generated: ${data.title}`);
      queryClient.invalidateQueries({ queryKey: ["admin-custom-requests"] });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
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
      toast.error("No workout generated yet");
      return;
    }
    setConfirmApprove({ id: req.id, workoutId: req.generated_program_id, userId: req.user_id });
  };

  const executeApproval = async () => {
    if (!confirmApprove) return;
    setApproving(confirmApprove.id);
    try {
      // Mark request as approved
      await supabase
        .from("custom_program_requests" as any)
        .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("id", confirmApprove.id);

      // Mark free_program_redeemed on their profile
      await supabase
        .from("profiles")
        .update({ free_program_redeemed: true } as any)
        .eq("user_id", confirmApprove.userId);

      // Notify the user
      await supabase.from("notifications").insert({
        user_id: confirmApprove.userId,
        type: "custom_program_approved",
        title: "Your Custom Program is Ready!",
        body: "Coach Matt built your custom workout — it's in your Workouts tab now.",
        link: "/dashboard",
      });

      toast.success("Workout approved and delivered to the athlete!");
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

            {/* Manual description for sparse intakes */}
            {!filled && req.status === "pending" && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  No intake details — describe the workout for AI:
                </p>
                <Textarea
                  value={getManualDesc(req.id)}
                  onChange={(e) =>
                    setManualParams((prev) => ({
                      ...prev,
                      [req.id]: { description: e.target.value },
                    }))
                  }
                  className="text-xs min-h-[60px]"
                  placeholder="e.g., Build a 3-day full body program for a 16yo football player with access to a full gym. Focus on explosiveness and injury prevention."
                />
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
                    {generating === req.id ? "Generating…" : "Generate Workout"}
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
        title="Approve Custom Workout"
        description="This will notify the athlete that their custom workout is ready in their Workouts tab and mark their free coupon as redeemed."
        confirmLabel="Approve & Deliver"
        onConfirm={executeApproval}
      />
    </div>
  );
};

export default AdminCustomRequests;
