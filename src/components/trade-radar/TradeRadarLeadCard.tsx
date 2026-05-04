import { useState } from "react";
import { MapPin, Clock, DollarSign, Lock, CheckCircle, Phone, ChevronRight, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ScoreBreakdown from "@/components/shared/ScoreBreakdown";

export interface TradeRadarLead {
  id: string;
  vertical: string;
  address: string;
  city: string;
  zip: string;
  signal_type: string;
  signal_detail: string;
  signal_date: string;
  score: number;
  source_method: string;
  suggested_opener: string;
  best_call_window: string;
  estimated_value: number;
  street_view_url?: string;
  raw_source_data?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  signal_count?: number | null;
}

interface TradeRadarLeadCardProps {
  lead: TradeRadarLead;
  claimed?: boolean;
  onClaim?: (lead: TradeRadarLead) => void | Promise<void>;
  className?: string;
  /** Optional action bar (Mark Called / Snooze / Pass). Renders below CTA when provided. */
  actionBar?: React.ReactNode;
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

function getScoreColor(score: number): { dot: string; bar: string; label: string; text: string } {
  if (score >= 9) return { dot: "bg-red-500", bar: "bg-red-500", label: "URGENT", text: "text-red-400" };
  if (score >= 7) return { dot: "bg-orange-500", bar: "bg-orange-500", label: "HOT", text: "text-orange-400" };
  if (score >= 5) return { dot: "bg-yellow-500", bar: "bg-yellow-500", label: "WARM", text: "text-yellow-400" };
  return { dot: "bg-green-500", bar: "bg-green-500", label: "COOL", text: "text-green-400" };
}

function formatDaysAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recently";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

function formatCurrency(cents: number): string {
  if (cents >= 100000) return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function ScoreMeter({ score }: { score: number }) {
  const colors = getScoreColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-4 rounded-sm transition-all",
              i < score ? colors.dot : "bg-white/10"
            )}
          />
        ))}
      </div>
      <span className={cn("text-xs font-bold font-mono tabular-nums", colors.text)}>
        {score}/10
      </span>
      <span className={cn(
        "text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
        score >= 9 && "bg-red-500/20 text-red-400 border border-red-500/30",
        score >= 7 && score < 9 && "bg-orange-500/20 text-orange-400 border border-orange-500/30",
        score >= 5 && score < 7 && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
        score < 5 && "bg-green-500/20 text-green-400 border border-green-500/30"
      )}>
        {colors.label}
      </span>
    </div>
  );
}

export default function TradeRadarLeadCard({
  lead,
  claimed = false,
  onClaim,
  className,
  actionBar,
}: TradeRadarLeadCardProps) {
  const [loading, setLoading] = useState(false);
  const signalLabel = getSignalLabel(lead.signal_type);
  const daysAgo = formatDaysAgo(lead.signal_date);
  const jobValue = formatCurrency(lead.estimated_value);
  const firstSentence = lead.signal_detail.split(/[.!?]/)[0].trim();
  const remainingDetail = lead.signal_detail.slice(firstSentence.length).replace(/^[.!?]\s*/, "");

  async function handleClaim() {
    if (!onClaim || claimed) return;
    setLoading(true);
    try {
      await onClaim(lead);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      "relative rounded-2xl border overflow-hidden transition-all duration-300",
      "bg-[#0a1628] border-white/10",
      !claimed && "hover:border-[#00d4ff]/50 hover:shadow-[0_0_24px_rgba(0,212,255,0.08)]",
      claimed && "border-green-500/30",
      className
    )}>
      {claimed && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Claimed
        </div>
      )}

      <div className="flex flex-col sm:flex-row">
        {lead.street_view_url && (
          <div className="sm:w-48 sm:flex-shrink-0 relative overflow-hidden">
            <img
              src={lead.street_view_url}
              alt={`Street view of ${lead.address}`}
              className="w-full h-36 sm:h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a1628]/60 sm:block hidden" />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-[10px] text-white/70 px-2 py-0.5 rounded font-mono">
              <MapPin className="w-2.5 h-2.5" />
              Street View
            </div>
          </div>
        )}

        <div className="flex-1 p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-[#00d4ff]/10 border border-[#00d4ff]/25 text-[#00d4ff] text-xs font-semibold px-3 py-1 rounded-full">
                  {signalLabel}
                </span>
                <span className="text-[11px] text-white/40 font-mono">{daysAgo}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/70 text-sm">
                <MapPin className="w-3.5 h-3.5 text-[#00d4ff] flex-shrink-0" />
                <span className="font-medium text-white truncate">{lead.address}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/50 text-xs">{lead.city}, {lead.zip}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-[#0f2640] border border-white/10 rounded-lg px-3 py-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#00d4ff]" />
                <span className="text-white font-bold text-sm">{jobValue}</span>
                <span className="text-white/40 text-[11px]">est. job</span>
              </div>
            </div>
          </div>

          <ScoreMeter score={lead.score} />

          <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-[#00d4ff]/70">
              <Zap className="w-3 h-3" />
              What We Found
            </div>
            <p className="text-white/90 text-sm leading-relaxed">
              <span className="font-semibold text-white">{firstSentence}.</span>
              {remainingDetail && (
                <span className="text-white/60"> {remainingDetail}</span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-[#00d4ff]/15 bg-[#00d4ff]/5 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#00d4ff]/70">
                  Suggested Opener
                </div>
                <p className="text-white/85 text-sm leading-relaxed italic">
                  &ldquo;{lead.suggested_opener}&rdquo;
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-semibold">{lead.best_call_window}</span>
              </div>
              {!claimed && (
                <div className="flex items-center gap-1 text-[10px] text-white/35 font-mono">
                  <Lock className="w-3 h-3" />
                  Exclusive to one contractor
                </div>
              )}
            </div>

            {!claimed ? (
              <Button
                onClick={handleClaim}
                disabled={loading}
                className={cn(
                  "bg-[#00d4ff] hover:bg-[#00bde8] text-[#0a1628] font-bold text-sm px-5 rounded-xl",
                  "transition-all duration-150 active:scale-95",
                  loading && "opacity-70 pointer-events-none"
                )}
              >
                {loading ? "Claiming…" : (
                  <>
                    Claim Lead
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm rounded-xl"
                onClick={() => window.open(`tel:`, "_self")}
              >
                <Phone className="w-4 h-4 mr-1.5" />
                Call Now
              </Button>
            )}
          </div>
          {actionBar}
        </div>
      </div>
    </div>
  );
}
