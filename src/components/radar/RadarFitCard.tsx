// Premium "Angie's-killer" lead card for Demand & Buyer Radar.
// Compact 2-line header, gradient-fade Why, collapsed body, hot halo, DWA watermark.
// No "AI" copy anywhere — Automated Intel / Signal Strength only.

import { useEffect, useState } from "react";
import { Building2, MapPin, TrendingUp, DollarSign, Clock, AlertTriangle, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastSuccess } from "@/lib/toast";
import OutreachActionBar, { type OutreachContext } from "./OutreachActionBar";
import SignalStrengthBars from "./SignalStrengthBars";
import LeadStatusControl from "./LeadStatusControl";
import dwaMark from "@/assets/dwa-logo-clean.png";

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
    <div className="relative w-12 h-12 shrink-0" title={`Fit score ${pct}/100`}>
      <svg viewBox="0 0 56 56" className="w-12 h-12 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#1e3a5f" strokeWidth="4" fill="none" />
        <circle cx="28" cy="28" r={r} stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[12px] font-black tabular-nums leading-none" style={{ color }}>{pct}</span>
        <span className="text-[7px] uppercase tracking-widest text-[#64748b]">fit</span>
      </div>
    </div>
  );
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function isFresh24h(detected_at?: string | null) {
  if (!detected_at) return false;
  const t = new Date(detected_at).getTime();
  return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
}

