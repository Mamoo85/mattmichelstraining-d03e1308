import { useState } from "react";
import { Sparkles, Loader2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface AiRecoveryAdvisorProps {
  userId: string;
}

const AiRecoveryAdvisor = ({ userId }: AiRecoveryAdvisorProps) => {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setAdvice(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-athlete-assist", {
        body: { type: "recovery_advisor", context: {} },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAdvice(data.result);
    } catch (e: any) {
      toast({ title: "Recovery analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-card border border-border mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">
            AI Recovery Advisor
          </span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground hover:bg-accent/80 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {loading ? "Analyzing…" : advice ? "Refresh" : "Analyze My Recovery"}
        </button>
      </div>

      {!advice && !loading && (
        <p className="text-[11px] text-muted-foreground">
          Log your sleep, soreness, and energy after workouts — then tap "Analyze My Recovery" for personalized recommendations from Coach Matt's AI.
        </p>
      )}

      {advice && (
        <div className="prose prose-sm max-w-none text-foreground text-xs leading-relaxed">
          <ReactMarkdown>{advice}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default AiRecoveryAdvisor;
