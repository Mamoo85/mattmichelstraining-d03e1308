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
    // For admin: always play. For user: only if approved
    if (!isAdmin && video.status !== "approved") return;
    const { data } = await supabase.storage.from("lift_videos").createSignedUrl(video.video_path, 300);
    if (data?.signedUrl) {
      setPlayingVideo({ url: data.signedUrl, exercise: "Lift Video" });
    }
  };

  if (logs.length === 0) return null;

  const notesForLog = (logId: string) => coachNotes.filter((n) => n.progress_log_id === logId);
  const videoForLog = (logId: string) => liftVideos.find((v) => v.progress_log_id === logId);
  const totalNotes = coachNotes.length;

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all mb-3"
      >
        {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Log History ({logs.length} entries)
        {totalNotes > 0 && (
          <span className="text-primary ml-1">· {totalNotes} coach note{totalNotes !== 1 ? "s" : ""}</span>
        )}
      </button>

      {showHistory && (
        <div className="bg-card border border-border divide-y divide-border">
          {[...logs].reverse().map((log, idx) => {
            const isEditing = editingId === log.id;
            const isDeleting = deletingId === log.id;
            const logNotes = notesForLog(log.id);
            const video = videoForLog(log.id);
            const prevLog = idx < logs.length - 1 ? [...logs].reverse()[idx + 1] : null;
            const weightDiff = prevLog ? log.weight - prevLog.weight : 0;

            return (
              <div key={log.id} className="p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-8 w-[120px] text-xs font-mono px-2">
                            <CalendarIcon className="mr-1 h-3 w-3 text-primary" />
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
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-xs focus:ring-1 focus:ring-primary outline-none h-8 w-20" />
                      <span className="text-[10px] text-muted-foreground">lbs ×</span>
                      <input type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)}
                        className="bg-background border border-border text-right pr-2 font-mono text-primary text-xs focus:ring-1 focus:ring-primary outline-none h-8 w-14" />
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => handleUpdate(log.id)} disabled={saving}
                          className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50">
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button onClick={cancelEdit}
                          className="h-8 w-8 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all">
                          <X size={12} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-mono text-muted-foreground w-[85px] flex-shrink-0">
                        {format(new Date(log.logged_at), "MMM d, yy")}
                      </span>
                      <span className="text-sm font-mono font-bold text-foreground">
                        {log.weight} <span className="text-muted-foreground text-xs">lbs</span>
                      </span>
                      <span className="text-xs text-muted-foreground">×</span>
                      <span className="text-sm font-mono font-bold text-foreground">{log.reps}</span>
                      <span className="text-[10px] text-primary font-mono ml-1">
                        est. {log.estimated_1rm} 1RM
                      </span>
                      {prevLog && weightDiff !== 0 && (
                        <span className="text-[9px] font-mono font-bold"
                          style={{ color: weightDiff > 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
                          {weightDiff > 0 ? "↑" : "↓"}{Math.abs(weightDiff)}
                        </span>
                      )}

                      {/* Video indicator */}
                      {video && (
                        <button
                          onClick={() => playVideo(video)}
                          className={cn(
                            "h-6 px-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border rounded transition-all",
                            video.status === "approved"
                              ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 animate-pulse"
                              : video.status === "pending_review"
                                ? "border-yellow-500/40 text-yellow-600 bg-yellow-500/10"
                                : "border-muted text-muted-foreground"
                          )}
                          title={video.status === "approved" ? "Watch video" : "Under review"}
                        >
                          {video.status === "approved" ? <CheckCircle size={10} /> : <Clock size={10} />}
                          <Video size={10} />
                          {video.status === "pending_review" && "Review"}
                        </button>
                      )}

                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => startEdit(log)}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-all" title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(log.id)} disabled={isDeleting}
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all disabled:opacity-50" title="Delete">
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
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

      {/* Video playback modal */}
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
