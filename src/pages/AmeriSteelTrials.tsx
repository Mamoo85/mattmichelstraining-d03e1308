import { Helmet } from "react-helmet-async";

const TOKENS = {
  techalert: "06b718189457a0113006da36c7981b5dc6941fb9b95168d2abd6b2d8882a320d",
  siteradar: "9201f8ed18c775d4d0684bc29280f660663326b33a8995aee3298a9a3dce1fbe",
  missedCall: "71b9e32ae18199cb6f4417f08dd4a8e362e65a4e9bae57aa91fa01b815c889fa",
  buyerRadar: "f66c3f090b0a780dc17db3f77f8c6de4a2ac76b934896be44f752d932d6f948a",
};

const PRODUCTS = [
  {
    name: "SiteRadar",
    tagline: "See which OEMs & Tier-1s are reading your site",
    pitch:
      "Every time a buyer at Magna, Stellantis, or a Tier-1 visits ameristeel.com — you'll see the company, what pages they read, and how often they came back. Built for RFQ shops.",
    cta: "Open SiteRadar →",
    href: `/my-site-radar?token=${TOKENS.siteradar}`,
    accent: "#00d4ff",
  },
  {
    name: "Missed-Call Catch",
    tagline: "Auto-text every dropped quote call in 12 seconds",
    pitch:
      "When (586) 585-5250 rings and nobody picks up, the caller gets an instant text from your number: 'Sorry we missed you — what part are you needing?' Voicemails transcribed to your phone.",
    cta: "Open Missed-Call →",
    href: `/my-missed-call?token=${TOKENS.missedCall}`,
    accent: "#22d3ee",
  },
  {
    name: "TechAlert",
    tagline: "Know before your welder or laser-op quits",
    pitch:
      "With 6 employees, losing one tradesman is catastrophic. TechAlert monitors LinkedIn, Indeed activity, certification renewals, and 8 other signals — flags flight risk weeks before they hand in notice.",
    cta: "Open TechAlert →",
    href: `/talent-radar/dashboard?token=${TOKENS.techalert}`,
    accent: "#a78bfa",
  },
  {
    name: "Buyer Radar",
    tagline: "Auto OEM expansions, RFPs & contract awards",
    pitch:
      "Daily feed of every new automotive plant expansion, supplier contract award, and Tier-1 RFP signal across SE Michigan. Top-of-funnel intel for sales — no cold calling needed.",
    cta: "Open Buyer Radar →",
    href: `/my-industry-pulse?token=${TOKENS.buyerRadar}`,
    accent: "#34d399",
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
          content="Four free trials provisioned for AmeriSteel by Detroit Web Agency."
        />
      </Helmet>

      <header className="border-b border-white/10 bg-[#061021]">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#00d4ff]/80">
              Detroit Web Agency
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">
              Tripp — your 4 trials are live
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
        <p className="text-white/70 text-base sm:text-lg leading-relaxed">
          Hand-picked for AmeriSteel — a 6-person automotive sheet-metal fab
          shop running RFQ-driven work. Each card opens straight into your
          dashboard, no login. 30 days free, no card on file.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {PRODUCTS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              className="group block rounded-xl border border-white/10 bg-[#0f1f35] p-5 hover:border-[#00d4ff]/60 transition-colors"
              style={{ boxShadow: `0 0 0 1px transparent` }}
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
            Questions, want a 10-min walkthrough, or want to swap any of these
            for something else? Text or call me direct:
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
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
