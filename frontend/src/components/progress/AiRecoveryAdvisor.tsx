import { useState } from "react";
import { Sparkles, Loader2, Heart, StopCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAiStream } from "@/hooks/useAiStream";
import ReactMarkdown from "react-markdown";

interface AiRecoveryAdvisorProps {
  userId: string;
}

const AiRecoveryAdvisor = ({ userId }: AiRecoveryAdvisorProps) => {
  const { stream, streaming, content, error, abort, reset } = useAiStream({
    functionName: "ai-athlete-stream",
  });

  const handleAnalyze = async () => {
    reset();
    await stream({ type: "recovery_advisor", context: {} });
  };

  if (error) {
    toast({ title: "Recovery analysis failed", description: error, variant: "destructive" });
  }

  return (
    <div className="p-4 bg-card border border-border mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
            Recovery Advisor
          </span>
        </div>
        <div className="flex items-center gap-2">
          {streaming && (
            <button
              onClick={abort}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <StopCircle size={10} />
              Stop
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={streaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground hover:bg-accent/80 transition-all disabled:opacity-50"
          >
            {streaming ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            {streaming ? "Analyzing…" : content ? "Refresh" : "Analyze My Recovery"}
          </button>
        </div>
      </div>

      {!content && !streaming && (
        <p className="text-[11px] text-muted-foreground">
          Log your sleep, soreness, and energy after workouts — then tap "Analyze My Recovery" for personalized recommendations from Coach Matt.
        </p>
      )}

      {(content || streaming) && (
        <div className="prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
          <ReactMarkdown>{content}</ReactMarkdown>
          {streaming && (
            <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}

      {error && !streaming && (
        <div className="bg-destructive/10 border border-destructive/20 p-3 mt-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
};

export default AiRecoveryAdvisor;
