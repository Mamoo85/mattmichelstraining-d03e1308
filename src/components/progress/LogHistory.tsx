import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, X, Check, Loader2, CalendarIcon, ChevronDown, ChevronRight, Video, Clock, CheckCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CoachNotesBadge from "./CoachNotesBadge";
import LiftChat from "./LiftChat";

interface ProgressLog {
  id: string;
  weight: number;
  reps: number;
  estimated_1rm: number | null;
  logged_at: string;
}

interface CoachNote {
  id: string;
  progress_log_id: string;
  note: string;
  created_at: string;
}

interface LiftVideo {
  id: string;
  progress_log_id: string;
  video_path: string;
  status: string;
  ai_analysis: string | null;
}

interface LogHistoryProps {
  logs: ProgressLog[];
  isAdmin: boolean;
  effectiveUserId: string;
  onRefresh: () => Promise<void>;
}

const LogHistory = ({ logs, isAdmin, effectiveUserId, onRefresh }: LogHistoryProps) => {
  const MAX_VIDEO_SIZE = 5 * 1024 * 1024;

  const [showHistory, setShowHistory] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
  const [liftVideos, setLiftVideos] = useState<LiftVideo[]>([]);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; exercise: string } | null>(null);
  const [uploadingVideoLogId, setUploadingVideoLogId] = useState<string | null>(null);
  const lateVideoInputRef = useRef<HTMLInputElement>(null);
  const pendingLogIdRef = useRef<string | null>(null);

  const fetchNotes = async () => {
    if (logs.length === 0) return;
    const logIds = logs.map((l) => l.id);
    const { data } = await supabase
      .from("coach_notes" as any)
      .select("id, progress_log_id, note, created_at")
      .in("progress_log_id", logIds)
      .order("created_at");
    if (data) setCoachNotes(data as unknown as CoachNote[]);
  };

  const fetchVideos = async () => {
    if (logs.length === 0) return;
    const logIds = logs.map((l) => l.id);
    const { data } = await supabase
      .from("lift_videos" as any)
      .select("id, progress_log_id, video_path, status, ai_analysis")
      .in("progress_log_id", logIds);
    if (data) setLiftVideos(data as unknown as LiftVideo[]);
  };

  useEffect(() => {
    fetchNotes();
    fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const startEdit = (log: ProgressLog) => {
    setEditingId(log.id);
    setEditWeight(String(log.weight));
    setEditReps(String(log.reps));
    setEditDate(new Date(log.logged_at));
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleUpdate = async (id: string) => {
    const weight = parseFloat(editWeight);
    const reps = parseInt(editReps);
    if (!weight || weight <= 0 || !reps || reps <= 0) {
      toast({ title: "Enter valid values", variant: "destructive" });
      return;
    }
    setSaving(true);
    const estimated1rm = Math.round(weight * (1 + reps / 30));
    const { error } = await supabase
      .from("progress_logs")
      .update({ weight, reps, estimated_1rm: estimated1rm, logged_at: editDate.toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated" });
      setEditingId(null);
      await onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("progress_logs").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      await onRefresh();
    }
    setDeletingId(null);
  };

  const playVideo = async (video: LiftVideo) => {
    if (!isAdmin && video.status !== "approved") return;
    if (video.video_path.includes('..')) throw new Error('Invalid video path');
    const { data } = await supabase.storage.from("lift_videos").createSignedUrl(video.video_path, 300);
    if (data?.signedUrl) {
      setPlayingVideo({ url: data.signedUrl, exercise: "Lift Video" });
    }
  };

  const triggerLateUpload = (logId: string) => {
    pendingLogIdRef.current = logId;
    lateVideoInputRef.current?.click();
  };

  const handleLateVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const logId = pendingLogIdRef.current;
    if (!file || !logId) return;
    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: "Video too large", description: "Max 5MB. Trim or compress your clip.", variant: "destructive" });
      if (lateVideoInputRef.current) lateVideoInputRef.current.value = "";
      return;
    }
    setUploadingVideoLogId(logId);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${effectiveUserId}/${logId}.${ext}`;
      if (path.includes('..')) throw new Error("Invalid path");
      const { error: upErr } = await supabase.storage.from("lift_videos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await supabase.from("lift_videos" as any).insert({
        progress_log_id: logId,
        user_id: effectiveUserId,
        video_path: path,
        status: "pending_review",
      });
      supabase.functions.invoke("ai-video-form-review", {
        body: { videoUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/lift_videos/${path}`, exerciseName: "Lift", athleteName: "Athlete" },
      }).then(async (res) => {
        if (res.data?.review) {
          await supabase.from("lift_videos" as any).update({ ai_analysis: res.data.review }).eq("progress_log_id", logId);
        }
      }).catch(() => {});
      toast({ title: "Video submitted for review" });
      await fetchVideos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploadingVideoLogId(null);
    if (lateVideoInputRef.current) lateVideoInputRef.current.value = "";
    pendingLogIdRef.current = null;
  };

  if (logs.length === 0) return null;

  const notesForLog = (logId: string) => coachNotes.filter((n) => n.progress_log_id === logId);
  const videoForLog = (logId: string) => liftVideos.find((v) => v.progress_log_id === logId);
  const totalNotes = coachNotes.length;

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all mb-3"
      >
        {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Log History ({logs.length} entries)
        {totalNotes > 0 && (
          <span className="text-primary ml-1">· {totalNotes} coach note{totalNotes !== 1 ? "s" : ""}</span>
        )}
      </button>

      {showHistory && (
        <div className="bg-card border border-border divide-y divide-border rounded-lg">
          {[...logs].reverse().map((log, idx) => {
            const isEditing = editingId === log.id;
            const isDeleting = deletingId === log.id;
            const logNotes = notesForLog(log.id);
            const video = videoForLog(log.id);
            const prevLog = idx < logs.length - 1 ? [...logs].reverse()[idx + 1] : null;
            const weightDiff = prevLog ? log.weight - prevLog.weight : 0;

            return (
              <div key={log.id} className="p-4 space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {isEditing ? (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-10 w-[130px] text-sm font-mono px-3">
                            <CalendarIcon className="mr-1 h-3.5 w-3.5 text-primary" />
                            {format(editDate, "MMM d, yy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editDate}
                            onSelect={(d) => d && setEditDate(d)}
                            disabled={(d) => d > new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <input type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-10 w-24 rounded" />
                      <span className="text-xs text-muted-foreground">lbs ×</span>
                      <input type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-10 w-16 rounded" />
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => handleUpdate(log.id)} disabled={saving}
                          className="h-9 w-9 flex items-center justify-center bg-primary text-primary-foreground rounded hover:opacity-90 transition-all disabled:opacity-50">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={cancelEdit}
                          className="h-9 w-9 flex items-center justify-center bg-muted text-muted-foreground rounded hover:text-foreground transition-all">
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-mono text-muted-foreground w-[90px] flex-shrink-0">
                        {format(new Date(log.logged_at), "MMM d, yy")}
                      </span>
                      <span className="text-lg font-mono font-bold text-foreground">
                        {log.weight} <span className="text-muted-foreground text-sm">lbs</span>
                      </span>
                      <span className="text-sm text-muted-foreground">×</span>
                      <span className="text-lg font-mono font-bold text-foreground">{log.reps}</span>
                      <span className="text-sm text-primary font-mono ml-1">
                        est. {log.estimated_1rm} 1RM
                      </span>
                      {prevLog && weightDiff !== 0 && (
                        <span className="text-xs font-mono font-bold"
                          style={{ color: weightDiff > 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
                          {weightDiff > 0 ? "↑" : "↓"}{Math.abs(weightDiff)}
                        </span>
                      )}

                      {video ? (
                        <button
                          onClick={() => playVideo(video)}
                          className={cn(
                            "h-7 px-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border rounded transition-all",
                            video.status === "approved"
                              ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 animate-pulse"
                              : video.status === "pending_review"
                                ? "border-yellow-500/40 text-yellow-600 bg-yellow-500/10"
                                : "border-muted text-muted-foreground"
                          )}
                          title={video.status === "approved" ? "Watch video" : "Under review"}
                        >
                          {video.status === "approved" ? <CheckCircle size={12} /> : <Clock size={12} />}
                          <Video size={12} />
                          {video.status === "pending_review" && "Review"}
                        </button>
                      ) : (
                        <button
                          onClick={() => triggerLateUpload(log.id)}
                          disabled={uploadingVideoLogId === log.id}
                          className="h-7 px-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 rounded transition-all disabled:opacity-50"
                          title="Attach video proof"
                        >
                          {uploadingVideoLogId === log.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          <Video size={12} />
                        </button>
                      )}

                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => startEdit(log)}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary transition-all" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(log.id)} disabled={isDeleting}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all disabled:opacity-50" title="Delete">
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <>
                    <CoachNotesBadge logId={log.id} userId={effectiveUserId} notes={logNotes} isAdmin={isAdmin} onRefresh={fetchNotes} />
                    <LiftChat logId={log.id} userId={effectiveUserId} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input ref={lateVideoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleLateVideoUpload} />

      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogTitle className="sr-only">Lift Video</DialogTitle>
          {playingVideo && (
            <video
              src={playingVideo.url}
              controls
              autoPlay
              preload="none"
              className="w-full rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogHistory;
