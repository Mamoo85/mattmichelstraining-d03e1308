import { Home, Sparkles } from "lucide-react";

export default function MortgageRadarSeedLead({ zip }: { zip?: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-[#00d4ff]/40 bg-[#00d4ff]/5 p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00d4ff]" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#00d4ff]">
            Sample lead — your real ZIP-matched leads land within 24h
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
          Score 9/10
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0a1628] border border-[#1e3a5f] flex items-center justify-center flex-shrink-0">
          <Home className="w-5 h-5 text-[#00d4ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white">Anonymous homeowner</h3>
          <p className="text-sm text-[#94a3b8] mb-2">123 Sample St · Grosse Pointe, MI {zip || "48230"}</p>
          <p className="text-xs text-[#cbd5e1]">
            <strong className="text-[#00d4ff]">Signal:</strong> Kitchen remodel permit pulled 4 days ago — $48k contractor cost. Likely cash-out refi or HELOC candidate.
          </p>
          <p className="text-xs text-[#94a3b8] mt-2 italic">
            Suggested opener: "Saw the kitchen permit go through last week — congrats. Quick question on how you're financing the build…"
          </p>
        </div>
      </div>
    </div>
  );
}
