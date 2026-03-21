import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Video, CheckCircle, XCircle, Archive, Trash2, Loader2, FileText, Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface LiftVideoRow {
  id: string;
  progress_log_id: string;
  user_id: string;
  video_path: string;
  ai_analysis: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface ProgressLogRow {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
  user_id: string;
}

const AdminLiftVideoReview = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pending_review");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<string | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["admin-lift-videos", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lift_videos" as any)
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as LiftVideoRow[];
    },
    refetchInterval: 30000,
  });

  // Fetch related progress logs
  const logIds = videos.map((v) => v.progress_log_id);
  const { data: logs = [] } = useQuery({
    queryKey: ["admin-lift-video-logs", logIds],
    enabled: logIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("progress_logs")
        .select("id, exercise_name, weight, reps, estimated_1rm, logged_at, user_id")
        .in("id", logIds);
      return (data || []) as ProgressLogRow[];
    },
  });

  // Fetch profiles for names
  const userIds = [...new Set(videos.map((v) => v.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-lift-video-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", userIds);
      return data || [];
    },
  });

  const getLog = (logId: string) => logs.find((l) => l.id === logId);
  const getProfile = (userId: string) => profiles.find((p: any) => p.user_id === userId);
  const displayName = (userId: string) => {
    const p = getProfile(userId) as any;
    return p?.athlete_name || p?.full_name || p?.email || "Unknown";
  };

  const playVideo = async (path: string) => {
    const { data } = await supabase.storage.from("lift_videos").createSignedUrl(path, 300);
    if (data?.signedUrl) setPlayingUrl(data.signedUrl);
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    };
    if (adminNote[id]?.trim()) updateData.admin_notes = adminNote[id].trim();

    const { error } = await supabase.from("lift_videos" as any).update(updateData).eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Video ${status.replace("_", " ")}` });
      queryClient.invalidateQueries({ queryKey: ["admin-lift-videos"] });
      queryClient.invalidateQueries({ queryKey: ["pending-lift-videos-count"] });
    }
    setActionLoading(null);
  };

  const deleteVideo = async (video: LiftVideoRow) => {
    setActionLoading(video.id);
    // Delete from storage
    await supabase.storage.from("lift_videos").remove([video.video_path]);
    // Delete row
    const { error } = await supabase.from("lift_videos" as any).delete().eq("id", video.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Video permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-lift-videos"] });
      queryClient.invalidateQueries({ queryKey: ["pending-lift-videos-count"] });
    }
    setActionLoading(null);
  };

  const statusColors: Record<string, string> = {
    pending_review: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    approved: "bg-primary/10 text-primary border-primary/30",
    rejected: "bg-destructive/10 text-destructive border-destructive/30",
    archived: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lift Videos</p>
        <div className="flex gap-1 ml-auto">
          {["pending_review", "approved", "rejected", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-2 py-1 border transition-all",
                filter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      ) : videos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 bg-card border border-border">No {filter.replace("_", " ")} videos</p>
      ) : (
        <div className="space-y-2">
          {videos.map((video) => {
            const log = getLog(video.progress_log_id);
            const loading = actionLoading === video.id;

            return (
              <div key={video.id} className="bg-card border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-foreground">{displayName(video.user_id)}</p>
                    {log && (
                      <p className="text-xs text-muted-foreground">
                        {log.exercise_name} · {log.weight}lbs × {log.reps} · {new Date(log.logged_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge className={cn("text-[8px]", statusColors[video.status])}>
                    {video.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Play button */}
                <button
                  onClick={() => playVideo(video.video_path)}
                  className="w-full py-3 bg-muted/50 border border-border flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
                >
                  <Video size={14} /> Watch Video
                </button>

                {/* AI Analysis */}
                {video.ai_analysis && (
                  <div>
                    <button
                      onClick={() => setShowAnalysis(showAnalysis === video.id ? null : video.id)}
                      className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 hover:opacity-80"
                    >
                      <FileText size={10} /> {showAnalysis === video.id ? "Hide" : "Show"} AI Analysis
                    </button>
                    {showAnalysis === video.id && (
                      <div className="mt-2 p-3 bg-muted/30 border border-border text-xs text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {video.ai_analysis}
                      </div>
                    )}
                  </div>
                )}

                {/* Admin note */}
                {filter === "pending_review" && (
                  <input
                    value={adminNote[video.id] || ""}
                    onChange={(e) => setAdminNote({ ...adminNote, [video.id]: e.target.value })}
                    placeholder="Admin note (optional)…"
                    className="w-full bg-background border border-border px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {filter === "pending_review" && (
                    <>
                      <button onClick={() => updateStatus(video.id, "approved")} disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {loading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Approve
                      </button>
                      <button onClick={() => updateStatus(video.id, "rejected")} disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50">
                        <XCircle size={10} /> Reject
                      </button>
                    </>
                  )}
                  <button onClick={() => updateStatus(video.id, "archived")} disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50">
                    <Archive size={10} /> Archive
                  </button>
                  <button onClick={() => deleteVideo(video)} disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video playback modal */}
      <Dialog open={!!playingUrl} onOpenChange={() => setPlayingUrl(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogTitle className="sr-only">Lift Video Review</DialogTitle>
          {playingUrl && <video src={playingUrl} controls autoPlay preload="none" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLiftVideoReview;
