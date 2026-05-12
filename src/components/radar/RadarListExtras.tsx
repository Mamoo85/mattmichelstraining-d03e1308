// List-level UI: pipeline strip, industry filter pills, snooze filter toggle,
// hottest-lead banner. All client-side filters — no backend changes.
import { useEffect, useMemo, useState } from "react";
import { Flame, X, BellOff } from "lucide-react";
import type { BatchLeadStateMap } from "./useRadarLeadStatus";

export interface PipelineCounts {
  thisWeek: number;
  followUpsDue: number;
  snoozed: number;
  won: number;
}

export function computePipelineCounts<T extends { id: string; detected_at?: string | null }>(
  signals: T[],
  states: BatchLeadStateMap,
): PipelineCounts {
  const weekAgo = Date.now() - 7 * 86_400_000;
  let thisWeek = 0, followUpsDue = 0, snoozed = 0, won = 0;
  for (const s of signals) {
    if (s.detected_at && new Date(s.detected_at).getTime() >= weekAgo) thisWeek++;
    const st = states[s.id];
    if (st?.snoozedUntil && st.snoozedUntil > Date.now()) snoozed++;
    if (st?.status === "won") won++;
    if (st?.status === "contacted" && st.statusChangedAt) {
      const dueAt = new Date(st.statusChangedAt).getTime() + 3 * 86_400_000;
      if (dueAt < Date.now() + 86_400_000) followUpsDue++;
    }
  }
  return { thisWeek, followUpsDue, snoozed, won };
}

export function PipelineStrip({ counts }: { counts: PipelineCounts }) {
  const items = [
    { label: "This week", value: counts.thisWeek, cls: "text-white" },
    { label: "Follow-ups due", value: counts.followUpsDue, cls: counts.followUpsDue > 0 ? "text-amber-400" : "text-white/60" },
    { label: "Snoozed", value: counts.snoozed, cls: "text-purple-300" },
    { label: "Won", value: counts.won, cls: "text-emerald-300" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {items.map((it) => (
        <div key={it.label} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2">
          <p className="text-[9px] uppercase tracking-widest text-[#64748b] font-bold leading-none mb-1">{it.label}</p>
          <p className={`text-xl font-black tabular-nums leading-none ${it.cls}`}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

interface IndustryPillsProps {
  industries: string[];
  selected: string | null;
  onChange: (industry: string | null) => void;
}

export function IndustryFilterPills({ industries, selected, onChange }: IndustryPillsProps) {
  if (industries.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
      <button
        onClick={() => onChange(null)}
        className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border whitespace-nowrap ${
          selected === null
            ? "bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/40"
            : "border-[#1e3a5f] text-[#94a3b8] hover:text-white"
        }`}
      >
        All
      </button>
      {industries.map((ind) => (
        <button
          key={ind}
          onClick={() => onChange(ind === selected ? null : ind)}
          className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border whitespace-nowrap ${
            selected === ind
              ? "bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/40"
              : "border-[#1e3a5f] text-[#94a3b8] hover:text-white"
          }`}
        >
          {ind}
        </button>
      ))}
    </div>
  );
}

export function SnoozeFilterToggle({
  count,
  showSnoozed,
  onToggle,
}: { count: number; showSnoozed: boolean; onToggle: () => void }) {
  if (count === 0 && !showSnoozed) return null;
  return (
    <button
      onClick={onToggle}
      className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border ${
        showSnoozed
          ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
          : "border-[#1e3a5f] text-[#94a3b8] hover:text-white"
      }`}
    >
      <BellOff className="w-3 h-3 inline mr-1" />
      {showSnoozed ? "Showing snoozed" : `Snoozed (${count})`}
    </button>
  );
}

interface HottestProps {
  hottest: { id: string; company_name?: string | null; fit_score?: number } | null;
  onOpen: () => void;
}

export function HottestLeadBanner({ hottest, onOpen }: HottestProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("radar.hottest.dismissed");
      if (raw) {
        const o = JSON.parse(raw);
        if (o.id && o.until && o.until > Date.now()) setDismissed(o.id);
      }
    } catch {}
  }, []);

  if (!hottest || dismissed === hottest.id) return null;
  const score = hottest.fit_score ?? 0;
  if (score < 85) return null;

  return (
    <div className="mb-4 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-[#0a1628] to-[#00d4ff]/10 p-3 flex items-center gap-3 relative overflow-hidden">
      <Flame className="w-6 h-6 text-emerald-400 shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">Hottest right now · fit {score}/100</p>
        <p className="text-sm font-bold text-white truncate">{hottest.company_name || "Top lead"}</p>
      </div>
      <button
        onClick={onOpen}
        className="text-[11px] font-bold bg-emerald-500 text-[#0a1628] px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors shrink-0"
      >
        Open
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(hottest.id);
          try {
            localStorage.setItem(
              "radar.hottest.dismissed",
              JSON.stringify({ id: hottest.id, until: Date.now() + 24 * 86_400_000 }),
            );
          } catch {}
        }}
        className="text-[#94a3b8] hover:text-white p-1 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
