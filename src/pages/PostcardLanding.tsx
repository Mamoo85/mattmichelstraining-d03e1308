/**
 * PostcardLanding — QR landing page for physical postcard scans.
 * Public, no auth. URL: /postcard?audience=...&utm_campaign=<id>&pid=<prospect_id>
 *
 * When `pid` is present (the QR was generated for a specific recipient), the page
 * personalizes the hero with the recipient's company name and unlocks an inline
 * free Growth Signals dossier preview + a $50 "5 More Dossiers" purchase CTA —
 * the same offer they'd get on /get-dossier, but pre-unlocked because the
 * physical postcard already qualified them as the lead.
 *
 * When `pid` is missing or lookup fails, falls back to the original multi-offer
 * layout so old QR codes still work.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

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
  const prospectId = params.get("pid");

  const hero = HERO_BY_AUDIENCE[audience] || HERO_BY_AUDIENCE.contractor;
  const secondary = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.key !== hero.key).slice(0, 4),
    [hero.key],
  );

  // Personalized state — only populated when ?pid=<uuid> resolves to a real recipient.
  const [recipient, setRecipient] = useState<{ business_name: string; city: string | null } | null>(null);
  const [recipientLoading, setRecipientLoading] = useState<boolean>(!!prospectId);

  // Inline free-dossier preview state.
  const [dossierHtml, setDossierHtml] = useState<string | null>(null);
  const [dossierCompany, setDossierCompany] = useState<string | null>(null);
  const [dossierSignalId, setDossierSignalId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [unlockEmail, setUnlockEmail] = useState("");

  // Purchase CTA state.
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    logConversion(campaignId, audience, hero.key, "scan");
  }, [campaignId, audience, hero.key]);

  // Lookup the postcard recipient by prospect_id (best-effort — fallback layout
  // renders if this fails).
  useEffect(() => {
    if (!prospectId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("lookup-postcard-prospect", {
          body: { prospect_id: prospectId, campaign_id: campaignId },
        });
        if (cancelled) return;
        if (error || !data?.business_name) {
          setRecipient(null);
        } else {
          setRecipient({ business_name: data.business_name, city: data.city || null });
        }
      } catch {
        if (!cancelled) setRecipient(null);
      } finally {
        if (!cancelled) setRecipientLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prospectId, campaignId]);

  const handleClaim = (offer: Offer, isHero: boolean) => {
    logConversion(
      campaignId,
      audience,
      offer.key,
      isHero ? "click_hero" : `click_secondary_${offer.key}`,
    );
  };

  const unlockDossier = async () => {
    if (!unlockEmail.trim()) {
      setDossierError("Enter your work email to unlock the dossier.");
      return;
    }
    setDossierLoading(true);
    setDossierError(null);
    try {
      const { data, error } = await supabase.functions.invoke("request-free-dossier", {
        body: {
          email: unlockEmail.trim(),
          company: recipient?.business_name || null,
          source: `postcard_qr:${campaignId || "unknown"}`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDossierHtml((data as any).html);
      setDossierCompany((data as any).company_name);
      setDossierSignalId((data as any).signal_id);
      logConversion(campaignId, audience, "free_dossier_unlock", "dossier_unlocked");
    } catch (e: any) {
      setDossierError(e?.message || "Could not load dossier — try again or call (313) 992-1219.");
    } finally {
      setDossierLoading(false);
    }
  };

  const buyDossierPack = async () => {
    if (!unlockEmail.trim()) {
      setCheckoutError("Enter your work email above first.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-dossier-pack-checkout", {
        body: { email: unlockEmail.trim(), signal_id: dossierSignalId || undefined },
      });
      if (error) throw error;
      if ((data as any)?.url) {
        logConversion(campaignId, audience, "dossier_pack_5", "checkout_started");
        window.location.href = (data as any).url;
      } else {
        throw new Error("Checkout URL missing");
      }
    } catch (e: any) {
      setCheckoutError(e?.message || "Checkout failed — call (313) 992-1219.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // PERSONALIZED VIEW — when we resolved a real recipient from ?pid=
  if (prospectId && recipient && !recipientLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white">
        <SEOHead
          title={`${recipient.business_name} — Your Free Growth Dossier`}
          description={`Detroit Web Agency intelligence dossier for ${recipient.business_name}.`}
          path="/postcard"
        />

        <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-sm">
            <span className="text-white">DETROIT</span>{" "}
            <span className="text-[#00d4ff]">WEB AGENCY</span>
          </div>
          <a href="tel:+13139921219" className="text-[#00d4ff] text-sm font-semibold hover:underline">
            (313) 992-1219
          </a>
        </header>

        <section className="px-6 py-10 max-w-3xl mx-auto text-center">
          <p className="text-[#00d4ff] text-xs uppercase tracking-widest mb-3 font-bold">
            👋 Welcome, {recipient.business_name}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-3">
            Your free <span className="text-[#00d4ff]">Growth Signals dossier</span> is ready.
          </h1>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-2 max-w-xl mx-auto">
            You scanned the postcard we mailed to <strong className="text-white">{recipient.business_name}</strong>
            {recipient.city ? ` in ${recipient.city}` : ""} — that's all the qualification we need.
            Drop your work email below and we'll generate a 1-page intelligence dossier on a Metro Detroit
            manufacturer about to spend on supplier consumables.
          </p>
        </section>

        {/* Unlock form / dossier preview */}
        <section className="px-6 max-w-2xl mx-auto pb-8">
          {!dossierHtml ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-semibold text-white/80 mb-2">
                Work email (no Gmail / Yahoo)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={unlockEmail}
                  onChange={(e) => setUnlockEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  disabled={dossierLoading}
                  className="flex-1 bg-[#0a1628] border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#00d4ff] outline-none"
                />
                <button
                  onClick={unlockDossier}
                  disabled={dossierLoading || !unlockEmail.trim()}
                  className="bg-[#00d4ff] text-[#0a1628] font-bold px-6 py-3 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dossierLoading ? "Generating…" : "Unlock Free Dossier →"}
                </button>
              </div>
              {dossierError && (
                <p className="text-red-400 text-sm mt-3">{dossierError}</p>
              )}
              <p className="text-white/40 text-xs mt-3">
                No credit card. No spam. We log this scan to your postcard for attribution only.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 text-center">
                <p className="text-emerald-300 text-sm font-semibold">
                  ✅ Dossier unlocked for <strong>{dossierCompany}</strong>
                </p>
              </div>
              <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
                <iframe
                  title={`Growth dossier — ${dossierCompany}`}
                  srcDoc={dossierHtml}
                  className="w-full"
                  style={{ minHeight: 720, border: 0 }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Purchase CTA — always visible, more prominent after unlock */}
        <section className="px-6 max-w-2xl mx-auto pb-12">
          <div className="bg-gradient-to-br from-[#00d4ff]/15 to-emerald-500/15 border border-[#00d4ff]/40 rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2 font-bold">
              {dossierHtml ? "Want more like this?" : "After your free preview"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-black mb-3">
              5 More Industrial Growth Dossiers
            </h2>
            <p className="text-white/70 text-base mb-1">
              Five freshly-curated 1-page intelligence dossiers on Metro Detroit manufacturers
              about to spend on supplier consumables. Delivered within 24 hours.
            </p>
            <div className="text-4xl font-black text-[#00d4ff] my-5">$50</div>
            <button
              onClick={buyDossierPack}
              disabled={checkoutLoading}
              className="inline-block bg-[#00d4ff] text-[#0a1628] font-bold text-base px-8 py-4 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? "Loading checkout…" : "Get 5 More Dossiers — $50 →"}
            </button>
            {checkoutError && (
              <p className="text-red-400 text-sm mt-3">{checkoutError}</p>
            )}
            <p className="text-white/40 text-xs mt-4">
              One-time payment · Delivered within 24 hours · Refund if you don't find at least 1 actionable signal
            </p>
          </div>
        </section>

        {/* Founder vouch */}
        <section className="px-6 max-w-2xl mx-auto pb-12">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-[#00d4ff] text-[#0a1628]">
              MM
            </div>
            <div className="text-sm">
              <div className="font-bold text-white">Matt Michels — Founder</div>
              <div className="text-white/60 text-xs leading-snug">
                Don't believe it works? Text me. I'll call you and prove it.{" "}
                <a href="tel:+13139921219" className="font-semibold text-[#00d4ff]">
                  (313) 992-1219
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 px-6 py-6 text-center text-white/30 text-xs">
          Detroit Web Agency · Grosse Pointe, MI · We Handle The Tech
        </footer>
      </div>
    );
  }

  // FALLBACK VIEW — original multi-offer layout (no pid, lookup failed, or still loading).

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
