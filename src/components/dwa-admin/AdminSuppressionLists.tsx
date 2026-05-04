import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, ShieldOff } from "lucide-react";

type Source = "sms" | "fax" | "email" | "contractor";

const SOURCES: { id: Source; label: string; table: string; phoneCol?: string; emailCol?: string }[] = [
  { id: "sms", label: "SMS opt-outs", table: "sms_opt_outs", phoneCol: "phone" },
  { id: "fax", label: "Fax opt-outs", table: "fax_opt_outs", phoneCol: "fax_number" },
  { id: "email", label: "Suppressed emails", table: "suppressed_emails", emailCol: "email" },
  { id: "contractor", label: "Contractor outreach suppression", table: "contractor_outreach_suppression" },
];

export default function AdminSuppressionLists() {
  const [active, setActive] = useState<Source>("sms");
  const [search, setSearch] = useState("");
  const cfg = SOURCES.find((s) => s.id === active)!;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["suppression", active],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = search
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  const counts = SOURCES.reduce((a, s) => ({ ...a, [s.id]: 0 }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-red-400" /> Suppression Lists
          </h2>
          <p className="text-xs text-white/50">
            DNC/opt-out audit. Sender shared helpers ({"`_shared/twilio.ts`, `outreach-blocklist.ts`"}) check these before any outbound.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="bg-black/30 border border-white/10 rounded pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/30 w-56"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              active === s.id
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-white/5 text-white/60 border-transparent hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {cfg.label}…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-8 text-center text-white/40 text-sm">
          {search ? "No matches." : `No entries in ${cfg.label}.`}
        </div>
      ) : (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="bg-white/5 px-3 py-2 text-xs text-white/60 font-mono">
            {filtered.length} of {rows.length} {filtered.length === 1 ? "entry" : "entries"}
          </div>
          <div className="divide-y divide-white/10 max-h-[600px] overflow-auto">
            {filtered.map((r, i) => (
              <div key={r.id || i} className="px-3 py-2 text-xs font-mono flex items-center justify-between gap-3">
                <div className="text-white/90 truncate">
                  {cfg.phoneCol && r[cfg.phoneCol]}
                  {cfg.emailCol && r[cfg.emailCol]}
                  {!cfg.phoneCol && !cfg.emailCol && (r.email || r.phone || r.identifier || JSON.stringify(r).slice(0, 80))}
                  {r.reason && <span className="text-white/40 ml-2">— {r.reason}</span>}
                </div>
                <div className="text-white/30 shrink-0">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
