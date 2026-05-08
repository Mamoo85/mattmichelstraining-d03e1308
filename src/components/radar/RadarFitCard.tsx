// Premium "Angie's-killer" lead card for Demand & Buyer Radar.
// Shows: per-company fit score ring, why-this-is-yours, revenue band, urgency window,
// AI-drafted opener, expected objection, + one-click outreach bar.

import { useEffect, useState } from "react";
import { Building2, MapPin, TrendingUp, DollarSign, Clock, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import OutreachActionBar, { type OutreachContext } from "./OutreachActionBar";

interface FitJSON {
  fit_score: number;
  fit_reason: string;
  revenue_low_usd: number;
  revenue_high_usd: number;
  revenue_logic: string;
  urgency_window_days: number;
  suggested_opener: string;
  objection_to_expect: string;
  next_best_action: "call" | "email" | "linkedin";
}

export interface RadarSignal {
  id: string;
  company_name?: string | null;
  industry?: string | null;
  location?: string | null;
  county?: string | null;
  signal_type?: string | null;
  human_summary?: string | null;
  source_summary?: string | null;
  predicted_needs?: string[] | null;
  hiring_count?: number | null;
  hiring_roles?: string[] | null;
  confidence?: number | null;
  detected_at?: string | null;
  recommended_pitch?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export interface RadarClient {
  id: string;
  company_name?: string | null;
  target_buyer_titles?: string[] | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_email?: string | null;
}

interface Props {
  signal: RadarSignal;
  client: RadarClient;
  radar: "demand" | "buyer";
  onClick?: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? "#22c55e" : pct >= 55 ? "#00d4ff" : pct >= 35 ? "#f59e0b" : "#94a3b8";
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0" title={`Fit score ${pct}/100 for your company`}>
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#1e3a5f" strokeWidth="4" fill="none" />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[14px] font-black tabular-nums leading-none" style={{ color }}>
          {pct}
        </span>
        <span className="text-[8px] uppercase tracking-widest text-[#64748b]">fit</span>
      </div>
    </div>
  );
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function RadarFitCard({ signal, client, radar, onClick }: Props) {
  const [fit, setFit] = useState<FitJSON | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("radar-fit-explainer", {
          body: { signal, client_id: client.id, radar },
        });
        if (cancel) return;
        if (!error && (data as any)?.fit) setFit((data as any).fit as FitJSON);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [signal.id, client.id, radar]);

  const ctx: OutreachContext = {
    signal_id: signal.id,
    client_id: client.id,
    radar,
    company_name: signal.company_name,
    industry: signal.industry,
    location: signal.location || signal.county,
    signal_type: signal.signal_type,
    suggested_opener: fit?.suggested_opener || signal.recommended_pitch,
    target_buyer_titles: client.target_buyer_titles,
    sender_name: client.sender_name,
    sender_phone: client.sender_phone,
    sender_email: client.sender_email,
    contact_phone: signal.contact_phone,
    contact_email: signal.contact_email,
  };

  const isHot = (fit?.fit_score ?? 0) >= 75;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`relative bg-[#0a1628] border rounded-xl p-4 transition-all hover:-translate-y-0.5 ${
        isHot ? "border-emerald-500/40" : "border-[#1e3a5f] hover:border-[#00d4ff]/40"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={isHot ? { boxShadow: "0 0 0 1px rgba(34,197,94,0.08), 0 0 32px -10px rgba(34,197,94,0.35)" } : undefined}
    >
      {isHot && (
        <span className="absolute -top-2 left-3 text-[9px] uppercase tracking-widest font-black bg-emerald-500 text-[#0a1628] px-1.5 py-0.5 rounded">
          ● HOT FIT
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <ScoreRing score={fit?.fit_score ?? 50} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {signal.signal_type && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
                {signal.signal_type.replace(/_/g, " ")}
              </span>
            )}
            {fit?.next_best_action && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-[#94a3b8] border border-[#1e3a5f]">
                Next: {fit.next_best_action}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-bold text-white truncate flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#00d4ff] shrink-0" />
            {signal.company_name || "Unnamed account"}
          </h3>
          <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-[#94a3b8]">
            {signal.industry && <span>{signal.industry}</span>}
            {(signal.location || signal.county) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {signal.location || signal.county}
              </span>
            )}
            {signal.hiring_count && signal.hiring_count > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <TrendingUp className="w-3 h-3" /> {signal.hiring_count} hiring
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Why this is yours */}
      <div className="mb-3 rounded-lg border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-3">
        <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Why this is yours
        </p>
        {loading ? (
          <p className="text-xs text-[#94a3b8] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing fit for {client.company_name || "your company"}…
          </p>
        ) : (
          <p className="text-sm text-white/90 leading-relaxed">{fit?.fit_reason || signal.human_summary || "—"}</p>
        )}
      </div>

      {/* Revenue + urgency */}
      {fit && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1 mb-0.5">
              <DollarSign className="w-3 h-3" /> Revenue potential
            </p>
            <p className="text-sm font-black text-white tabular-nums">
              {fmtMoney(fit.revenue_low_usd)}–{fmtMoney(fit.revenue_high_usd)}
            </p>
            <p className="text-[10px] text-[#64748b] leading-tight mt-0.5" title={fit.revenue_logic}>
              {fit.revenue_logic.slice(0, 60)}{fit.revenue_logic.length > 60 ? "…" : ""}
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1 mb-0.5">
              <Clock className="w-3 h-3" /> Window
            </p>
            <p className="text-sm font-black text-white tabular-nums">
              {fit.urgency_window_days} days
            </p>
            <p className="text-[10px] text-[#64748b] leading-tight mt-0.5">
              Buying intent stays warm
            </p>
          </div>
        </div>
      )}

      {/* Opener */}
      {(fit?.suggested_opener || signal.recommended_pitch) && (
        <div className="mb-3 rounded-lg border border-white/8 bg-white/3 p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mb-1">
            Suggested opener
          </p>
          <p className="text-sm text-white/85 italic leading-relaxed">
            "{fit?.suggested_opener || signal.recommended_pitch}"
          </p>
        </div>
      )}

      {/* Objection */}
      {fit?.objection_to_expect && (
        <div className="mb-3 flex items-start gap-2 text-[11px] text-[#94a3b8]">
          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <span><span className="font-bold text-amber-400">Watch for:</span> {fit.objection_to_expect}</span>
        </div>
      )}

      {/* Action bar */}
      <OutreachActionBar ctx={ctx} />
    </div>
  );
}
