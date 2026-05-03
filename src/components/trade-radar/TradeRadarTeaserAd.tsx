import { Lock, Zap, MapPin, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TradeRadarLead } from "./TradeRadarLeadCard";

interface TradeRadarTeaserAdProps {
  lead: TradeRadarLead;
  leadsWaiting?: number;
  onStartTrial?: () => void;
  className?: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  cofc_roof_inspection: "📋 Rental License Expiring",
  cofc_hvac_inspection: "📋 Rental License Expiring",
  cofc_plumbing_inspection: "📋 Rental License Expiring",
  cofc_electrical_inspection: "📋 Rental License Expiring",
  cofc_pest_inspection: "📋 Rental License Expiring",
  cofc_gutter_inspection: "📋 Rental License Expiring",
  cofc_exterior_inspection: "📋 Rental License Expiring",
  cofc_tree_inspection: "📋 Rental License Expiring",
  cofc_mold_water_inspection: "📋 Rental License Expiring",
  cofc_debris_inspection: "📋 Rental License Expiring",
  cofc_foundation_inspection: "📋 Rental License Expiring",
  fire_smoke_restoration: "🔥 Fire Incident",
  hail_damage_area: "☁️ Same-Day Storm Report",
  spc_storm_report_today: "☁️ Same-Day Storm Report",
  historic_district_violation: "🚨 Historic Violation Notice",
  roof_permit_upsell: "🔨 Roof Permit Pulled Nearby",
  bseed_trades_permits_hvac: "🔧 HVAC Permit Filed",
  bseed_trades_permits_elec: "⚡ Electrical Permit Filed",
  bseed_trades_permits_plumb: "🚿 Plumbing Permit Filed",
  demo_permit: "🏚️ Demolition Order",
  new_homeowner_roof: "🏠 New Homeowner",
  assessor_sale: "🏠 New Homeowner",
  aging_system_proxy: "⏰ System Past Useful Life",
  water_damage_permit: "💧 Water Damage Permit",
  foreclosure_vacant: "🏦 Bank-Owned / Vacant",
};

function getSignalLabel(signalType: string): string {
  return SIGNAL_LABELS[signalType] ?? "📍 Property Signal";
}

function getScoreColor(score: number) {
  if (score >= 9) return { text: "text-red-400", bg: "bg-red-500/20 border-red-500/30", label: "URGENT" };
  if (score >= 7) return { text: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30", label: "HOT" };
  if (score >= 5) return { text: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "WARM" };
  return { text: "text-green-400", bg: "bg-green-500/20 border-green-500/30", label: "COOL" };
}

function BlurredText({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "select-none pointer-events-none filter blur-[5px] opacity-60",
        className
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function redactAddress(address: string): string {
  const parts = address.trim().split(/\s+/);
  if (parts.length <= 1) return address;
  return parts.slice(1).join(" ");
}

export default function TradeRadarTeaserAd({
  lead,
  leadsWaiting = 14,
  onStartTrial,
  className,
}: TradeRadarTeaserAdProps) {
  const signalLabel = getSignalLabel(lead.signal_type);
  const scoreColors = getScoreColor(lead.score);
  const streetName = redactAddress(lead.address);
  const firstSentence = lead.signal_detail.split(/[.!?]/)[0].trim();

  return (
    <div className={cn(
      "relative rounded-2xl border border-[#00d4ff]/20 overflow-hidden bg-[#0a1628]",
      "shadow-[0_0_40px_rgba(0,212,255,0.06)]",
      className
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00d4ff]/50 to-transparent" />

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
        <Zap className="w-3 h-3" />
        Live Lead
      </div>

      <div className="flex flex-col sm:flex-row">
        {lead.street_view_url && (
          <div className="sm:w-44 sm:flex-shrink-0 relative overflow-hidden">
            <div className="relative">
              <img
                src={lead.street_view_url}
                alt="Street view"
                className="w-full h-32 sm:h-full object-cover filter blur-[3px] opacity-60 scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/80 via-[#0a1628]/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a1628]/50 sm:block hidden" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1.5 text-white/60">
                  <Lock className="w-5 h-5 text-[#00d4ff]/70" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">Locked</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 p-5 space-y-4 min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-[#00d4ff]/10 border border-[#00d4ff]/25 text-[#00d4ff] text-xs font-semibold px-3 py-1 rounded-full">
                {signalLabel}
              </span>
              <span className={cn(
                "text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                scoreColors.bg,
                scoreColors.text
              )}>
                {scoreColors.label} · {lead.score}/10
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <span className="text-white/25 text-xs font-mono tabular-nums select-none">
                <BlurredText>{"XXXX"}</BlurredText>
              </span>
              <span className="text-white/50 text-sm font-medium">{streetName}</span>
              <span className="text-white/25">·</span>
              <span className="text-white/40 text-xs">{lead.city}, {lead.zip}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-[#00d4ff]/60">
              <Zap className="w-3 h-3" />
              What We Found
            </div>
            <p className="text-sm leading-relaxed">
              <span className="text-white/90 font-medium">{firstSentence}.</span>
              {lead.signal_detail.length > firstSentence.length + 1 && (
                <span className="select-none pointer-events-none">
                  {" "}
                  <BlurredText className="text-white/40">
                    {lead.signal_detail.slice(firstSentence.length + 1, firstSentence.length + 120)}
                  </BlurredText>
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl bg-white/3 border border-white/8 p-3 overflow-hidden relative">
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Suggested Opener
            </div>
            <div className="select-none pointer-events-none filter blur-[4px] opacity-50 text-sm text-white/70 italic line-clamp-2">
              &ldquo;{lead.suggested_opener}&rdquo;
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/40 backdrop-blur-[1px]">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#00d4ff]/70">
                <Lock className="w-3 h-3" />
                Unlock to view
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 bg-gradient-to-r from-[#00d4ff]/8 via-[#0a1628] to-[#00d4ff]/5 px-5 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-1">
            <p className="text-white font-bold text-sm">
              🔓 Unlock this lead — and {leadsWaiting - 1} more like it
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
              <span className="text-white/50 text-xs font-mono">
                {leadsWaiting} leads waiting in your area
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/35 font-mono">
                <ShieldCheck className="w-3 h-3 text-green-400/60" />
                14-day free trial · no card required
              </span>
            </div>
          </div>

          <Button
            onClick={onStartTrial}
            className={cn(
              "bg-[#00d4ff] hover:bg-[#00bde8] text-[#0a1628] font-bold text-sm px-6 py-2.5 rounded-xl",
              "shadow-[0_0_20px_rgba(0,212,255,0.25)] hover:shadow-[0_0_28px_rgba(0,212,255,0.4)]",
              "transition-all duration-150 active:scale-95 whitespace-nowrap flex-shrink-0"
            )}
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
