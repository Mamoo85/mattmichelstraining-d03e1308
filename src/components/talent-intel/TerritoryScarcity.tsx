import { Lock, MapPin } from "lucide-react";

/**
 * Static scarcity strip — shows territory availability per county.
 * Hardcoded for launch (one agency per county per vertical).
 * Update manually as agencies sign on (move counties from "open" to "locked").
 */

type Slot = { county: string; vertical: "industrial" | "healthcare"; status: "open" | "locked" | "pending" };

// Manually maintain — flip to "locked" when an agency signs the territory contract.
const SLOTS: Slot[] = [
  { county: "Wayne",     vertical: "industrial", status: "open" },
  { county: "Wayne",     vertical: "healthcare", status: "open" },
  { county: "Oakland",   vertical: "industrial", status: "open" },
  { county: "Oakland",   vertical: "healthcare", status: "pending" },
  { county: "Macomb",    vertical: "industrial", status: "open" },
  { county: "Macomb",    vertical: "healthcare", status: "open" },
  { county: "Washtenaw", vertical: "industrial", status: "open" },
  { county: "Genesee",   vertical: "industrial", status: "open" },
];

export default function TerritoryScarcity() {
  const open = SLOTS.filter(s => s.status === "open").length;
  const total = SLOTS.length;

  return (
    <div className="bg-[#0f1f35] border border-amber-500/20 rounded-2xl p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-300" />
            <span className="text-amber-300 text-xs uppercase tracking-wider font-bold">Territory Availability</span>
          </div>
          <h3 className="text-white font-bold text-lg">One agency per county. Per vertical. Period.</h3>
        </div>
        <div className="text-right">
          <div className="text-white text-3xl font-bold">{open}<span className="text-slate-500 text-base">/{total}</span></div>
          <div className="text-slate-500 text-xs uppercase tracking-wider">slots remaining</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {SLOTS.map((s, i) => (
          <div
            key={`${s.county}-${s.vertical}-${i}`}
            className={`rounded-lg border px-3 py-2.5 text-xs ${
              s.status === "locked"
                ? "bg-red-500/5 border-red-500/20 text-red-300/60 line-through"
                : s.status === "pending"
                ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                : "bg-[#0a1628] border-[#00d4ff]/30 text-[#00d4ff]"
            }`}
            title={s.status === "locked" ? "Sold — agency locked" : s.status === "pending" ? "In contract review" : "Open — apply now"}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <MapPin className="w-3 h-3" />
              {s.county}
            </div>
            <div className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">
              {s.vertical} · {s.status === "locked" ? "Locked" : s.status === "pending" ? "Pending" : "Open"}
            </div>
          </div>
        ))}
      </div>

      <p className="text-slate-500 text-xs mt-5 text-center">
        Once a county-vertical lock is signed, all competing agencies in that pair are blocked from the feed.
      </p>
    </div>
  );
}
