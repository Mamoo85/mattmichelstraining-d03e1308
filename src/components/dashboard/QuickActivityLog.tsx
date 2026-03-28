import { useState, useCallback, useRef, useEffect } from "react";
import { X, Mic, MicOff, Send, Check, Loader2, Dumbbell, Camera, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { safeLocalStorage } from "@/lib/browserStorage";
import FeatureLearningModal from "./FeatureLearningModal";
import { QUICK_ACTIVITY_TIP } from "./featureTips";

type Msg = { role: "user" | "assistant"; content: string };

interface WorkoutSheetExercise {
  title: string;
  sets: string;
  reps: string;
  weight?: string;
  notes?: string;
}

interface ActivitySummary {
  description: string;
  activity_type: string;
  intensity: string;
  weight_level: string | null;
  duration_minutes: number | null;
  exercises_mentioned: string[];
  ai_summary: string;
  ai_recovery_tips: string;
  workout_sheet?: WorkoutSheetExercise[];
}

interface QuickActivityLogProps {
  onClose: () => void;
  targetUserId?: string;
}

const INTENSITY_OPTIONS = ["Easy", "Moderate", "Hard"];
const DURATION_OPTIONS = ["20 min", "30 min", "45 min", "60+ min"];

const QuickActivityLog = ({ onClose, targetUserId }: QuickActivityLogProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTip, setShowTip] = useState(() => !safeLocalStorage.getItem(QUICK_ACTIVITY_TIP.storageKey));
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Track what info has been provided
  const [needsIntensity, setNeedsIntensity] = useState(false);
  const [needsDuration, setNeedsDuration] = useState(false);

  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, needsIntensity, needsDuration]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setStreaming(true);
    setNeedsIntensity(false);
    setNeedsDuration(false);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-activity-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "AI service error");
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const updateAssistant = (content: string) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              updateAssistant(accumulated);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Check for summary JSON in the final response
      const jsonMatch = accumulated.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.ready && parsed.summary) {
            setSummary(parsed.summary);
          }
        } catch { /* not valid JSON yet */ }
      }

      // Always show quick-tap bubbles after AI responds (unless we already have a summary)
      if (!jsonMatch) {
        // Show both sets of bubbles so users can always tap instead of typing
        setNeedsIntensity(true);
        setNeedsDuration(true);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming]);

  const toggleVoice = useCallback(() => {
    if (!supported) return;
    if (listening) { setListening(false); return; }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [listening, supported, sendMessage]);

  const handleBubbleTap = useCallback((value: string) => {
    setNeedsIntensity(false);
    setNeedsDuration(false);
    sendMessage(value);
  }, [sendMessage]);

  const handleSave = useCallback(async () => {
    if (!summary || !user) return;
    const saveUserId = targetUserId || user.id;
    setSaving(true);
    try {
      // Save activity log
      const { error } = await supabase.from("activity_logs" as any).insert({
        user_id: saveUserId,
        description: summary.description,
        activity_type: summary.activity_type,
        intensity: summary.intensity,
        weight_level: summary.weight_level,
        duration_minutes: summary.duration_minutes,
        exercises_mentioned: summary.exercises_mentioned,
        ai_summary: summary.ai_summary,
        ai_recovery_tips: summary.ai_recovery_tips,
      } as any);
      if (error) throw error;

      // If AI generated a workout sheet, also save it as a private workout
      if (summary.workout_sheet && summary.workout_sheet.length > 0) {
        const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        const { error: wsError } = await supabase.from("community_workouts").insert({
          user_id: saveUserId,
          title: `${summary.activity_type.charAt(0).toUpperCase() + summary.activity_type.slice(1)} — ${today}`,
          description: summary.ai_summary,
          creator_name: "AI Quick Log",
          is_public: false,
          source_type: "ai_quick_log",
          exercises: summary.workout_sheet as any,
        } as any);
        if (wsError) {
          console.error("Workout sheet save error:", wsError);
        } else {
          toast({ title: "Workout sheet saved! 📋", description: "Check your workout library." });
        }
      }

      toast({ title: "Activity logged! 💪", description: summary.ai_summary });
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [summary, user, targetUserId, onClose]);

  const dismissTip = useCallback(() => {
    safeLocalStorage.setItem(QUICK_ACTIVITY_TIP.storageKey, "1");
    setShowTip(false);
  }, []);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        // Send to scan-workout edge function
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-workout`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ image: base64, userId: user.id }),
        });
        if (!resp.ok) throw new Error("Failed to scan workout photo");
        const data = await resp.json();
        if (data.exercises && data.exercises.length > 0) {
          // Build a text summary from the scanned exercises and send it as a message
          const lines = data.exercises.map((ex: any) => {
            const setsInfo = ex.sets?.map((s: any) => `${s.reps} reps @ ${s.weight} lbs`).join(", ") || "";
            return `${ex.name}: ${setsInfo}`;
          }).join("\n");
          sendMessage(`I did this workout:\n${lines}`);
          toast({ title: "Photo scanned! 📸", description: `Found ${data.exercises.length} exercises` });
        } else {
          toast({ title: "No exercises found", description: "Try a clearer photo of your workout log.", variant: "destructive" });
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
      setUploadingPhoto(false);
    }
    // Reset file input
    if (photoRef.current) photoRef.current.value = "";
  }, [user, sendMessage]);

  const cleanContent = (content: string) => content.replace(/```json[\s\S]*?```/g, "").trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(10,10,10,0.97)", backdropFilter: "blur(20px)" }}
    >
      {showTip && <FeatureLearningModal tip={QUICK_ACTIVITY_TIP} onContinue={dismissTip} onDismiss={dismissTip} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p className="text-sm font-black" style={{ color: "#fafafa" }}>Quick Activity Log</p>
          <p className="text-[10px]" style={{ color: "#737373" }}>Tell us what you did — voice or text</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <X size={16} style={{ color: "#737373" }} />
        </button>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(249,115,22,0.1))" }}>
              <Mic size={28} style={{ color: "#22c55e" }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#e5e5e5" }}>What did you do today?</p>
            <p className="text-xs max-w-[260px] mx-auto" style={{ color: "#525252" }}>
              "We did a strength circuit with landmines and overhead press" or "I went for a 3-mile run"
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const display = msg.role === "assistant" ? cleanContent(msg.content) : msg.content;
          if (!display) return null;
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
                style={
                  msg.role === "user"
                    ? { background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.06)", color: "#e5e5e5" }
                }
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{display}</ReactMarkdown>
                  </div>
                ) : display}
              </div>
            </div>
          );
        })}

        {streaming && (
          <div className="flex justify-start">
            <div className="flex gap-1 px-4 py-3">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#f97316", animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#f97316", animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#f97316", animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Bubble buttons for intensity */}
        {needsIntensity && !streaming && (
          <div className="flex flex-wrap gap-2 pt-1">
            {INTENSITY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => handleBubbleTap(opt)}
                className="px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                style={{
                  background: opt === "Easy" ? "rgba(34,197,94,0.15)" : opt === "Moderate" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)",
                  border: `1px solid ${opt === "Easy" ? "rgba(34,197,94,0.4)" : opt === "Moderate" ? "rgba(249,115,22,0.4)" : "rgba(239,68,68,0.4)"}`,
                  color: opt === "Easy" ? "#22c55e" : opt === "Moderate" ? "#f97316" : "#ef4444",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Bubble buttons for duration */}
        {needsDuration && !streaming && (
          <div className="flex flex-wrap gap-2 pt-1">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => handleBubbleTap(opt)}
                className="px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                style={{
                  background: "rgba(0,240,255,0.1)",
                  border: "1px solid rgba(0,240,255,0.3)",
                  color: "#00f0ff",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary card */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="mx-4 mb-2 rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#22c55e" }}>Ready to Save</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                {summary.activity_type}
              </span>
            </div>
            <p className="text-[12px]" style={{ color: "#e5e5e5" }}>{summary.description}</p>
            <div className="flex gap-2 text-[10px]" style={{ color: "#a3a3a3" }}>
              <span>Intensity: <strong style={{ color: "#fafafa" }}>{summary.intensity}</strong></span>
              {summary.duration_minutes && <span>• {summary.duration_minutes} min</span>}
              {summary.weight_level && <span>• {summary.weight_level} weight</span>}
            </div>
            {/* Workout Sheet Preview */}
            {summary.workout_sheet && summary.workout_sheet.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ background: "rgba(249,115,22,0.1)" }}>
                  <Dumbbell size={10} style={{ color: "#f97316" }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#f97316" }}>Workout Sheet</span>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {summary.workout_sheet.map((ex, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-[11px] font-semibold" style={{ color: "#e5e5e5" }}>{ex.title}</span>
                      <span className="text-[10px] font-mono" style={{ color: "#a3a3a3" }}>
                        {ex.sets}×{ex.reps} {ex.weight ? `@ ${ex.weight}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.ai_recovery_tips && (
              <p className="text-[11px] italic" style={{ color: "#22c55e" }}>💡 {summary.ai_recovery_tips}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff" }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Saving..." : summary.workout_sheet?.length ? "Save Activity + Workout Sheet" : "Save Activity"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,10,0.95)" }}>
        {/* Hidden file input for photo */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        {/* Camera / Photo button */}
        <button
          onClick={() => photoRef.current?.click()}
          disabled={uploadingPhoto || streaming}
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-30"
          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}
        >
          {uploadingPhoto ? <Loader2 size={16} className="animate-spin" style={{ color: "#a855f7" }} /> : <Camera size={16} style={{ color: "#a855f7" }} />}
        </button>
        {supported && (
          <button
            onClick={toggleVoice}
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90"
            style={listening
              ? { background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.4)" }
              : { background: "rgba(255,255,255,0.06)" }
            }
          >
            {listening ? <MicOff size={18} color="#fff" /> : <Mic size={18} style={{ color: "#737373" }} />}
          </button>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder={listening ? "Listening..." : "Tell us what you did..."}
          disabled={streaming || listening}
          className="flex-1 h-10 rounded-full px-4 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "#fafafa", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-30"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <Send size={16} color="#fff" />
        </button>
      </div>
    </motion.div>
  );
};

export default QuickActivityLog;
