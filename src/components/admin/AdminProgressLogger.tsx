import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Loader2, Calendar, Check, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { LIFT_CATEGORIES, ALL_LIFTS } from "@/components/progress/liftConfig";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

  // Exercise autocomplete
  const [exerciseOptions, setExerciseOptions] = useState<string[]>([]);
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);

  // Recent logs for selected user
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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
    const loadExercises = async () => {
      const { data } = await supabase
        .from("exercise_library")
        .select("title")
        .order("title");
      setExerciseOptions((data || []).map((e: any) => e.title));
    };
    loadExercises();
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

  const filteredExercises = useMemo(() => {
    if (!exerciseName.trim()) return exerciseOptions.slice(0, 15);
    const q = exerciseName.toLowerCase();
    return exerciseOptions.filter((e) => e.toLowerCase().includes(q)).slice(0, 15);
  }, [exerciseOptions, exerciseName]);

  const handleSubmit = async () => {
    if (!selectedUser) { toast({ title: "Select a user", variant: "destructive" }); return; }
    if (!exerciseName.trim()) { toast({ title: "Enter exercise name", variant: "destructive" }); return; }
    if (!weight || parseFloat(weight) <= 0) { toast({ title: "Enter valid weight", variant: "destructive" }); return; }

    const w = parseFloat(weight);
    const r = parseInt(reps) || 1;
    const estimated1rm = Math.round(w * (1 + r / 30) * 10) / 10;

    setSaving(true);
    try {
      const { error } = await supabase.from("progress_logs").insert({
        user_id: selectedUser.user_id,
        exercise_name: exerciseName.trim(),
        weight: w,
        reps: r,
        estimated_1rm: estimated1rm,
        logged_at: logDate.toISOString(),
      });
      if (error) throw error;

      toast({ title: "Lift logged", description: `${exerciseName} · ${w}lbs × ${r} for ${displayName(selectedUser)}` });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);

      // Reset form but keep user selected
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

          {/* Exercise Name with autocomplete */}
          <div className="relative">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Exercise</label>
            <input
              value={exerciseName}
              onChange={(e) => { setExerciseName(e.target.value); setShowExerciseDropdown(true); }}
              onFocus={() => setShowExerciseDropdown(true)}
              onBlur={() => setTimeout(() => setShowExerciseDropdown(false), 200)}
              placeholder="e.g. Back Squat, Bench Press…"
              className="w-full bg-background border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
            />
            {showExerciseDropdown && filteredExercises.length > 0 && (
              <div className="absolute z-40 w-full mt-1 bg-card border border-border shadow-lg max-h-48 overflow-y-auto">
                {filteredExercises.map((ex) => (
                  <button
                    key={ex}
                    onMouseDown={() => { setExerciseName(ex); setShowExerciseDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
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
