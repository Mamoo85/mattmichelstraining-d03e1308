import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  signalType: string;
  signalLabel?: string;
  signalDate?: string | null;
  estimatedValueCents?: number;
  sourceMethod?: string | null;
  signalCount?: number | null;
}

interface Factor {
  label: string;
  detail: string;
  weight: number; // -3 .. +5
}

function recencyFactor(signalDate?: string | null): Factor | null {
  if (!signalDate) return null;
  const d = new Date(signalDate);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 1) return { label: "Fresh signal", detail: "Detected within last 24h", weight: 3 };
  if (days <= 7) return { label: "Recent signal", detail: `${days}d old — still actionable`, weight: 2 };
  if (days <= 30) return { label: "This month", detail: `${days}d old`, weight: 1 };
  if (days <= 90) return { label: "Aging signal", detail: `${days}d old — recency decay applied`, weight: -1 };
  return { label: "Stale signal", detail: `${days}d old`, weight: -2 };
}

function valueFactor(cents?: number): Factor | null {
  if (!cents || cents <= 0) return null;
  const dollars = cents / 100;
  if (dollars >= 25_000) return { label: "High-ticket job", detail: `~$${Math.round(dollars).toLocaleString()} estimated`, weight: 2 };
  if (dollars >= 10_000) return { label: "Strong job value", detail: `~$${Math.round(dollars).toLocaleString()} estimated`, weight: 1 };
  if (dollars >= 2_000) return { label: "Standard job value", detail: `~$${Math.round(dollars).toLocaleString()} estimated`, weight: 0 };
  return { label: "Light-ticket job", detail: `~$${Math.round(dollars).toLocaleString()} estimated`, weight: -1 };
}

function sourceFactor(method?: string | null): Factor | null {
  if (!method) return null;
  const m = method.toLowerCase();
  // Deterministic public-records sources are higher-trust than LLM-only
  if (/permit|bseed|cofc|deed|assessor|fema|spc|noaa|fire/.test(m)) {
    return { label: "Verified public record", detail: method, weight: 2 };
  }
  if (/zillow|estate|foreclosure|firecrawl|scrape/.test(m)) {
    return { label: "Deterministic scrape", detail: method, weight: 1 };
  }
  if (/llm|gpt|gemini|claude/.test(m)) {
    return { label: "LLM-derived (capped)", detail: "Score capped until corroborated by 2nd source", weight: -2 };
  }
  return { label: "Source", detail: method, weight: 0 };
}

function corroborationFactor(count?: number | null): Factor | null {
  if (!count || count <= 1) return null;
  return { label: "Multi-signal match", detail: `${count} independent signals on this address`, weight: Math.min(3, count - 1) };
}

export default function ScoreBreakdown({
  score,
  signalType,
  signalLabel,
  signalDate,
  estimatedValueCents,
  sourceMethod,
  signalCount,
}: Props) {
  const [open, setOpen] = useState(false);

  const factors = useMemo<Factor[]>(() => {
    const list: (Factor | null)[] = [
      {
        label: signalLabel || signalType.replace(/_/g, " "),
        detail: "Primary signal type",
        weight: 5,
      },
      recencyFactor(signalDate),
      valueFactor(estimatedValueCents),
      sourceFactor(sourceMethod),
      corroborationFactor(signalCount),
    ];
    return list.filter((f): f is Factor => f !== null);
  }, [signalType, signalLabel, signalDate, estimatedValueCents, sourceMethod, signalCount]);

  return (
    <div className="rounded-lg border border-white/8 bg-white/3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors rounded-lg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-[#00d4ff]/70">
          <Info className="w-3 h-3" />
          Why score {score}/10?
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="px-3 pb-3 pt-1 space-y-1.5">
          {factors.map((f, i) => {
            const positive = f.weight > 0;
            const negative = f.weight < 0;
            const sign = positive ? "+" : negative ? "−" : "·";
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "font-mono font-bold tabular-nums w-6 text-center rounded px-1 py-0.5 text-[10px]",
                    positive && "bg-emerald-500/15 text-emerald-400",
                    negative && "bg-red-500/15 text-red-400",
                    !positive && !negative && "bg-white/10 text-white/50"
                  )}
                >
                  {sign}{Math.abs(f.weight) || ""}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/85 font-medium leading-tight">{f.label}</p>
                  <p className="text-white/45 text-[11px] leading-snug">{f.detail}</p>
                </div>
              </li>
            );
          })}
          <li className="text-[10px] text-white/35 italic pt-1 border-t border-white/8 mt-2">
            Final score blended server-side from these factors plus address validation gate.
          </li>
        </ul>
      )}
    </div>
  );
}
