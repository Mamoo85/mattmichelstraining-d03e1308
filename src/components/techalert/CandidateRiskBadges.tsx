// CandidateRiskBadges — TechAlert dossier add-on
// Items 3 (HIBP cyber hygiene, premium-gated) + 5 (urgency decay window).
// Renders only when the underlying DB columns are populated.

import { useMinTier } from "@/hooks/useTierAccess";
import { Shield, ShieldAlert, ShieldCheck, Clock, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  cyber_hygiene_score?: number | null;        // 0-10. Higher = cleaner.
  employer_domain_breached_recently?: boolean | null;
  password_compromised?: boolean | null;
  license_expiry?: string | null;             // YYYY-MM-DD
  urgency_score?: number | null;              // 0-10
  available_until?: string | null;            // YYYY-MM-DD
}

const daysBetween = (dateStr: string): number => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export const CandidateRiskBadges = ({
  cyber_hygiene_score,
  employer_domain_breached_recently,
  password_compromised,
  license_expiry,
  urgency_score,
  available_until,
}: Props) => {
  const isPro = useMinTier("pro");
  const navigate = useNavigate();

  const hasCyberData =
    typeof cyber_hygiene_score === "number" ||
    employer_domain_breached_recently === true ||
    password_compromised === true;

  // Urgency window calculations
  let lapsedDays = 0;
  if (license_expiry) {
    const days = daysBetween(license_expiry);
    if (days < 0) lapsedDays = Math.abs(days);
  }
  const showUrgency = lapsedDays > 0 || (typeof urgency_score === "number" && urgency_score >= 7);
  const windowDays = available_until ? daysBetween(available_until) : null;

  if (!hasCyberData && !showUrgency) return null;

  return (
    <div className="space-y-2">
      {/* Item 5 — Urgency decay window */}
      {showUrgency && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <div className="font-bold text-amber-300 mb-0.5">
              {lapsedDays > 0
                ? `⏱ License lapsed ${lapsedDays} days — outreach window narrowing`
                : "⏱ High-urgency candidate"}
            </div>
            {windowDays !== null && windowDays > 0 && (
              <div className="text-amber-200/70">
                Estimated availability window closes in <strong>~{windowDays} days</strong>
                {available_until && ` (${new Date(available_until).toLocaleDateString()})`}
              </div>
            )}
            {typeof urgency_score === "number" && urgency_score >= 7 && (
              <div className="text-amber-200/60 mt-0.5">Urgency score: {urgency_score.toFixed(1)}/10</div>
            )}
          </div>
        </div>
      )}

      {/* Item 3 — Cyber hygiene badge (Foundation = blurred, Pro+ = unlocked) */}
      {hasCyberData && (
        <div className="relative">
          {!isPro && (
            <button
              type="button"
              onClick={() => navigate("/pricing")}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-slate-900/85 backdrop-blur-sm rounded-lg border border-cyan-500/30 hover:border-cyan-500/60 transition-colors group"
            >
              <Lock className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                Pro Tier — Unlock Cyber Hygiene
              </span>
              <span className="text-[9px] text-slate-400">Tap to upgrade</span>
            </button>
          )}

          <div className={!isPro ? "blur-sm select-none pointer-events-none" : ""}>
            <CyberHygieneCard
              cyber_hygiene_score={cyber_hygiene_score}
              employer_domain_breached_recently={employer_domain_breached_recently}
              password_compromised={password_compromised}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CyberHygieneCard = ({
  cyber_hygiene_score,
  employer_domain_breached_recently,
  password_compromised,
}: Pick<Props, "cyber_hygiene_score" | "employer_domain_breached_recently" | "password_compromised">) => {
  const score = typeof cyber_hygiene_score === "number" ? cyber_hygiene_score : null;
  const isClean = score !== null && score >= 8 && !employer_domain_breached_recently && !password_compromised;
  const isRisky = (score !== null && score < 5) || password_compromised;

  const Icon = isClean ? ShieldCheck : isRisky ? ShieldAlert : Shield;
  const headerClass = isClean
    ? "text-emerald-300"
    : isRisky
    ? "text-rose-300"
    : "text-amber-300";
  const bgClass = isClean
    ? "bg-emerald-500/5 border-emerald-500/20"
    : isRisky
    ? "bg-rose-500/5 border-rose-500/20"
    : "bg-amber-500/5 border-amber-500/20";

  return (
    <div className={`border rounded-lg p-3 ${bgClass}`}>
      <div className={`flex items-center gap-2 mb-1.5 ${headerClass}`}>
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-wide">
          Credential Hygiene{score !== null ? ` · ${score}/10` : ""}
        </span>
      </div>
      <div className="text-xs text-slate-300 leading-relaxed space-y-1">
        {isClean && <div>✅ No known breach exposure on candidate or employer.</div>}
        {!isClean && score !== null && score >= 5 && (
          <div>⚠️ Some historical exposure detected — exercise standard due diligence.</div>
        )}
        {isRisky && (
          <div className="text-rose-200/90">
            🚨 Elevated risk signals — recommend security review before hire.
          </div>
        )}
        {employer_domain_breached_recently && (
          <div className="text-amber-200/80">• Current employer domain breached in last 12 months</div>
        )}
        {password_compromised && (
          <div className="text-rose-200/80">• Credential dump detected — relevant for sensitive-access roles</div>
        )}
      </div>
    </div>
  );
};

export default CandidateRiskBadges;
