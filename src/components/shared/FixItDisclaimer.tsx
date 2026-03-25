import { Info } from "lucide-react";

interface FixItDisclaimerProps {
  compact?: boolean;
}

const FixItDisclaimer = ({ compact = false }: FixItDisclaimerProps) => {
  if (compact) {
    return (
      <div className="bg-muted/60 border border-border p-3 text-[10px] text-muted-foreground leading-relaxed">
        <Info size={10} className="inline mr-1 -mt-0.5" />
        <span className="font-bold text-foreground">Coach Matt's note:</span>{" "}
        These are the exact protocols I use with my in-person clients — but bodies are different and it's always trial and error. Never push through pain (soreness is fine, pain is not). That's why I built the{" "}
        <span className="font-semibold text-primary">Flag Matt</span> system — I'm always happy to adjust. There's never one path to any goal. We find what works for <em>you</em>.
      </div>
    );
  }

  return (
    <div className="bg-muted/50 border border-border p-4 space-y-2">
      <div className="flex items-start gap-2">
        <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            A note from Coach Matt
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            These are the exact protocols I use with my in-person clients — but here's the thing: it's <em>always</em> trial and error. Every body is different. Pain and soreness are two very different things — don't be a wimp, but don't be an idiot either.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            That's exactly why I built the <span className="font-semibold text-primary">Flag Matt</span> system. I'm happy to help, change, or adjust anything. There has never been one way to any goal — there are always multiple paths. We find what works for <em>you</em>, and trust me, it's as varied as you'd imagine. That's why I've always believed custom programming is vital… yet people still do what everyone else does. Well, at least <em>you</em> don't.
          </p>
          <p className="text-[10px] font-mono text-primary mt-1">
            — Good on ya, legend. Now get after it. 🤙
          </p>
        </div>
      </div>
    </div>
  );
};

export default FixItDisclaimer;
