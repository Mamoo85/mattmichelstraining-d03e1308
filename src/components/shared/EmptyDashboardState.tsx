import { Sparkles, ExternalLink, Clock, Mail, Phone, Eye } from "lucide-react";

type TimelineStep = { when: string; what: string; done?: boolean };

type Props = {
  productName: string;
  checklist: string[];
  etaText: string;
  setupGuideHref?: string;
  /** Optional ordered "what happens next" steps. */
  timeline?: TimelineStep[];
  /** Optional sample lead preview to show what a real lead looks like. */
  sampleLead?: {
    title: string;
    address?: string;
    signal: string;
    score: number;
    opener?: string;
  };
  /** Direct support contact — defaults to Matt @ DWA. */
  supportEmail?: string;
  supportPhone?: string;
};

const DEFAULT_TIMELINE: TimelineStep[] = [
  { when: "Now", what: "Your service area is locked in and scanners are running.", done: true },
  { when: "Within 24h", what: "First scan cycle completes — most clients see 1–3 leads on day one." },
  { when: "Daily 8am ET", what: "Morning digest email + SMS with new leads from overnight scans." },
  { when: "Mondays", what: "Weekly performance summary: leads, conversions, ROI." },
];

/** Friendly empty state for product portals before any data has populated. */
export default function EmptyDashboardState({
  productName,
  checklist,
  etaText,
  setupGuideHref,
  timeline = DEFAULT_TIMELINE,
  sampleLead,
  supportEmail = "matt@detroitwebagent.com",
  supportPhone = "(313) 992-1219",
}: Props) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a1628] p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00d4ff]/15 mb-4">
          <Sparkles className="text-[#00d4ff]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Your {productName} is warming up</h2>
        <p className="text-white/60 mb-6">{etaText}</p>

        <ul className="text-left max-w-md mx-auto space-y-2 mb-6">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
              <span className="text-[#00d4ff] mt-0.5">✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>

        {setupGuideHref && (
          <a
            href={setupGuideHref}
            className="inline-flex items-center gap-2 text-[#00d4ff] hover:text-white text-sm font-semibold"
          >
            Setup guide <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* What happens next timeline */}
      <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a1628]/60 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#00d4ff]" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">What happens next</h3>
        </div>
        <ol className="space-y-3">
          {timeline.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                  step.done ? "bg-[#00d4ff] text-[#0a1628]" : "bg-white/10 text-white/60"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-[#00d4ff] font-mono">{step.when}</div>
                <div className="text-sm text-white/80">{step.what}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Sample lead preview */}
      {sampleLead && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wider">Sample lead — this is what you'll see</h3>
          </div>
          <div className="rounded-lg bg-[#0a1628] border border-white/10 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-white">{sampleLead.title}</div>
                {sampleLead.address && <div className="text-xs text-white/50">{sampleLead.address}</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#00d4ff]">{sampleLead.score}</div>
                <div className="text-[10px] text-white/40 uppercase">score</div>
              </div>
            </div>
            <div className="text-xs text-white/60 mb-2">📡 {sampleLead.signal}</div>
            {sampleLead.opener && (
              <div className="text-xs italic text-white/70 border-l-2 border-[#00d4ff] pl-2 mt-2">
                "{sampleLead.opener}"
              </div>
            )}
          </div>
          <div className="text-[11px] text-amber-200/70 mt-2 italic">Sample only — your real leads will appear here.</div>
        </div>
      )}

      {/* Direct support */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/70">Questions? Want to add ZIPs or change settings?</div>
        <div className="flex gap-2">
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white"
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </a>
          <a
            href={`tel:${supportPhone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-[#0a1628] text-xs font-bold"
          >
            <Phone className="w-3.5 h-3.5" /> {supportPhone}
          </a>
        </div>
      </div>
    </div>
  );
}
