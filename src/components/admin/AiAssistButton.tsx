import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AiAssistButtonProps {
  type: string;
  context: Record<string, any>;
  onResult: (text: string) => void;
  label?: string;
  className?: string;
}

const AiAssistButton = ({ type, context, onResult, label = "AI Assist", className = "" }: AiAssistButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-admin-assist", {
        body: { type, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.queued) {
        toast({ title: "Queued for approval", description: "AI draft sent to the approval queue. Review it in the AI Queue tab." });
      } else if (data?.result) {
        onResult(data.result);
        toast({ title: "AI draft ready", description: "Review and edit before sending." });
      }
    } catch (e: any) {
      toast({ title: "AI assist failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/80 ${className}`}
      title="Generate AI draft"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
      {loading ? "Generating…" : label}
    </button>
  );
};

export default AiAssistButton;
