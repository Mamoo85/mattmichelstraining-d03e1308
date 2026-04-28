// Confidence-bucket explainer card for AdminGrowthSignals.
// Tells the user how the 1-10 confidence scale is built and why most
// institutional buyers (Stellantis, U-M, FCA, Corewell) cluster at exactly 6.
import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

const ROWS: { score: string; label: string; bars: number; tone: string }[] = [
  { score: "10", label: "Cross-referenced + funded + actively hiring (rare gold)", bars: 10, tone: "bg-amber-400" },
  { score: "7-9", label: "Multiple sources confirm + high hiring volume",          bars: 8,  tone: "bg-emerald-400" },
  { score: "6",   label: "Single high-quality source confirmed (default ceiling for most institutional listings)", bars: 6, tone: "bg-cyan-400" },
  { score: "4-5", label: "Single source, partial verification",                    bars: 4,  tone: "bg-cyan-400/60" },
  { score: "<4",  label: "Speculative — needs cross-check before pitching",        bars: 2,  tone: "bg-slate-400/60" },
];

export default function IndustryPulseConfidenceLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#0a1628] border border-[#00d4ff]/15 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-[#00d4ff]/70" />
          <span className="text-white/70 text-xs font-semibold">How confidence is scored</span>
          <span className="text-white/30 text-[10px]">— click to {open ? "hide" : "explain why some industries cap at 6"}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-white/40" /> : <ChevronDown className="h-3.5 w-3.5 text-white/40" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
          <div className="space-y-1.5 mt-2">
            {ROWS.map(r => (
              <div key={r.score} className="flex items-center gap-3 text-[11px]">
                <span className="text-white/70 font-mono font-bold w-10 shrink-0 text-right">{r.score}</span>
                <div className="flex gap-0.5 w-24 shrink-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-sm ${i < r.bars ? r.tone : "bg-white/5"}`} />
                  ))}
                </div>
                <span className="text-white/50 leading-tight">{r.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 text-[11px] text-amber-100/80 leading-relaxed">
            <span className="text-amber-400 font-bold">Why Boiler/Pressure caps at 6:</span>{" "}
            Boiler-operator and pressure-vessel listings come from a single trusted source (state license boards, employer career pages) but rarely cross-reference against grant or permit data — so they hit the verification ceiling at 6, even when the buyer is Fortune 500. Filter <span className="font-mono text-amber-300">Medium (4-6)</span> or <span className="font-mono text-amber-300">All</span> to see them.
          </div>
        </div>
      )}
    </div>
  );
}
