import { useMemo } from "react";
import { Rocket, Sparkles, ArrowUp, Zap } from "lucide-react";
import { UPDATES, type Update, type UpdateKind } from "./updates";

// How many of the newest entries get the glowing "NEW" treatment.
const NEW_COUNT = 2;

const KIND_STYLE: Record<UpdateKind, { label: string; chip: string; dot: string; icon: typeof Sparkles }> = {
  new:      { label: "New",      chip: "bg-[#27CCC0]/15 text-[#27CCC0] border-[#27CCC0]/30", dot: "#27CCC0", icon: Sparkles },
  improved: { label: "Improved", chip: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30", dot: "#818cf8", icon: ArrowUp },
  launch:   { label: "Launched", chip: "bg-[#c12a3b]/15 text-[#ff7a88] border-[#c12a3b]/40", dot: "#c12a3b", icon: Zap },
};

function fmtDate(iso: string) {
  // Parse as local-date (avoid TZ off-by-one) and render "May 29"
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentUpdates() {
  const items = useMemo(
    () => [...UPDATES].sort((a, b) => b.date.localeCompare(a.date)),
    []
  );
  const shipped = items.length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#27CCC0]/25 bg-[#0c1a28]">
      {/* glow accents */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#27CCC0]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-[#1fa89d]/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#27CCC0] to-[#1fa89d] text-[#06121d] shadow-lg shadow-[#27CCC0]/20">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#27CCC0]">What&apos;s New</div>
            <h2 className="text-xl font-bold text-white leading-tight">Upgrades to your Command Center</h2>
            <p className="text-xs text-slate-400 mt-0.5">Everything we ship to your platform — logged the moment it goes live.</p>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2">
          <span className="text-2xl font-black text-[#27CCC0] leading-none">{shipped}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">shipped</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative px-6 py-5">
        {/* vertical rail */}
        <div className="absolute left-[34px] top-6 bottom-6 w-px bg-gradient-to-b from-[#27CCC0]/60 via-white/10 to-transparent" />

        <ul className="space-y-4">
          {items.map((u: Update, i) => {
            const s = KIND_STYLE[u.kind];
            const isNew = i < NEW_COUNT;
            const Icon = s.icon;
            return (
              <li key={`${u.date}-${i}`} className="relative pl-12">
                {/* node */}
                <span
                  className="absolute left-[26px] top-1.5 grid h-[18px] w-[18px] -translate-x-1/2 place-items-center rounded-full"
                  style={{ background: s.dot, boxShadow: isNew ? `0 0 0 4px ${s.dot}33` : "none" }}
                >
                  {isNew && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: s.dot, opacity: 0.5 }}
                    />
                  )}
                  <Icon className="h-2.5 w-2.5 text-[#06121d]" />
                </span>

                <div className="group rounded-xl border border-white/5 bg-[#111d2b] px-4 py-3 transition hover:border-[#27CCC0]/30 hover:bg-[#13212f]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${s.chip}`}>
                      {s.label}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{u.title}</h3>
                    {isNew && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#06121d] bg-[#27CCC0] px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-slate-500 shrink-0">{fmtDate(u.date)}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{u.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
