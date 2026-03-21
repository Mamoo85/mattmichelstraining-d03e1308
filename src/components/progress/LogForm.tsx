import { useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Mic, Video, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LogFormProps {
  activeLift: string;
  repMax: number;
  effectiveUserId: string;
  onLogged: () => Promise<void>;
}

// Parse spoken text like "225 for 8" or "set one 225 pounds for eight reps"
function parseSpokenSet(text: string): { weight?: string; reps?: string } {
  const lower = text.toLowerCase().replace(/,/g, "");
  const wordNums: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
    sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  };
  let normalized = lower;
  for (const [word, num] of Object.entries(wordNums)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }
  const nums = normalized.match(/\d+\.?\d*/g);
  if (!nums || nums.length === 0) return {};
  let weight = nums[0];
  let reps = nums.length > 1 ? nums[nums.length > 2 ? nums.length - 1 : 1] : undefined;
  if (normalized.match(new RegExp(`${nums[0]}\\s*(reps?|rep)\\b`)) && nums.length > 1) {
    reps = nums[0];
    weight = nums[1];
  }
  return { weight, reps };
}

const MAX_VIDEO_SIZE = 5 * 1024 * 1024; // 5MB — optimized for low storage

const LogForm = ({ activeLift, repMax, effectiveUserId, onLogged }: LogFormProps) => {
  const { user, subscriptionTier } = useAuth();
  const [logWeight, setLogWeight] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [logging, setLogging] = useState(false);
  const [listening, setListening] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Check if user can attach video (paid or in-person)
  const canAttachVideo = !!subscriptionTier || false; // Will also check is_in_person via profile query

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: "Video too large", description: "Max 10MB. Try a shorter clip.", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    toast({ title: "Video attached", description: file.name });
  };

  const removeVideo = () => {
    setVideoFile(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Speech not supported", description: "Use Chrome or Safari for voice logging.", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseSpokenSet(transcript);
      if (parsed.weight) setLogWeight(parsed.weight);
      if (parsed.reps) setLogReps(parsed.reps);
      const parts = [];
      if (parsed.weight) parts.push(`${parsed.weight} lbs`);
      if (parsed.reps) parts.push(`${parsed.reps} reps`);
      toast({
        title: parts.length > 0 ? `Got it: ${parts.join(" × ")}` : "Couldn't parse that",
        description: `Heard: "${transcript}"`,
      });
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        toast({ title: "Mic error", description: event.error, variant: "destructive" });
      }
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleLog = async () => {
    const weight = parseFloat(logWeight);
    const reps = parseInt(logReps) || repMax;
    if (!weight || weight <= 0) {
      toast({ title: "Enter a valid weight", variant: "destructive" });
      return;
    }
    setLogging(true);
    const estimated1rm = Math.round(weight * (1 + reps / 30));

    const { data: logData, error } = await supabase.from("progress_logs").insert({
      user_id: effectiveUserId,
      exercise_name: activeLift,
      weight,
      reps,
      estimated_1rm: estimated1rm,
      logged_at: logDate.toISOString(),
    }).select("id").single();

    if (error) {
      toast({ title: "Failed to log", description: error.message, variant: "destructive" });
      setLogging(false);
      return;
    }

    // Upload video if attached
    if (videoFile && logData?.id) {
      setUploadingVideo(true);
      try {
        const ext = videoFile.name.split(".").pop() || "mp4";
        const path = `${effectiveUserId}/${logData.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("lift_videos")
          .upload(path, videoFile, { contentType: videoFile.type, upsert: false });
        if (uploadError) throw uploadError;

        // Insert into lift_videos table
        await supabase.from("lift_videos" as any).insert({
          progress_log_id: logData.id,
          user_id: effectiveUserId,
          video_path: path,
          status: "pending_review",
        });

        // Trigger AI analysis in background
        supabase.functions.invoke("ai-video-form-review", {
          body: {
            videoUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/lift_videos/${path}`,
            exerciseName: activeLift,
            athleteName: "Athlete",
          },
        }).then(async (res) => {
          if (res.data?.review) {
            await supabase.from("lift_videos" as any)
              .update({ ai_analysis: res.data.review })
              .eq("progress_log_id", logData.id);
          }
        }).catch(() => {}); // Non-blocking

        toast({ title: "Video submitted for review" });
      } catch (err: any) {
        toast({ title: "Video upload failed", description: err.message, variant: "destructive" });
      }
      setUploadingVideo(false);
      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }

    toast({ title: "Logged +25 pts", description: `${activeLift}: ${weight} lbs × ${reps}` });
    setLogWeight("");
    setLogReps("");
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 500);
    await onLogged();
    setLogging(false);
  };

  return (
    <div className="mt-4 mb-4 p-6 bg-card border border-border rounded-xl">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
        Log {activeLift}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 w-[140px] justify-start text-left font-mono text-xs px-2",
                !logDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
              {format(logDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={logDate}
              onSelect={(d) => d && setLogDate(d)}
              disabled={(d) => d > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <input
          type="number"
          placeholder="Weight (lbs)"
          value={logWeight}
          onChange={(e) => setLogWeight(e.target.value)}
          className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-28"
        />
        <input
          type="number"
          placeholder={`Reps (${repMax})`}
          value={logReps}
          onChange={(e) => setLogReps(e.target.value)}
          className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-9 w-20"
        />
        <button
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          className={cn(
            "h-9 w-9 flex items-center justify-center border transition-all",
            listening
              ? "bg-primary text-primary-foreground border-primary animate-pulse"
              : "bg-muted text-muted-foreground border-border hover:text-primary hover:border-primary"
          )}
          title="Hold to speak — e.g. '225 for 8'"
        >
          <Mic size={14} />
        </button>

        {/* Video capture button — paid/in-person only */}
        {canAttachVideo && (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleVideoSelect}
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              className={cn(
                "h-9 w-9 flex items-center justify-center border transition-all",
                videoFile
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:text-primary hover:border-primary"
              )}
              title="Attach lift video"
            >
              <Video size={14} />
            </button>
          </>
        )}

        <button
          onClick={handleLog}
          disabled={logging || uploadingVideo}
          className={`bg-primary text-primary-foreground px-5 h-9 text-[10px] font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-transform duration-100 disabled:opacity-50 ${logSuccess ? "animate-log-success" : ""}`}
        >
          {logging || uploadingVideo ? <Loader2 size={14} className="animate-spin" /> : "Log"}
        </button>
      </div>

      {/* Video preview chip */}
      {videoFile && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-primary flex items-center gap-1">
            <Video size={10} /> {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)}MB)
          </span>
          <button onClick={removeVideo} className="text-muted-foreground hover:text-destructive">
            <X size={12} />
          </button>
        </div>
      )}

      {listening && (
        <p className="text-[10px] text-primary mt-2 animate-pulse">
          🎙️ Listening… say something like "225 for 8 reps"
        </p>
      )}
    </div>
  );
};

export default LogForm;
