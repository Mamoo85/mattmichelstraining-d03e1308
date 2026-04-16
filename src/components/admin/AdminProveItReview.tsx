import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, XCircle, Play, Shield, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";

interface PrSubmission {
  id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  rep_max: number;
  video_path: string;
  media_consent: boolean;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
}

const AdminProveItReview = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["pr-submissions-review"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pr_submissions" as any)
        .select("*")
        .order("submitted_at", { ascending: false });
      return (data ?? []) as unknown as PrSubmission[];
    },
    refetchInterval: 15000,
  });

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  const getVideoUrl = (path: string) => {
    const { data } = supabase.storage.from("lift_videos").getPublicUrl(path);
    return data?.publicUrl || "";
  };

  const getProfileName = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("athlete_name, full_name")
      .eq("user_id", userId)
      .single();
    return data?.athlete_name || data?.full_name || "Unknown";
  };

  const handleApprove = async (sub: PrSubmission) => {
    if (!user) return;
    setProcessing(sub.id);

    try {
      // 1. Update pr_submissions status
      const { error: updateErr } = await supabase
        .from("pr_submissions" as any)
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        } as any)
        .eq("id", sub.id);
      if (updateErr) throw updateErr;

      // 2. Insert into progress_logs
      const { error: logErr } = await supabase.from("progress_logs").insert({
        user_id: sub.user_id,
        exercise_name: sub.exercise_name,
        weight: sub.weight,
        reps: sub.reps,
        rep_max: sub.rep_max,
        logged_at: sub.submitted_at,
      });
      if (logErr) throw logErr;

      // 3. Copy video to admin_media bucket
      const athleteName = await getProfileName(sub.user_id);
      const safeAthlName = athleteName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const safeExercise = sub.exercise_name.replace(/\s+/g, "_").toLowerCase();
      const date = new Date(sub.submitted_at).toISOString().split("T")[0];
      const destPath = `prove_it/${safeAthlName}_${safeExercise}_${date}.mp4`;

      try {
        if (sub.video_path.includes('..')) throw new Error('Invalid video path');
        const { data: videoData } = await supabase.storage.from("lift_videos").download(sub.video_path);
        if (videoData) {
          if (destPath.includes('..')) throw new Error('Invalid destination path');
          await supabase.storage.from("admin_media").upload(destPath, videoData, {
            contentType: "video/mp4",
            upsert: true,
          });

          // 4. Register in admin_media_files
          await supabase.from("admin_media_files").insert({
            file_name: `${athleteName} - ${sub.exercise_name} PR ${sub.weight}lbs`,
            file_path: destPath,
            file_type: "video",
            file_size: videoData.size,
            uploaded_by: user.id,
            tags: ["prove_it", "pr", sub.exercise_name.toLowerCase()],
            metadata: {
              athlete_id: sub.user_id,
              athlete_name: athleteName,
              weight: sub.weight,
              reps: sub.reps,
              media_consent: sub.media_consent,
            },
          });
        }
      } catch {
        // Non-critical: media vault copy failed but PR is still approved
        console.warn("Media vault copy failed, PR still approved");
      }

      toast.success(`PR approved: ${sub.exercise_name} @ ${sub.weight}lbs`);
      qc.invalidateQueries({ queryKey: ["pr-submissions-review"] });
      qc.invalidateQueries({ queryKey: ["pending-prove-it-count"] });
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !user) return;
    setProcessing(rejectId);

    try {
      const { error } = await supabase
        .from("pr_submissions" as any)
        .update({
          status: "rejected",
          admin_notes: rejectNote || "Rejected by coach",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        } as any)
        .eq("id", rejectId);
      if (error) throw error;

      toast.success("PR submission rejected");
      setRejectId(null);
      setRejectNote("");
      qc.invalidateQueries({ queryKey: ["pr-submissions-review"] });
      qc.invalidateQueries({ queryKey: ["pending-prove-it-count"] });
    } catch (err: any) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setProcessing(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 size={20} className="text-primary animate-spin" /></div>;

  const renderCard = (sub: PrSubmission) => (
    <div key={sub.id} className="border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{sub.exercise_name}</p>
          <p className="text-xs text-muted-foreground">{sub.weight} lbs × {sub.reps} reps ({sub.rep_max}RM)</p>
        </div>
        <div className="flex items-center gap-2">
          {sub.media_consent && (
            <Badge variant="outline" className="text-[8px] gap-1">
              <Shield size={8} /> Consent
            </Badge>
          )}
          <Badge
            variant={sub.status === "approved" ? "default" : sub.status === "rejected" ? "destructive" : "secondary"}
            className="text-[8px] uppercase"
          >
            {sub.status}
          </Badge>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Submitted {new Date(sub.submitted_at).toLocaleDateString()}
      </p>

      {/* Video */}
      {activeVideo === sub.id ? (
        <video src={getVideoUrl(sub.video_path)} controls autoPlay className="w-full aspect-video bg-black object-contain border border-border" />
      ) : (
        <button
          onClick={() => setActiveVideo(sub.id)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground transition-all"
        >
          <Play size={14} /> Watch Video
        </button>
      )}

      {sub.admin_notes && (
        <p className="text-[10px] text-muted-foreground italic">Note: {sub.admin_notes}</p>
      )}

      {/* Actions for pending */}
      {sub.status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(sub)}
            disabled={processing === sub.id}
            className="flex-1 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {processing === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Approve
          </button>
          <button
            onClick={() => setRejectId(sub.id)}
            disabled={processing === sub.id}
            className="flex-1 py-2.5 bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <XCircle size={12} /> Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Prove It — PR Submissions</h3>
        {pending.length > 0 && (
          <Badge variant="destructive" className="text-[8px]">{pending.length} pending</Badge>
        )}
      </div>

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-xs text-muted-foreground py-8 text-center">No PR submissions yet.</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending Review</p>
          {pending.map(renderCard)}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reviewed</p>
          {reviewed.slice(0, 20).map(renderCard)}
        </div>
      )}

      <ConfirmActionModal
        open={!!rejectId}
        onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectNote(""); } }}
        title="Reject PR Submission"
        description={
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Add a note explaining why this PR was rejected (optional).</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g., Depth not reached, video unclear..."
              className="w-full p-3 bg-background border border-border text-xs text-foreground min-h-[80px] focus:border-primary focus:outline-none"
            />
          </div>
        }
        confirmLabel="Reject"
        destructive
        onConfirm={handleReject}
        loading={processing === rejectId}
      />
    </div>
  );
};

export default AdminProveItReview;
