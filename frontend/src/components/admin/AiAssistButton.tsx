import { useState } from "react";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";
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
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-admin-assist", {
        body: { type, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.queued) {
        setSuccess(true);
        toast({ title: "Queued for approval", description: "AI draft sent to the approval queue. Review it in the AI Queue tab." });
        setTimeout(() => setSuccess(false), 3000);
      } else if (data?.result) {
        setSuccess(true);
        onResult(data.result);
        toast({ title: "AI draft ready", description: "Review and edit before sending." });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("Rate limited") || msg.includes("429")) {
        toast({ title: "Rate limited", description: "Too many requests — try again in a moment.", variant: "destructive" });
      } else if (msg.includes("402") || msg.includes("credits")) {
        toast({ title: "AI credits needed", description: "Add credits in Settings → Workspace → Usage.", variant: "destructive" });
      } else {
        toast({ title: "AI assist failed", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
        success
          ? "bg-green-600/20 text-green-400"
          : "bg-accent text-accent-foreground hover:bg-accent/80"
      } ${className}`}
      title="Generate AI draft"
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : success ? (
        <CheckCircle size={12} />
      ) : (
        <Sparkles size={12} />
      )}
      {loading ? "Generating…" : success ? "Done ✓" : label}
    </button>
  );
};

export default AiAssistButton;
