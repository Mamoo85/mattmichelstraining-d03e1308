/**
 * PostcardLanding — Multi-offer landing page for postcard QR scans.
 * Public, no auth. URL: /postcard?audience=nursing-home&utm_campaign=<id>
 *
 * One QR per postcard → here. Hero offer matches their audience.
 * 3 secondary offers below sell the rest of the product line.
 * Every click logs to postcard_conversions for attribution.
 */
import { useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";

type Audience =
  | "healthcare-agency" | "trades-agency" | "nursing-home"
  | "contractor" | "supply-house";

interface Offer {
  key: string;
  emoji: string;
  title: string;
  pitch: string;
  cta: string;
  href: string;
  accent: string;
}

const HERO_BY_AUDIENCE: Record<Audience, Offer> = {
  "nursing-home": {
    key: "talent_radar_healthcare",
    emoji: "🏥", title: "FREE 10 Verified Nurse Names",
    pitch: "We identify newly licensed CNAs, LPNs, and RNs in Michigan — often within hours of certification. Your first 10 names are free. Verified. With contact info.",
    cta: "Claim My 10 Free Nurses", href: "/staffing?industry=healthcare&src=postcard",
    accent: "#10b981",
  },
  "healthcare-agency": {
    key: "talent_radar_healthcare",
    emoji: "🏥", title: "FREE 10 Verified Nurse Names",
    pitch: "We identify newly licensed CNAs, LPNs, and RNs across Michigan before your competitors. Verified names. Direct contact info. First 10 free.",
    cta: "Claim My 10 Free Names", href: "/staffing?industry=healthcare&src=postcard",
    accent: "#10b981",
  },
  "trades-agency": {
    key: "talent_radar_trades",
    emoji: "🔧", title: "FREE 10 Licensed Tech Names",
    pitch: "Newly licensed HVAC techs, plumbers, electricians, boiler operators in Michigan — before they hit the job boards. Verified. Direct contact.",
    cta: "Claim My 10 Free Techs", href: "/staffing?industry=trades&src=postcard",
    accent: "#3b82f6",
  },
  "contractor": {
    key: "talent_radar_trades",
    emoji: "🔧", title: "FREE 10 Licensed Names",
    pitch: "We find newly licensed tradespeople in Michigan before they hit the job boards. Verified names, availability scores, direct contact.",
    cta: "Claim My 10 Free Names", href: "/go/techalert?src=postcard",
    accent: "#3b82f6",
  },
  "supply-house": {
    key: "demand_radar",
    emoji: "📡", title: "FREE Month — Demand Radar",
    pitch: "We detect which companies are expanding — based on hiring patterns — and predict what equipment they'll need. You get the intel before competitors.",
    cta: "Start My Free Month", href: "/demand-radar?src=postcard",
    accent: "#06b6d4",
  },
};

const ALL_PRODUCTS: Offer[] = [
  {
    key: "talent_radar_healthcare", emoji: "🏥", title: "Talent Radar — Healthcare",
    pitch: "Newly licensed nurses delivered daily.",
    cta: "See How It Works", href: "/staffing?industry=healthcare&src=postcard-secondary",
    accent: "#10b981",
  },
  {
    key: "talent_radar_trades", emoji: "🔧", title: "Talent Radar — Trades",
    pitch: "Newly licensed HVAC, plumbing, electrical techs.",
    cta: "See How It Works", href: "/staffing?industry=trades&src=postcard-secondary",
    accent: "#3b82f6",
  },
  {
    key: "demand_radar", emoji: "📡", title: "Demand Radar",
    pitch: "Spot expanding companies before they buy.",
    cta: "Try Free Month", href: "/demand-radar?src=postcard-secondary",
    accent: "#06b6d4",
  },
  {
    key: "field_desk", emoji: "🛠️", title: "FieldDesk",
    pitch: "Replace eWay CRM. Built for boiler rooms, not Outlook.",
    cta: "See FieldDesk", href: "/field-service?src=postcard-secondary",
    accent: "#f59e0b",
  },
  {
    key: "missed_call_catch", emoji: "📞", title: "Missed Call Catch",
    pitch: "Auto-text every missed caller in 12 seconds.",
    cta: "Stop Losing Calls", href: "/missed-call-catch?src=postcard-secondary",
    accent: "#ef4444",
  },
];

async function logConversion(
  campaignId: string | null,
  audience: string,
  productKey: string,
  event: string,
) {
  try {
    await (supabase.from as any)("postcard_conversions").insert({
      campaign_id: campaignId,
      audience_type: audience,
      product_key: productKey,
      event,
      user_agent: navigator.userAgent.substring(0, 200),
      referrer: document.referrer.substring(0, 200) || null,
    });
  } catch {
    // non-blocking
  }
}

export default function PostcardLanding() {
  const [params] = useSearchParams();
  const audience = (params.get("audience") || "contractor") as Audience;
  const campaignId = params.get("utm_campaign");
  const city = params.get("city") || "";

  const hero = HERO_BY_AUDIENCE[audience] || HERO_BY_AUDIENCE.contractor;
  const secondary = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.key !== hero.key).slice(0, 4),
    [hero.key],
  );

  useEffect(() => {
    logConversion(campaignId, audience, hero.key, "scan");
  }, [campaignId, audience, hero.key]);

  const handleClaim = (offer: Offer, isHero: boolean) => {
    logConversion(
      campaignId,
      audience,
      offer.key,
      isHero ? "click_hero" : `click_secondary_${offer.key}`,
    );
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead
        title={`${hero.title} — Detroit Web Agency`}
        description={hero.pitch}
        path="/postcard"
      />

      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-sm">
          <span className="text-white">DETROIT</span>{" "}
          <span className="text-[#00d4ff]">WEB AGENCY</span>
        </div>
        <a
          href="tel:+13139921219"
          className="text-[#00d4ff] text-sm font-semibold hover:underline"
        >
          (313) 992-1219
        </a>
      </header>

      {/* Hero offer */}
      <section className="px-6 py-12 max-w-3xl mx-auto text-center">
        {city && (
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
            For {city}
          </p>
        )}
        <div className="text-5xl mb-4">{hero.emoji}</div>
        <h1
          className="text-3xl sm:text-4xl font-black leading-tight mb-4"
          style={{ color: hero.accent }}
        >
          {hero.title}
        </h1>
        <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          {hero.pitch}
        </p>
        <Link
          to={hero.href}
          onClick={() => handleClaim(hero, true)}
          className="inline-block px-8 py-4 rounded-lg font-bold text-base shadow-lg transition-transform hover:scale-105"
          style={{ background: hero.accent, color: "#0a1628" }}
        >
          {hero.cta} →
        </Link>
        <p className="text-white/30 text-xs mt-4">
          No credit card. No spam. Real names with contact info.
        </p>
      </section>

      {/* Founder vouch */}
      <section className="px-6 max-w-2xl mx-auto pb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
            style={{ background: hero.accent, color: "#0a1628" }}
          >
            MM
          </div>
          <div className="text-sm">
            <div className="font-bold text-white">Matt Michels — Founder</div>
            <div className="text-white/60 text-xs leading-snug">
              Don't believe it works? Text me. I'll call you and prove it.{" "}
              <a
                href="tel:+13139921219"
                className="font-semibold"
                style={{ color: hero.accent }}
              >
                (313) 992-1219
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary offers */}
      <section className="px-6 py-12 border-t border-white/10 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">
            Plus — Free Tools You Can Try Today
          </div>
          <h2 className="text-2xl font-bold text-white">
            We handle every part of your tech.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {secondary.map((offer) => (
            <Link
              key={offer.key}
              to={offer.href}
              onClick={() => handleClaim(offer, false)}
              className="group block bg-white/5 border border-white/10 hover:border-white/30 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="text-2xl">{offer.emoji}</div>
                <div className="flex-1">
                  <div
                    className="font-bold text-base"
                    style={{ color: offer.accent }}
                  >
                    {offer.title}
                  </div>
                  <p className="text-white/60 text-sm mt-1 leading-snug">
                    {offer.pitch}
                  </p>
                </div>
              </div>
              <div
                className="text-xs font-semibold mt-3 group-hover:underline"
                style={{ color: offer.accent }}
              >
                {offer.cta} →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-white/30 text-xs">
        Detroit Web Agency · Grosse Pointe, MI · We Handle The Tech
      </footer>
    </div>
  );
}
