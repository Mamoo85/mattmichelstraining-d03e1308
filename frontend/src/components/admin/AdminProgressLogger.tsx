import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Loader2, Calendar, Check, ChevronDown, Video, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { LIFT_CATEGORIES, ALL_LIFTS } from "@/components/progress/liftConfig";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  user_id: string;
  full_name: string | null;
  athlete_name: string | null;
  email: string | null;
}

interface RecentLog {
  id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  logged_at: string;
}

const AdminProgressLogger = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Form state
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Exercise dropdown from liftConfig
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);

  // Recent logs for selected user
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const MAX_VIDEO_SIZE = 5 * 1024 * 1024; // 5MB

  useEffect(() => {
    const loadProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .order("full_name") as { data: UserProfile[] | null };
      setProfiles(data || []);
      setLoadingProfiles(false);
    };
    loadProfiles();
  }, []);


  useEffect(() => {
    if (!selectedUser) { setRecentLogs([]); return; }
    const loadLogs = async () => {
      setLoadingLogs(true);
      const { data } = await supabase
        .from("progress_logs")
        .select("id, exercise_name, weight, reps, logged_at")
        .eq("user_id", selectedUser.user_id)
        .order("logged_at", { ascending: false })
        .limit(10) as { data: RecentLog[] | null };
      setRecentLogs(data || []);
      setLoadingLogs(false);
    };
    loadLogs();
  }, [selectedUser]);

  const displayName = (p: UserProfile) =>
    p.athlete_name || p.full_name || p.email || "Unknown";

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return profiles.slice(0, 20);
    const q = userSearch.toLowerCase();
    return profiles.filter(
      (p) =>
        (p.full_name?.toLowerCase().includes(q)) ||
        (p.athlete_name?.toLowerCase().includes(q)) ||
        (p.email?.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [profiles, userSearch]);

  const allLiftNames = useMemo(() => ALL_LIFTS.map((l) => l.name), []);

  const filteredExercises = useMemo(() => {
    if (!exerciseName.trim()) return allLiftNames;
    const q = exerciseName.toLowerCase();
    return allLiftNames.filter((e) => e.toLowerCase().includes(q));
  }, [allLiftNames, exerciseName]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: "Video too large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    setVideoFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedUser) { toast({ title: "Select a user", variant: "destructive" }); return; }
    if (!exerciseName.trim()) { toast({ title: "Enter exercise name", variant: "destructive" }); return; }
    if (!weight || parseFloat(weight) <= 0) { toast({ title: "Enter valid weight", variant: "destructive" }); return; }

    const w = parseFloat(weight);
    const r = parseInt(reps) || 1;
    const estimated1rm = Math.round(w * (1 + r / 30) * 10) / 10;

    setSaving(true);
    try {
      const { data: logData, error } = await supabase.from("progress_logs").insert({
        user_id: selectedUser.user_id,
        exercise_name: exerciseName.trim(),
        weight: w,
        reps: r,
        estimated_1rm: estimated1rm,
        logged_at: logDate.toISOString(),
      }).select("id").single();
      if (error) throw error;

      // Upload video if attached
      if (videoFile && logData?.id) {
        const ext = videoFile.name.split(".").pop() || "mp4";
        const path = `${selectedUser.user_id}/${logData.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lift_videos")
          .upload(path, videoFile, { contentType: videoFile.type });
        if (!upErr) {
          await supabase.from("lift_videos" as any).insert({
            progress_log_id: logData.id,
            user_id: selectedUser.user_id,
            video_path: path,
            status: "pending_review",
          });
          // Auto AI analysis
          supabase.functions.invoke("ai-video-form-review", {
            body: {
              videoUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/lift_videos/${path}`,
              exerciseName: exerciseName.trim(),
              athleteName: displayName(selectedUser),
            },
          }).then(async (res) => {
            if (res.data?.review) {
              await supabase.from("lift_videos" as any)
                .update({ ai_analysis: res.data.review })
                .eq("progress_log_id", logData.id);
            }
          }).catch(() => {});
        }
        setVideoFile(null);
        if (videoInputRef.current) videoInputRef.current.value = "";
      }

      toast({ title: "Lift logged", description: `${exerciseName} · ${w}lbs × ${r} for ${displayName(selectedUser)}` });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);

      setExerciseName("");
      setWeight("");
      setReps("");

      // Refresh recent logs
      const { data } = await supabase
        .from("progress_logs")
        .select("id, exercise_name, weight, reps, logged_at")
        .eq("user_id", selectedUser.user_id)
        .order("logged_at", { ascending: false })
        .limit(10) as { data: RecentLog[] | null };
      setRecentLogs(data || []);
    } catch (err: any) {
      toast({ title: "Failed to log", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const quickRepeat = (log: RecentLog) => {
    setExerciseName(log.exercise_name);
    setWeight(String(log.weight));
    setReps(String(log.reps));
  };

  return (
    <div className="space-y-5">
      {/* User Selector */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          Select Athlete
        </label>
        <div className="relative">
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={cn(
              "w-full bg-card border border-border px-4 py-3 flex items-center justify-between cursor-pointer transition-all",
              selectedUser ? "text-foreground" : "text-muted-foreground",
              showUserDropdown && "ring-1 ring-primary"
            )}
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-muted-foreground" />
              {selectedUser ? (
                <span className="text-sm font-bold">{displayName(selectedUser)}</span>
              ) : (
                <span className="text-sm">Search athletes…</span>
              )}
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </div>

          {showUserDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border shadow-lg max-h-64 overflow-y-auto">
              <div className="sticky top-0 bg-card border-b border-border p-2">
                <input
                  autoFocus
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Type name or email…"
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {loadingProfiles ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No users found</p>
              ) : (
                filteredUsers.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => { setSelectedUser(p); setShowUserDropdown(false); setUserSearch(""); }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                      selectedUser?.user_id === p.user_id && "bg-primary/10"
                    )}
                  >
                    <p className="text-sm font-bold text-foreground">{displayName(p)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.email}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Log Form */}
      {selectedUser && (
        <div className="bg-card border border-border p-4 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Log Lift for {displayName(selectedUser)}
          </p>

          {/* Exercise select — grouped by lift category */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Exercise</label>
            <select
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              className="w-full bg-background border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Select a lift…</option>
              {LIFT_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={cat.label}>
                  {cat.lifts.map((lift) => (
                    <option key={lift.name} value={lift.name}>{lift.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Weight, Reps, Date row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Weight (lbs)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="135"
                className="w-full bg-background border border-border px-3 py-3 text-sm font-mono text-foreground text-center focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Reps</label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="5"
                className="w-full bg-background border border-border px-3 py-3 text-sm font-mono text-foreground text-center focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full bg-background border border-border px-3 py-3 text-sm text-foreground flex items-center justify-center gap-1.5 hover:border-primary/50 transition-colors">
                    <Calendar size={12} className="text-muted-foreground" />
                    {format(logDate, "MMM d")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarPicker
                    mode="single"
                    selected={logDate}
                    onSelect={(d) => d && setLogDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Video attachment */}
          <div className="flex items-center gap-2">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleVideoSelect}
            />
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                videoFile
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:text-primary hover:border-primary"
              )}
            >
              <Video size={12} /> {videoFile ? "Video Attached" : "Attach Video"}
            </button>
            {videoFile && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)}MB)</span>
                <button onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                  className="text-destructive hover:opacity-80"><X size={12} /></button>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !exerciseName.trim() || !weight}
            className={cn(
              "w-full py-4 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              showSuccess
                ? "bg-green-600 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90",
              "disabled:opacity-50"
            )}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : showSuccess ? (
              <><Check size={16} /> Logged!</>
            ) : (
              <><Plus size={16} /> Log Lift</>
            )}
          </button>
        </div>
      )}

      {/* Recent Logs */}
      {selectedUser && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Recent Logs — {displayName(selectedUser)}
          </p>
          {loadingLogs ? (
            <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>
          ) : recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-card border border-border p-4 text-center">No logs yet for this athlete.</p>
          ) : (
            <div className="space-y-1">
              {recentLogs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => quickRepeat(log)}
                  className="w-full bg-card border border-border p-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                  title="Click to repeat this lift"
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">{log.exercise_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(log.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-primary">
                    {log.weight}lbs × {log.reps}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminProgressLogger;
