import { Helmet } from "react-helmet-async";

// Tokens for the existing AmeriSteel trial shells.
// All 3 radar portals (Industry Pulse / Buyer Radar / Demand Radar) are
// served from the same `industry_pulse_clients` row, so they share one token —
// EXCEPT Demand Radar, which uses an HMAC-signed token minted on demand
// via the `demand-radar-magic-link` edge function.
const TOKENS = {
  siteradar: "9201f8ed18c775d4d0684bc29280f660663326b33a8995aee3298a9a3dce1fbe",
  missedCall: "71b9e32ae18199cb6f4417f08dd4a8e362e65a4e9bae57aa91fa01b815c889fa",
  industryPulse: "f66c3f090b0a780dc17db3f77f8c6de4a2ac76b934896be44f752d932d6f948a",
};

const SUPABASE_URL = "https://eauvubfpanpeuxsrqesu.supabase.co";
const AMERISTEEL_EMAIL = "info@ameristeel.com";

const PRODUCTS = [
  {
    name: "SiteRadar",
    tagline: "See which OEMs & Tier-1s are reading your site",
    pitch:
      "Every time a buyer at Magna, Stellantis, or a Tier-1 visits ameristeel.com — you'll see the company, what pages they read, and how often they came back. (Needs a 1-line pixel installed on your site to start producing data.)",
    cta: "Open SiteRadar →",
    href: `/my-site-radar?token=${TOKENS.siteradar}`,
    accent: "#00d4ff",
  },
  {
    name: "Missed-Call Catch",
    tagline: "Auto-text every dropped quote call in 12 seconds",
    pitch:
      "When (586) 585-5250 rings and nobody picks up, the caller gets an instant text from your number: 'Sorry we missed you — what part are you needing?' Voicemails transcribed to your phone. (Needs your business line forwarded to our Twilio number to start firing.)",
    cta: "Open Missed-Call →",
    href: `/my-missed-call?token=${TOKENS.missedCall}`,
    accent: "#22d3ee",
  },
  {
    name: "Demand Radar",
    tagline: "Live RFPs, bid awards & procurement signals",
    pitch:
      "Daily feed of public-sector + private RFPs aggregated from MITN, BidNet, USAspending, SAM.gov and 40+ public sources — filtered for sheet metal / steel fab NAICS. The actual 'auto-OEM RFP feed' you want.",
    cta: "Open Demand Radar →",
    // Magic link: mints a fresh 7-day signed token on click → 302 to portal
    href: `${SUPABASE_URL}/functions/v1/demand-radar-magic-link?email=${encodeURIComponent(AMERISTEEL_EMAIL)}`,
    accent: "#34d399",
  },
  {
    name: "Buyer Radar",
    tagline: "Companies showing buying-mode intent",
    pitch:
      "Spots automotive Tier-1s and OEM suppliers that are about to issue work — funding rounds, expansion permits, leadership changes, hiring surges. Get there before the RFQ goes out.",
    cta: "Open Buyer Radar →",
    href: `/my-buyer-radar?token=${TOKENS.industryPulse}`,
    accent: "#f59e0b",
  },
  {
    name: "Industry Pulse (Growth Radar)",
    tagline: "SE Michigan automotive market trend map",
    pitch:
      "Week-over-week heat map of which sub-segments of automotive manufacturing are expanding — permit velocity, hiring trends, capital flows. Macro intel, not individual leads.",
    cta: "Open Industry Pulse →",
    href: `/my-industry-pulse?token=${TOKENS.industryPulse}`,
    accent: "#a78bfa",
  },
];

export default function AmeriSteelTrials() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <Helmet>
        <title>AmeriSteel Trials — Detroit Web Agency</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta
          name="description"
          content="Free trial dashboards provisioned for AmeriSteel by Detroit Web Agency."
        />
      </Helmet>

      <header className="border-b border-white/10 bg-[#061021]">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#00d4ff]/80">
              Detroit Web Agency
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">
              Tripp — your AmeriSteel trial suite
            </h1>
          </div>
          <a
            href="tel:+13139921219"
            className="text-sm text-[#00d4ff] underline underline-offset-4"
          >
            (313) 992-1219
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        <div className="rounded-xl border-2 border-[#00d4ff]/60 bg-gradient-to-br from-[#00d4ff]/10 to-[#0f1f35] p-6">
          <div className="text-[11px] uppercase tracking-widest text-[#00d4ff] font-bold mb-2">
            ⭐ One link · all five tools
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Your AmeriSteel Trial Hub</h2>
          <p className="text-sm text-white/70 mb-4">
            Bookmark this single dashboard — it shows live counts from every tool below in one place.
            No more juggling 5 tabs.
          </p>
          <a
            href="/hub/ameristeel-2026-trial-hub"
            className="inline-block rounded-lg bg-[#00d4ff] text-[#061021] px-5 py-3 text-sm font-bold hover:bg-[#22d3ee] transition-colors"
          >
            Open Trial Hub →
          </a>
        </div>

        <details className="text-white/70 text-sm">
          <summary className="cursor-pointer text-white/80 font-semibold">
            Or open each tool individually ↓
          </summary>
          <p className="mt-3 leading-relaxed">
            Five tools hand-picked for a 6-person automotive sheet-metal fab shop running RFQ-driven work.
            Each card opens straight into your dashboard, no login. 30 days free, no card on file.
          </p>
        </details>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {PRODUCTS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              className="group block rounded-xl border border-white/10 bg-[#0f1f35] p-5 hover:border-[#00d4ff]/60 transition-colors"
            >
              <div
                className="text-[11px] uppercase tracking-widest font-semibold mb-2"
                style={{ color: p.accent }}
              >
                Trial · Active
              </div>
              <h2 className="text-lg sm:text-xl font-bold">{p.name}</h2>
              <div className="text-sm text-white/80 mt-1 mb-3">{p.tagline}</div>
              <p className="text-sm text-white/60 leading-relaxed mb-4">
                {p.pitch}
              </p>
              <div
                className="text-sm font-semibold group-hover:underline"
                style={{ color: p.accent }}
              >
                {p.cta}
              </div>
            </a>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0f1f35] p-5 mt-8">
          <div className="text-sm text-white/70">
            Quick honest note: SiteRadar needs a 1-line pixel on ameristeel.com
            and Missed-Call needs your office line forwarded — both 5-minute
            jobs I'll do for you on a 10-min call. The 3 radar dashboards
            (Demand / Buyer / Industry Pulse) work right now with no setup.
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href="tel:+13139921219"
              className="text-sm font-semibold text-[#00d4ff]"
            >
              📞 (313) 992-1219
            </a>
            <a
              href="mailto:matt@detroitwebagent.com"
              className="text-sm font-semibold text-[#00d4ff]"
            >
              ✉️ matt@detroitwebagent.com
            </a>
          </div>
          <div className="text-xs text-white/40 mt-4">
            — Matt Michels, Detroit Web Agency
          </div>
        </div>
      </main>
    </div>
  );
}
