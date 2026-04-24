// LeadQualityBadges — drop-in badge cluster for contractor lead views.
// Renders only badges whose underlying DB data is populated.
// Items 35, 37, 38, 39, 45, 47 from the 50-item revenue ops list.

import { Phone, Shield, Home, Building2, Star, Crown, Mail, AlertTriangle } from "lucide-react";

export interface LeadQualityData {
  // Item 36 (Twilio carrier) — UI render of phone_carrier_type
  phone_carrier_type?: "mobile" | "landline" | "voip" | null;
  // Item 35 (HIBP email check)
  email_breach_count?: number | null;
  // Item 43 (Hunter email validation)
  email_deliverable?: boolean | null;
  // Item 44 (PDL identity confirmation)
  identity_verified?: boolean | null;
  // Item 37/38 (property intel) — populated from sonar / firecrawl
  estimated_home_value?: number | null;
  ownership_years?: number | null;
  // Item 39 (commercial detection)
  lead_type?: "residential" | "commercial" | null;
  // Item 45 (composite quality score)
  quality_score?: number | null;
  // Item 47 (VIP tier — Lusha skip-trace)
  lead_tier?: "standard" | "premium" | "vip" | null;
}

interface Props {
  data: LeadQualityData | null | undefined;
  /** When true, render compact pill row (used in lead preview / card header). Default false = full block. */
  compact?: boolean;
}

// Tier labels — no pricing shown to contractor (they already see the price on the page).
const tierConfig = {
  standard: { label: "Standard", icon: Star, classes: "border-slate-500/40 text-slate-300 bg-slate-500/10" },
  premium: { label: "Premium lead", icon: Star, classes: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
  vip: { label: "VIP — direct cell", icon: Crown, classes: "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10" },
} as const;

const Pill = ({ children, classes }: { children: React.ReactNode; classes: string }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${classes}`}
  >
    {children}
  </span>
);

export const LeadQualityBadges = ({ data, compact = false }: Props) => {
  if (!data) return null;

  const badges: React.ReactNode[] = [];

  // Tier badge (highest priority — always first)
  if (data.lead_tier && data.lead_tier !== "standard") {
    const cfg = tierConfig[data.lead_tier];
    if (cfg) {
      const Icon = cfg.icon;
      badges.push(
        <Pill key="tier" classes={cfg.classes}>
          <Icon className="h-3 w-3" /> {cfg.label}
        </Pill>
      );
    }
  }

  // Commercial flag
  if (data.lead_type === "commercial") {
    badges.push(
      <Pill key="commercial" classes="border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
        <Building2 className="h-3 w-3" /> Commercial job
      </Pill>
    );
  }

  // Composite quality score — plain language, hide weak scores
  if (typeof data.quality_score === "number" && data.quality_score >= 5) {
    const score = data.quality_score;
    const isStrong = score >= 8;
    const cls = isStrong
      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
      : "border-amber-500/40 text-amber-300 bg-amber-500/10";
    badges.push(
      <Pill key="score" classes={cls}>
        {isStrong ? "Strong lead" : "Good lead"}
      </Pill>
    );
  }

  // Phone carrier — plain English
  if (data.phone_carrier_type) {
    if (data.phone_carrier_type === "mobile") {
      badges.push(
        <Pill key="carrier" classes="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
          <Phone className="h-3 w-3" /> Cell phone ✓
        </Pill>
      );
    } else if (data.phone_carrier_type === "voip") {
      badges.push(
        <Pill key="carrier" classes="border-orange-500/40 text-orange-300 bg-orange-500/10">
          <AlertTriangle className="h-3 w-3" /> Internet phone — may not text back
        </Pill>
      );
    } else {
      badges.push(
        <Pill key="carrier" classes="border-slate-500/40 text-slate-300 bg-slate-500/10">
          <Phone className="h-3 w-3" /> Home phone
        </Pill>
      );
    }
  }

  // Identity verified (PDL match) — only show positive confirmation; "unconfirmed" creates doubt
  if (data.identity_verified === true) {
    badges.push(
      <Pill key="identity" classes="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
        <Shield className="h-3 w-3" /> Real person ✓
      </Pill>
    );
  }

  // Email status — plain English
  if (data.email_deliverable === true) {
    badges.push(
      <Pill key="email" classes="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
        <Mail className="h-3 w-3" /> Email works ✓
      </Pill>
    );
  } else if (data.email_deliverable === false) {
    badges.push(
      <Pill key="email" classes="border-rose-500/40 text-rose-300 bg-rose-500/10">
        <Mail className="h-3 w-3" /> Email bounced — call them
      </Pill>
    );
  }

  // Breach exposures intentionally hidden from contractor view — irrelevant to job decision.

  if (badges.length === 0 && !data.estimated_home_value && !data.ownership_years) {
    return null;
  }

  if (compact) {
    return <div className="flex flex-wrap gap-1.5">{badges}</div>;
  }

  return (
    <div className="space-y-3">
      {badges.length > 0 && <div className="flex flex-wrap gap-1.5">{badges}</div>}

      {/* Property intelligence card (items 37/38) */}
      {(data.estimated_home_value || data.ownership_years) && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 flex items-start gap-2.5">
          <Home className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <div className="font-bold text-slate-100 mb-0.5">About the home</div>
            {data.estimated_home_value && (
              <span>
                Est. value <strong className="text-cyan-300">${data.estimated_home_value.toLocaleString()}</strong>
              </span>
            )}
            {data.estimated_home_value && data.ownership_years ? " · " : ""}
            {data.ownership_years && (
              <span>
                Owner <strong className="text-cyan-300">{data.ownership_years} yr{data.ownership_years === 1 ? "" : "s"}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadQualityBadges;
