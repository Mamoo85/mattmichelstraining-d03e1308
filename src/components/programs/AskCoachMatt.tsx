import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { MessageSquare, Video, Send, Loader2, X, AlertTriangle } from "lucide-react";

interface AskCoachMattProps {
  programId: string;
  programTitle: string;
  weekNumber: number;
  dayNumber: number;
  exercises: string[];
}

const ACCEPTED_VIDEO = "video/mp4,video/quicktime,video/webm";
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB

const AskCoachMatt = ({ programId, programTitle, weekNumber, dayNumber, exercises }: AskCoachMattProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(exercises[0] || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sizeWarning, setSizeWarning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSizeWarning(false);

    if (file.size > MAX_VIDEO_SIZE) {
      setSizeWarning(true);
      toast({
        title: "Video too large",
        description: "Max 25MB. Try trimming your clip to 15-30 seconds or recording at a lower resolution.",
        variant: "destructive",
      });
      return;
    }
    setVideoFile(file);
  };

  const handleSend = async () => {
    if (!user || !message.trim()) {
      toast({ title: "Enter a message", variant: "destructive" });
      return;
    }

    setSending(true);
    let videoUrl: string | null = null;

    try {
      // Upload video if selected
      if (videoFile) {
        const ext = videoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("form_checks")
          .upload(path, videoFile, { contentType: videoFile.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("form_checks")
          .getPublicUrl(path);
        videoUrl = urlData.publicUrl;
      }

      // Insert message record
      await supabase.from("program_messages").insert({
        user_id: user.id,
        program_id: programId,
        exercise_name: selectedExercise,
        week_number: weekNumber,
        day_number: dayNumber,
        message: message.trim(),
        video_url: videoUrl,
      });

      // Send email notification to coach
      await supabase.functions.invoke("notify-coach-question", {
        body: {
          programTitle,
          exerciseName: selectedExercise,
          weekNumber,
          dayNumber,
          message: message.trim(),
          videoUrl,
        },
      });

      toast({ title: "Sent to Coach Matt", description: "He'll review and get back to you." });
      setMessage("");
      setVideoFile(null);
      setSizeWarning(false);
    } catch (e: any) {
      toast({ title: "Error sending", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card shadow-m2 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-primary" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">Ask Coach Matt</h3>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Have a question about form, programming, or how an exercise feels? Send Matt a message — upload a video for a direct form check.
      </p>

      {/* Exercise selector */}
      {exercises.length > 1 && (
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">About which exercise?</label>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          >
            {exercises.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
      )}

      {/* Message */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's your question for Matt?"
        className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20 mb-3 resize-none"
        maxLength={1000}
      />

      {/* Video upload */}
      <div className="flex items-center gap-2 mb-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_VIDEO}
          capture="environment"
          onChange={handleVideoSelect}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-m2"
        >
          <Video size={12} />
          {videoFile ? "Change Video" : "Upload Form Check"}
        </button>
        {videoFile && (
          <div className="flex items-center gap-1 text-[11px] text-foreground">
            <span className="truncate max-w-[140px]">{videoFile.name}</span>
            <span className="text-[9px] text-muted-foreground">({(videoFile.size / 1024 / 1024).toFixed(1)}MB)</span>
            <button onClick={() => { setVideoFile(null); setSizeWarning(false); }} className="text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Size warning */}
      {sizeWarning && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 p-2.5 mb-3">
          <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-destructive font-bold">Video exceeds 25MB limit</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Trim your clip to 15–30 seconds, or record at a lower resolution. On iPhone, go to Settings → Camera → Record Video → choose 1080p or 720p.
            </p>
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mb-3">MP4, MOV, or WebM · Max 25MB · Keep clips to 15–30 sec · Videos auto-delete after 30 days</p>

      {/* Send */}
      <button
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50 flex items-center gap-2 w-full justify-center"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {sending ? "Sending…" : "Send to Coach"}
      </button>
    </div>
  );
};

export default AskCoachMatt;
