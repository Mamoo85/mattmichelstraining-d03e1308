import { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, Clock, Dumbbell, Flame, Flag, Camera, Share2, Loader2, CheckCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import SocialShareButtons from "./SocialShareButtons";
import VoiceNoteButton from "./VoiceNoteButton";
import type { LoggedExerciseData } from "./WorkoutLogger";
import type { RecoveryData } from "./RecoveryInput";

interface PostWorkoutSummaryProps {
  exercises: LoggedExerciseData[];
  duration: number;
  workoutLogId: string;
  workoutTitle: string;
  date: Date;
  sessionNotes: string;
  recovery: RecoveryData;
  onClose: () => void;
}

const PostWorkoutSummary = ({
  exercises,
  duration,
  workoutLogId,
  workoutTitle,
  date,
  sessionNotes,
  recovery,
  onClose,
}: PostWorkoutSummaryProps) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [notes, setNotes] = useState(sessionNotes);
  const [flagMatt, setFlagMatt] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calculate stats
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalReps = exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps || 0), 0),
    0
  );
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
    0
  );
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr = `${mins}:${String(secs).padStart(2, "0")}`;

  const statsText = `🏋️ ${workoutTitle}\n📊 ${exercises.length} exercises · ${totalSets} sets · ${totalReps} reps\n💪 ${totalVolume.toLocaleString()} lbs total volume\n⏱️ ${mins} min`;

  // AI Analysis
  useEffect(() => {
    const analyze = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ai-workout-analysis", {
          body: {
            exercises: exercises.map((e) => ({
              title: e.exerciseTitle,
              sets: e.sets,
              flagged: e.flagForCoach,
              notes: e.clientNotes,
            })),
            duration,
            recovery,
            sessionNotes,
            workoutTitle,
          },
        });
        if (error) throw error;
        setAnalysis(data?.analysis || "Great session! Keep pushing.");
      } catch {
        setAnalysis("Great workout! Keep up the consistency. 💪");
      } finally {
        setAnalyzing(false);
      }
    };
    analyze();
  }, []);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Share to community
  const handleShareToCommunity = useCallback(async () => {
    if (!user || shared) return;
    setSharing(true);

    let imageUrl: string | null = null;
    let imageStatus = "no_image";

    // Upload image if provided
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `workout-shares/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("form-check-videos")
        .upload(path, imageFile, { contentType: imageFile.type });
      if (!upErr) {
        const { data: urlData } = supabase.storage
          .from("form-check-videos")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
        imageStatus = "pending"; // needs admin approval
      }
    }

    // Create shared result
    const { error } = await supabase.from("shared_workout_results" as any).insert({
      user_id: user.id,
      workout_log_id: workoutLogId,
      workout_title: workoutTitle,
      caption: notes || "",
      image_url: imageUrl,
      image_status: imageStatus,
      stats: {
        exercises: exercises.length,
        totalSets,
        totalReps,
        totalVolume,
        duration,
      },
      exercises: exercises.map((e) => ({
        title: e.exerciseTitle,
        sets: e.sets,
      })),
    });

    if (error) {
      toast.error("Failed to share");
      setSharing(false);
      return;
    }

    // Award points via edge function (server-side)
    await supabase.functions.invoke("ai-workout-analysis", {
      body: { action: "award_share_points", userId: user.id, workoutLogId },
    });

    setShared(true);
    setSharing(false);
    toast.success("+25 M² Points! Workout shared to the community.");
  }, [user, shared, imageFile, notes, exercises, workoutLogId, workoutTitle, totalSets, totalReps, totalVolume, duration]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Workout Complete</span>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-24">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">{workoutTitle}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border p-4 text-center">
            <Dumbbell size={16} className="text-primary mx-auto mb-1" />
            <div className="text-lg font-bold font-mono text-foreground">{exercises.length}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Exercises</div>
          </div>
          <div className="bg-card border border-border p-4 text-center">
            <Flame size={16} className="text-primary mx-auto mb-1" />
            <div className="text-lg font-bold font-mono text-foreground">{totalSets}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Sets</div>
          </div>
          <div className="bg-card border border-border p-4 text-center">
            <Trophy size={16} className="text-primary mx-auto mb-1" />
            <div className="text-lg font-bold font-mono text-foreground">{totalVolume.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Lbs Volume</div>
          </div>
          <div className="bg-card border border-border p-4 text-center">
            <Clock size={16} className="text-primary mx-auto mb-1" />
            <div className="text-lg font-bold font-mono text-foreground">{durationStr}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration</div>
          </div>
        </div>

        {/* Exercise breakdown */}
        <div className="bg-card border border-border p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Exercise Breakdown</span>
          {exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-border last:border-0 py-2">
              <span className="font-bold text-foreground">{ex.exerciseTitle}</span>
              <span className="font-mono text-primary">
                {ex.sets.length}×{ex.sets[0]?.reps || 0} @ {ex.sets[0]?.weight || 0}lbs
              </span>
            </div>
          ))}
        </div>

        {/* Workout Analysis */}
        <div className="bg-card border border-border p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">📊 Coach Analysis</span>
          {analyzing ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Analyzing your workout...
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{analysis}</p>
          )}
        </div>

        {/* Session Notes */}
        <div className="bg-card border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Session Notes</span>
            <VoiceNoteButton onTranscript={(t) => setNotes((prev) => (prev ? prev + " " + t : t))} />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go? Any PRs, pain, or breakthroughs?"
            className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-2 cursor-pointer">
              <Flag size={12} className={flagMatt ? "text-primary" : "text-muted-foreground"} />
              Flag for Coach Matt
            </label>
            <input
              type="checkbox"
              checked={flagMatt}
              onChange={(e) => setFlagMatt(e.target.checked)}
              className="accent-primary"
            />
          </div>
        </div>

        {/* Post-workout Image */}
        <div className="bg-card border border-border p-4 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">📸 Post-Workout Photo</span>
          <p className="text-[10px] text-muted-foreground">Images require admin approval before appearing in the community feed.</p>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Post workout" className="w-full max-h-48 object-cover rounded-sm" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 bg-background/80 rounded-full p-1"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-20 border-2 border-dashed border-border flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-all"
            >
              <Camera size={16} /> Add Photo
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {/* Share to Community */}
        <div className="bg-card border border-border p-4 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">🏆 Share to Community</span>
          <p className="text-[10px] text-muted-foreground">
            Share your results with fellow Mattletes and earn +25 M² Points!
          </p>
          <button
            onClick={handleShareToCommunity}
            disabled={sharing || shared}
            className="w-full bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sharing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : shared ? (
              <>
                <CheckCircle size={14} /> Shared! +25 Points
              </>
            ) : (
              <>
                <Share2 size={14} /> Share & Earn Points
              </>
            )}
          </button>
        </div>

        {/* Social Share */}
        <div className="bg-card border border-border p-4">
          <SocialShareButtons statsText={statsText} />
        </div>
      </main>

      {/* Done button */}
      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle size={14} /> Done
        </button>
      </footer>
    </div>
  );
};

export default PostWorkoutSummary;
