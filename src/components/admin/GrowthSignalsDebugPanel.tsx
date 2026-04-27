// "Why am I seeing zero?" diagnostic panel for AdminGrowthSignals.
// Reads live query meta + per-industry counts and tells the user EXACTLY
// why their current filter combination returned nothing — plus one-tap
// buttons to switch to a bucket that has data.
import { Factory, AlertCircle, Wand2 } from "lucide-react";

export interface QueryMeta {
  industry: string;
  confidence: string;        // "all" | "high" | "medium" | "low" | "cross_referenced" | "watchlist"
  fetchLimit: number;
  returned: number;
  totalForFilter: number;    // count(*) for industry+confidence (may equal returned if under limit)
}

export interface IndustryCount {
  industry: string;
  total: number;
  high: number;
  medium: number;
  low: number;
  cross_ref: number;
}

interface Props {
  meta: QueryMeta;
  counts: IndustryCount[];
  onSwitchConfidence: (c: "all" | "high" | "medium" | "low") => void;
  onClearIndustry: () => void;
  onRunScanner: () => void;
}

export default function GrowthSignalsDebugPanel({
  meta, counts, onSwitchConfidence, onClearIndustry, onRunScanner,
}: Props) {
  const industryRow = counts.find(c => c.industry === meta.industry);

  // Decide the "best next move" for the user based on actual data
  const suggestion = computeSuggestion(meta, industryRow, counts);

  const confidenceLabel = ({
    all: "All",
    high: "High (≥7)",
    medium: "Medium (4-6)",
    low: "Low (<4)",
    cross_referenced: "Cross-Referenced",
    watchlist: "Watchlist",
  } as Record<string, string>)[meta.confidence] || meta.confidence;

  return (
    <div className="bg-[#0f1f35] border border-amber-500/20 rounded-xl overflow-hidden">
      <div className="bg-amber-500/5 border-b border-amber-500/20 px-4 py-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        <p className="text-amber-400 text-sm font-bold">No signals match. Here's why.</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Active query constraints — fully transparent */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Active query</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
            <dt className="text-white/40">Industry</dt>          <dd className="text-white/80">{meta.industry}</dd>
            <dt className="text-white/40">Confidence</dt>        <dd className="text-white/80">{confidenceLabel}</dd>
            <dt className="text-white/40">Fetch cap</dt>         <dd className="text-white/80">{meta.fetchLimit.toLocaleString()} rows</dd>
            <dt className="text-white/40">Matched in DB</dt>     <dd className="text-emerald-400">{meta.totalForFilter.toLocaleString()}</dd>
            <dt className="text-white/40">Returned to UI</dt>    <dd className="text-white/80">{meta.returned.toLocaleString()}</dd>
          </dl>
        </div>

        {/* Plain-English diagnosis + suggestion */}
        <div className="bg-black/30 border border-white/5 rounded-lg p-3">
          <p className="text-white/60 text-xs leading-relaxed">{suggestion.message}</p>
        </div>

        {/* One-tap fix buttons */}
        {suggestion.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestion.actions.map((a, i) => (
              <button
                key={i}
                onClick={() => {
                  if (a.kind === "confidence") onSwitchConfidence(a.value);
                  else if (a.kind === "clearIndustry") onClearIndustry();
                  else if (a.kind === "scan") onRunScanner();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/25 transition-colors text-xs font-medium flex items-center gap-1.5"
              >
                {a.kind === "scan" ? <Wand2 className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Action =
  | { kind: "confidence"; value: "all" | "high" | "medium" | "low"; label: string }
  | { kind: "clearIndustry"; label: string }
  | { kind: "scan"; label: string };

function computeSuggestion(
  meta: QueryMeta,
  industryRow: IndustryCount | undefined,
  counts: IndustryCount[],
): { message: string; actions: Action[] } {
  // Case 1: industry has zero signals across all buckets → run scanner
  if (industryRow && industryRow.total === 0) {
    return {
      message: `No ${meta.industry} signals exist in the database yet. Run the Pulse Scanner to harvest fresh listings.`,
      actions: [{ kind: "scan", label: "Run Pulse Scanner" }],
    };
  }

  // Case 2: industry has signals but not at the selected confidence bucket
  if (industryRow && meta.industry !== "All") {
    const buckets: { name: string; key: "high" | "medium" | "low"; count: number }[] = [
      { name: "High (≥7)",   key: "high",   count: industryRow.high },
      { name: "Medium (4-6)", key: "medium", count: industryRow.medium },
      { name: "Low (<4)",    key: "low",    count: industryRow.low },
    ];
    const nonEmpty = buckets.filter(b => b.count > 0);
    if (nonEmpty.length > 0) {
      const best = nonEmpty.sort((a, b) => b.count - a.count)[0];
      return {
        message: `${meta.industry} has ${industryRow.total} total signals, but ${meta.totalForFilter} match the "${
          ({all:"All", high:"High (≥7)", medium:"Medium (4-6)", low:"Low (<4)", cross_referenced:"Cross-Referenced", watchlist:"Watchlist"} as Record<string,string>)[meta.confidence]
        }" filter. The biggest pool is ${best.name} with ${best.count} signals — many institutional buyers (Stellantis, U-M, FCA, Corewell Health) score exactly 6 because their listings come from a single trusted source.`,
        actions: [
          { kind: "confidence", value: best.key, label: `Switch to ${best.name} (${best.count})` },
          { kind: "confidence", value: "all", label: `Show all confidence (${industryRow.total})` },
        ],
      };
    }
  }

  // Case 3: industry = All but confidence filter is too tight
  if (meta.industry === "All") {
    const totalAcross = counts.reduce((s, c) => s + c.total, 0);
    return {
      message: `${totalAcross} signals exist in the database, but ${meta.totalForFilter} match your current filter. Loosen the confidence filter or run a fresh scan.`,
      actions: [
        { kind: "confidence", value: "all", label: `Show all confidence (${totalAcross})` },
        { kind: "scan", label: "Run Pulse Scanner" },
      ],
    };
  }

  // Fallback
  return {
    message: `Nothing matched this filter combination. Try clearing the industry filter or lowering confidence.`,
    actions: [
      { kind: "clearIndustry", label: "Clear industry filter" },
      { kind: "confidence", value: "all", label: "Show all confidence" },
    ],
  };
}
