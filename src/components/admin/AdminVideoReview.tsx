import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Video, Play, MessageSquare, Dumbbell, User, Calendar, Filter, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import AiAssistButton from "./AiAssistButton";

interface VideoEntry {
  id: string;
  source: "program_message" | "exercise_log";
  videoUrl: string;
  userName: string | null;
  userId: string;
  exerciseName: string;
  message: string | null;
  coachReply: string | null;
  createdAt: string;
  programTitle?: string;
  weekDay?: string;
}

const AdminVideoReview = () => {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "program_message" | "exercise_log">("all");
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchAllVideos();
  }, []);

  const fetchAllVideos = async () => {
    setLoading(true);
    try {
      // Fetch program messages with videos
      const { data: programMsgs } = await supabase
        .from("program_messages")
        .select("id, user_id, exercise_name, message, video_url, coach_reply, created_at, week_number, day_number, program_id")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch logged exercises with videos
      const { data: exerciseLogs } = await supabase
        .from("logged_exercises")
        .select("id, exercise_id, client_notes, video_url, coach_reply, created_at, log_id")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      // Get user profiles for names
      const userIds = new Set<string>();
      programMsgs?.forEach((m) => userIds.add(m.user_id));

      // For exercise logs, we need to get user_id from workout_logs
      const logIds = exerciseLogs?.map((e) => e.log_id) || [];
      let logUserMap: Record<string, string> = {};
      if (logIds.length > 0) {
        const { data: logs } = await supabase
          .from("workout_logs")
          .select("id, user_id")
          .in("id", logIds);
        logs?.forEach((l) => {
          logUserMap[l.id] = l.user_id;
          userIds.add(l.user_id);
        });
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .in("user_id", Array.from(userIds));
      const profileMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        profileMap[p.user_id] = p.athlete_name || p.full_name || p.email || "Unknown";
      });

      // Fetch program titles
      const programIds = [...new Set(programMsgs?.map((m) => m.program_id) || [])];
      let programMap: Record<string, string> = {};
      if (programIds.length > 0) {
        const { data: programs } = await supabase
          .from("training_programs")
          .select("id, title")
          .in("id", programIds);
        programs?.forEach((p) => { programMap[p.id] = p.title; });
      }

      // Fetch exercise titles
      const exerciseIds = [...new Set(exerciseLogs?.map((e) => e.exercise_id) || [])];
      let exerciseMap: Record<string, string> = {};
      if (exerciseIds.length > 0) {
        const { data: exercises } = await supabase
          .from("exercise_library")
          .select("id, title")
          .in("id", exerciseIds);
        exercises?.forEach((e) => { exerciseMap[e.id] = e.title; });
      }

      const entries: VideoEntry[] = [];

      programMsgs?.forEach((m) => {
        if (m.video_url) {
          entries.push({
            id: `pm-${m.id}`,
            source: "program_message",
            videoUrl: m.video_url,
            userName: profileMap[m.user_id] || null,
            userId: m.user_id,
            exerciseName: m.exercise_name,
            message: m.message,
            coachReply: m.coach_reply,
            createdAt: m.created_at,
            programTitle: programMap[m.program_id] || "Unknown Program",
            weekDay: `W${m.week_number}D${m.day_number}`,
          });
        }
      });

      exerciseLogs?.forEach((e) => {
        if (e.video_url) {
          const userId = logUserMap[e.log_id] || "";
          entries.push({
            id: `el-${e.id}`,
            source: "exercise_log",
            videoUrl: e.video_url,
            userName: profileMap[userId] || null,
            userId,
            exerciseName: exerciseMap[e.exercise_id] || "Unknown Exercise",
            message: e.client_notes,
            coachReply: e.coach_reply,
            createdAt: e.created_at,
          });
        }
      });

      // Sort by date descending
      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVideos(entries);
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? videos : videos.filter((v) => v.source === filter);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span className="ml-2 text-sm text-muted-foreground">Loading videos…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video size={18} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Client Videos ({filtered.length})
          </h2>
        </div>
        <div className="flex gap-1">
          {(["all", "program_message", "exercise_log"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "program_message" ? "Ask Matt" : "Form Checks"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Video size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No client videos found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const isExpanded = expandedVideo === v.id;
            return (
              <div key={v.id} className="bg-card shadow-m2 overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedVideo(isExpanded ? null : v.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-m2"
                >
                  <div className={`p-2 flex-shrink-0 ${v.source === "program_message" ? "bg-primary/10" : "bg-blue-500/10"}`}>
                    {v.source === "program_message" ? (
                      <MessageSquare size={14} className="text-primary" />
                    ) : (
                      <Dumbbell size={14} className="text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-foreground truncate">
                        {v.userName || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(v.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary truncate">
                        {v.exerciseName}
                      </span>
                      {v.weekDay && (
                        <span className="text-[10px] text-muted-foreground font-mono">{v.weekDay}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.coachReply ? (
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Replied</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Pending</span>
                    )}
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    {/* Video player */}
                    <div className="bg-background rounded overflow-hidden">
                      <video
                        src={v.videoUrl}
                        controls
                        preload="metadata"
                        className="w-full max-h-[400px] object-contain"
                      />
                    </div>

                    {/* Context */}
                    {v.programTitle && (
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-bold text-foreground">Program:</span> {v.programTitle}
                      </div>
                    )}

                    {v.message && (
                      <div className="bg-muted/30 p-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                          Client Note
                        </span>
                        <p className="text-sm text-foreground">{v.message}</p>
                      </div>
                    )}

                    {v.coachReply && (
                      <div className="bg-primary/5 border-l-2 border-primary p-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                          Your Reply
                        </span>
                        <p className="text-sm text-foreground">{v.coachReply}</p>
                      </div>
                    )}

                    {/* AI Form Check + Open in new tab */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <AiAssistButton
                        type="form_check"
                        context={{
                          exerciseName: v.exerciseName,
                          athleteName: v.userName,
                          clientNotes: v.message,
                          hasVideo: true,
                        }}
                        onResult={(text) => {
                          navigator.clipboard.writeText(text);
                        }}
                        label="AI Form Check"
                      />
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-m2"
                      >
                        <ExternalLink size={12} />
                        Open full-size video
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminVideoReview;
