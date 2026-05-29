import { Trophy, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BlockCompleteSummaryProps {
  activeProgramId: string;
  blockNumber: number;
  completedDays: Array<{ week: number; day: number }>;
  programTitle: string;
  onBlockAdvanced: () => void;
}

const BlockCompleteSummary = ({
  activeProgramId,
  blockNumber,
  completedDays,
  programTitle,
  onBlockAdvanced,
}: BlockCompleteSummaryProps) => {
  const [advancing, setAdvancing] = useState(false);

  const handleAdvance = async () => {
    setAdvancing(true);
    const { error } = await supabase
      .from("user_active_programs")
      .update({
        block_number: blockNumber + 1,
        current_week: 1,
        current_day: 1,
        completed_days: [],
      })
      .eq("id", activeProgramId);

    if (error) {
      toast({ title: "Error advancing block", variant: "destructive" });
    } else {
      toast({ title: `Block ${blockNumber + 1} unlocked!`, description: "Let's keep building." });
      onBlockAdvanced();
    }
    setAdvancing(false);
  };

  return (
    <div className="bg-card border border-primary/30 shadow-m2 p-6 text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-14 h-14 bg-primary/10 flex items-center justify-center">
          <Trophy size={28} className="text-primary" />
        </div>
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">Block {blockNumber} Complete</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {completedDays.length} sessions logged across 8 weeks of {programTitle}.
        </p>
      </div>
      <div className="bg-muted p-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Up</span>
        <p className="text-sm font-bold text-foreground mt-1">Block {blockNumber + 1}</p>
        <p className="text-xs text-muted-foreground">Same structure, heavier weights. Progressive overload continues.</p>
      </div>
      <button
        onClick={handleAdvance}
        disabled={advancing}
        className="w-full h-11 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
      >
        {advancing ? <Loader2 size={14} className="animate-spin" /> : (
          <>
            Start Block {blockNumber + 1} <ArrowRight size={14} />
          </>
        )}
      </button>
    </div>
  );
};

export default BlockCompleteSummary;
