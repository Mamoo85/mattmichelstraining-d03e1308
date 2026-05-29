import { useState, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceNoteButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

const VoiceNoteButton = ({ onTranscript, className }: VoiceNoteButtonProps) => {
  const [listening, setListening] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (listening) {
      setListening(false);
      return;
    }

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      onTranscript(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, supported, onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-sm transition-all",
        listening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-muted text-muted-foreground hover:text-foreground",
        className
      )}
      title={listening ? "Stop recording" : "Voice note"}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
};

export default VoiceNoteButton;
