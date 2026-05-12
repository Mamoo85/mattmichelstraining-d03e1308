// Compact status pill + dropdown + snooze + follow-up badge.
// Used by RadarFitCard (compact) and LeadDetailDrawer (full).
import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, BellOff, Clock } from "lucide-react";
import { useRadarLeadStatus, type LeadStatus, followupDueDays } from "./useRadarLeadStatus";

const STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  new:        { label: "New",       cls: "bg-[#1e3a5f] text-[#94a3b8] border-[#1e3a5f]" },
  contacted:  { label: "Contacted", cls: "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/40" },
  proposal:   { label: "Proposal",  cls: "bg-amber-500/10 text-amber-300 border-amber-500/40" },
  won:        { label: "Won",       cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  lost:       { label: "Lost",      cls: "bg-red-500/10 text-red-300 border-red-500/40" },
};

interface Props {
  signal_id: string;
  client_id: string;
  radar: "demand" | "buyer";
  size?: "sm" | "md";
  onChange?: () => void;
}

export default function LeadStatusControl({ signal_id, client_id, radar, size = "sm", onChange }: Props) {
  const { status, statusChangedAt, snoozedUntil, log, loading } = useRadarLeadStatus({ signal_id, client_id, radar });
  const [openStatus, setOpenStatus] = useState(false);
  const [openSnooze, setOpenSnooze] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenStatus(false); setOpenSnooze(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (loading) return <div className="h-6 w-20 rounded bg-white/5 animate-pulse" />;

  const meta = STATUS_META[status];
  const due = status === "contacted" ? followupDueDays(statusChangedAt) : null;
  const padding = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  const snoozedActive = snoozedUntil !== null && snoozedUntil > Date.now();

  return (
    <div ref={ref} className="flex items-center gap-1 relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpenStatus((v) => !v); setOpenSnooze(false); }}
        className={`uppercase tracking-widest font-bold rounded border flex items-center gap-1 ${padding} ${meta.cls} transition-colors`}
        title="Change status"
      >
        {meta.label}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {due !== null && (
        <span
          className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
            due <= 0 ? "bg-red-500/15 text-red-300 border border-red-500/40" : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
          }`}
          title="Follow-up due 3 days after contact"
        >
          <Clock className="w-2.5 h-2.5 inline mr-0.5" />
          {due <= 0 ? "Follow up" : `${due}d`}
        </span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setOpenSnooze((v) => !v); setOpenStatus(false); }}
        className={`rounded border ${padding} ${snoozedActive ? "bg-purple-500/10 text-purple-300 border-purple-500/40" : "border-[#1e3a5f] text-[#64748b] hover:text-[#94a3b8]"}`}
        title={snoozedActive ? `Snoozed until ${new Date(snoozedUntil!).toLocaleDateString()}` : "Snooze"}
      >
        <BellOff className="w-3 h-3" />
      </button>

      {openStatus && (
        <div className="absolute top-full mt-1 left-0 z-40 bg-[#0a1628] border border-[#1e3a5f] rounded-lg shadow-xl py-1 min-w-[140px]">
          {(Object.keys(STATUS_META) as LeadStatus[]).map((s) => (
            <button
              key={s}
              onClick={async (e) => {
                e.stopPropagation();
                setOpenStatus(false);
                await log(`status_${s}`);
                onChange?.();
              }}
              className="w-full text-left text-[11px] px-3 py-1.5 text-white hover:bg-white/5 flex items-center justify-between"
            >
              {STATUS_META[s].label}
              {s === status && <Check className="w-3 h-3 text-[#00d4ff]" />}
            </button>
          ))}
        </div>
      )}

      {openSnooze && (
        <div className="absolute top-full mt-1 right-0 z-40 bg-[#0a1628] border border-[#1e3a5f] rounded-lg shadow-xl py-1 min-w-[120px]">
          {snoozedActive && (
            <button
              onClick={async (e) => { e.stopPropagation(); setOpenSnooze(false); await log("unsnooze"); onChange?.(); }}
              className="w-full text-left text-[11px] px-3 py-1.5 text-purple-300 hover:bg-white/5"
            >
              Un-snooze
            </button>
          )}
          {(["snooze_3d", "snooze_1w", "snooze_2w"] as const).map((a) => (
            <button
              key={a}
              onClick={async (e) => { e.stopPropagation(); setOpenSnooze(false); await log(a); onChange?.(); }}
              className="w-full text-left text-[11px] px-3 py-1.5 text-white hover:bg-white/5"
            >
              {a === "snooze_3d" ? "3 days" : a === "snooze_1w" ? "1 week" : "2 weeks"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