export default function RadarFitCard({ signal, client, radar, onClick }: Props) {
  const [fit, setFit] = useState<FitJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [readMore, setReadMore] = useState(false);

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
    return () => { cancel = true; };
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
  const fresh = isFresh24h(signal.detected_at);
  const why = fit?.fit_reason || signal.human_summary || "";
  const whyTrim = why.length > 140 ? why.slice(0, 140).trim() + "…" : why;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={(e) => {
        // Ignore clicks bubbling up from buttons inside the card.
        const target = e.target as HTMLElement;
        if (target.closest("button, a")) return;
        onClick?.();
      }}
      className={`relative bg-[#0a1628] border rounded-xl p-4 transition-all hover:-translate-y-0.5 active:scale-[0.98] duration-150 overflow-hidden ${
        isHot ? "border-emerald-500/40" : "border-[#1e3a5f] hover:border-[#00d4ff]/40"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={isHot ? { boxShadow: "0 0 0 1px rgba(34,197,94,0.08), 0 0 32px -10px rgba(34,197,94,0.35)" } : undefined}
    >
      {/* Hot halo — animated conic ring */}
      {isHot && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-xl"
          style={{
            background: "conic-gradient(from 0deg, rgba(0,212,255,0.0) 0deg, rgba(0,212,255,0.55) 60deg, rgba(34,197,94,0.55) 180deg, rgba(0,212,255,0.0) 300deg)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            padding: "1px",
            animation: "radar-halo-spin 6s linear infinite",
            opacity: 0.6,
          }}
        />
      )}

      {/* DWA watermark — hot only */}
      {isHot && (
        <img
          src={dwaMark}
          alt=""
          aria-hidden
          className="absolute top-3 right-3 w-12 h-12 pointer-events-none select-none"
          style={{ opacity: 0.05, filter: "brightness(2)" }}
        />
      )}

      {isHot && (
        <span className="absolute -top-2 left-3 text-[9px] uppercase tracking-widest font-black bg-emerald-500 text-[#0a1628] px-1.5 py-0.5 rounded z-10">
          ● HOT FIT
        </span>
      )}

      {/* Compact 2-line header */}
      <div className="flex items-start gap-3 mb-2 relative z-[1]">
        <ScoreRing score={fit?.fit_score ?? 50} />
        <div className="min-w-0 flex-1">
          {/* Row 1: chips + signal strength */}
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
            <SignalStrengthBars value={signal.confidence ?? undefined} className="ml-auto" />
          </div>
          {/* Row 2: company + meta */}
          <h3 className="text-[14px] font-bold text-white truncate flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#00d4ff] shrink-0" />
            <span className="truncate">{signal.company_name || "Unnamed account"}</span>
          </h3>
          <div className="flex items-center gap-3 flex-wrap mt-0.5 text-[11px] text-[#94a3b8]">
            {signal.industry && <span className="truncate max-w-[110px]">{signal.industry}</span>}
            {(signal.location || signal.county) && (
              <span className="flex items-center gap-1 truncate max-w-[120px]">
                <MapPin className="w-3 h-3 shrink-0" /> {signal.location || signal.county}
              </span>
            )}
            {signal.hiring_count && signal.hiring_count > 0 ? (
              <span className="flex items-center gap-1 text-amber-400">
                <TrendingUp className="w-3 h-3" /> {signal.hiring_count} hiring
              </span>
            ) : null}
          </div>
          {/* Quiet metadata row: detected · score */}
          <div className="flex items-center gap-2 mt-1 text-[9px] uppercase tracking-widest font-mono text-[#64748b]">
            {signal.detected_at && (
              <span className={fresh ? "text-[#00d4ff] radar-urgency-pulse" : ""}>
                {fresh ? "NEW · " : "DETECTED · "}
                {new Date(signal.detected_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            {fit && <span className="opacity-60">· SCORE {fit.fit_score}/100</span>}
          </div>
        </div>
      </div>

      {/* Status / snooze / follow-up */}
      <div className="mb-3 relative z-[1]">
        <LeadStatusControl signal_id={signal.id} client_id={client.id} radar={radar} />
      </div>

      {/* Why — gradient-fade truncate */}
      <div className="mb-3 relative z-[1]">
        <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold mb-1">Why this is yours</p>
        {loading ? (
          <p className="text-xs text-[#94a3b8]">Reading signal strength for {client.company_name || "your company"}…</p>
        ) : why ? (
          <>
            <p className={`text-[13px] text-white/90 leading-relaxed ${!readMore && why.length > 140 ? "radar-fade-mask" : ""}`}>
              {readMore ? why : whyTrim}
            </p>
            {why.length > 140 && (
              <button
                onClick={(e) => { e.stopPropagation(); setReadMore((v) => !v); }}
                className="text-[11px] text-[#00d4ff] hover:underline mt-0.5"
              >
                {readMore ? "Show less" : "Read more →"}
              </button>
            )}
          </>
        ) : (
          <p className="text-[12px] text-[#64748b]">—</p>
        )}
      </div>

      {/* Revenue + window pill (always visible if fit loaded) */}
      {fit && (
        <div className="grid grid-cols-2 gap-2 mb-3 relative z-[1]">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1 mb-0.5">
              <DollarSign className="w-3 h-3" /> Revenue potential
            </p>
            <p className="text-sm font-black text-white tabular-nums">
              {fmtMoney(fit.revenue_low_usd)}–{fmtMoney(fit.revenue_high_usd)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1 mb-0.5">
              <Clock className="w-3 h-3" /> Window
            </p>
            <p className="text-sm font-black text-white tabular-nums">{fit.urgency_window_days} days</p>
          </div>
        </div>
      )}

      {/* Show details disclosure */}
      {(fit?.suggested_opener || signal.recommended_pitch || fit?.objection_to_expect || signal.predicted_needs?.length) && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowDetails((v) => !v); }}
          className="w-full text-left text-[11px] uppercase tracking-widest text-[#94a3b8] hover:text-[#00d4ff] font-bold mb-2 flex items-center gap-1 transition-colors"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showDetails ? "Hide details" : "Show details"}
        </button>
      )}

      {showDetails && (
        <div className="space-y-3 mb-3 relative z-[1]">
          {/* Editorial pull-quote opener */}
          {(fit?.suggested_opener || signal.recommended_pitch) && (
            <div className="pl-3 border-l-2 border-[#00d4ff]/60">
              <p className="text-[9px] uppercase tracking-widest text-[#94a3b8] font-bold mb-1">Suggested opener</p>
              <p className="text-[13px] text-white/85 leading-relaxed font-serif">
                {fit?.suggested_opener || signal.recommended_pitch}
              </p>
            </div>
          )}

          {fit?.objection_to_expect && (
            <div className="flex items-start gap-2 text-[11px] text-[#94a3b8]">
              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
              <span><span className="font-bold text-amber-400">Watch for:</span> {fit.objection_to_expect}</span>
            </div>
          )}

          {signal.predicted_needs?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {signal.predicted_needs.map((n, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-[#00d4ff]/30 text-[#00d4ff]/85 bg-[#00d4ff]/5">
                  {n}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Action bar */}
      <div className="relative z-[1]">
        <OutreachActionBar ctx={ctx} />
      </div>
    </div>
  );
}
