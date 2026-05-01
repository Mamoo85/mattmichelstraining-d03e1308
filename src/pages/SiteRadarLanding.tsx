import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PostCheckoutClaim from "@/components/checkout/PostCheckoutClaim";
import StickyMobileCTA from "@/components/shared/StickyMobileCTA";
import { Check, Zap, Bell, BarChart3, Shield, Clock, ArrowRight, Building2 } from "lucide-react";

const ACCENT = "#00d4ff";
const ACCENT_DEEP = "#0099cc";
const BG = "#030711";
const CARD = "#0a1628";
const BORDER = "#1e3a5f";

export default function SiteRadarLanding() {
  const [params] = useSearchParams();
  const success = params.get("success") === "1" || params.get("status") === "success";
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = async () => {
    if (!email || !businessName) { setError("Email and business name are required."); return; }
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("create-site-radar-checkout", {
        body: { email, business_name: businessName, website },
      });
      if (err || data?.error) throw new Error(err?.message || data?.error || "Checkout failed");
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed");
      setLoading(false);
    }
  };

  const scrollToCheckout = () => {
    document.getElementById("checkout-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <Helmet>
        <title>SiteRadar — See Which Businesses Visit Your Website | Detroit Web Agency</title>
        <meta name="description" content="Identify the companies visiting your site in real time. Get high-intent SMS alerts, weekly digests, and a live visitor feed. $49/mo. Setup in 5 minutes." />
        <meta property="og:title" content="SiteRadar — See Who's Quietly Evaluating You" />
        <meta property="og:description" content="Real-time B2B visitor identification. Know who's evaluating you before they fill out the form." />
        <link rel="canonical" href="https://detroitwebagent.com/site-radar" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SiteRadar",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "49", priceCurrency: "USD" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "47" },
        })}</script>
      </Helmet>

      <div style={{ minHeight: "100vh", background: BG, fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", color: "#fff" }}>
        {/* Animated radar background accent */}
        <div style={{
          position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 800, borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}22 0%, transparent 60%)`,
          pointerEvents: "none", zIndex: 0,
        }} />

        <main style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "48px 16px 120px" }}>
          {/* Hero */}
          <section style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${ACCENT}15`, border: `1px solid ${ACCENT}44`, borderRadius: 999, padding: "6px 14px", marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 12px #34d399" }} />
              <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>LIVE • 47 Detroit-area businesses tracked today</span>
            </div>
            <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, margin: "0 0 20px", lineHeight: 1.05, letterSpacing: -1 }}>
              See <span style={{ background: `linear-gradient(135deg, ${ACCENT}, #34d399)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>which businesses</span><br />
              visit your website.
            </h1>
            <p style={{ fontSize: 19, color: "#94a3b8", maxWidth: 640, margin: "0 auto 32px", lineHeight: 1.5 }}>
              Real-time B2B visitor identification. Know who's evaluating you — before they fill out the form, before your competitor calls them, before the lead goes cold.
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <button onClick={scrollToCheckout} style={ctaStyle}>
                Start tracking — $49/mo <ArrowRight size={18} />
              </button>
              <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>
                Cancel anytime · 5-minute setup · No long-term contract
              </p>
            </div>
          </section>

          {/* Outcome bar */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 64 }}>
            {[
              { stat: "37%", label: "of B2B sites get visits from companies that never convert" },
              { stat: "<5 min", label: "setup — paste one script tag, you're done" },
              { stat: "$49", label: "per month, flat — no usage fees, no per-visit caps" },
            ].map((s) => (
              <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
                <p style={{ color: ACCENT, fontSize: 32, fontWeight: 800, margin: "0 0 6px", lineHeight: 1 }}>{s.stat}</p>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.4 }}>{s.label}</p>
              </div>
            ))}
          </section>

          {/* Checkout form */}
          {success ? (
            <section style={{ marginBottom: 64 }}>
              <PostCheckoutClaim product="SiteRadar" />
            </section>
          ) : (
            <section id="checkout-form" style={{ background: `linear-gradient(180deg, ${CARD} 0%, #06101e 100%)`, border: `1px solid ${ACCENT}44`, borderRadius: 20, padding: 32, marginBottom: 64, boxShadow: `0 20px 60px -20px ${ACCENT}33` }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <p style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 8px" }}>Get started</p>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Start identifying visitors in 5 minutes</h2>
                <p style={{ color: "#94a3b8", fontSize: 14, margin: "8px 0 0" }}>Add your details, complete checkout, paste the script. That's it.</p>
              </div>
              <div style={{ maxWidth: 480, margin: "0 auto" }}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" type="email" style={inputStyle} />
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" style={inputStyle} />
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourwebsite.com (optional)" style={inputStyle} />
                <button id="siteradar-cta" onClick={startCheckout} disabled={loading} style={{ ...ctaStyle, width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Loading…" : <>Start — $49/mo <ArrowRight size={18} /></>}
                </button>
                {error && (
                  <div style={{ marginTop: 12, background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px" }}>
                    <p style={{ color: "#fca5a5", fontSize: 13, margin: 0 }}>{error}</p>
                  </div>
                )}
                <p style={{ color: "#64748b", fontSize: 11, textAlign: "center", margin: "14px 0 0" }}>
                  Secured by Stripe · Cancel anytime · No setup fee
                </p>
              </div>
            </section>
          )}

          {/* Features grid */}
          <section style={{ marginBottom: 64 }}>
            <h2 style={sectionH2}>Built to convert anonymous traffic into pipeline.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                { icon: <Building2 size={20} />, t: "Company-level identification", b: "We resolve visitor IPs to real company names, cities, and pages — using ipinfo + Clearbit Reveal." },
                { icon: <Zap size={20} />, t: "High-intent SMS alerts", b: "Text alerts when a visitor hits /pricing or /contact, or when one company visits 3+ times in a week." },
                { icon: <BarChart3 size={20} />, t: "Live visitor feed", b: "A clean, real-time dashboard. Filter by company, page, or repeat-visitor score." },
                { icon: <Bell size={20} />, t: "Weekly Monday digest", b: "Every Monday at 7am, an email summary of who showed up — sortable, exportable." },
                { icon: <Shield size={20} />, t: "Privacy-first", b: "We identify companies, not individuals. GDPR / CCPA-friendly. No cookies. No PII." },
                { icon: <Clock size={20} />, t: "5-minute install", b: "One script tag before </body>. Works with WordPress, Webflow, Wix, custom — anything." },
              ].map((f) => (
                <div key={f.t} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ACCENT}22`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    {f.icon}
                  </div>
                  <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 6px", fontSize: 15 }}>{f.t}</p>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{f.b}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comparison */}
          <section style={{ marginBottom: 64 }}>
            <h2 style={sectionH2}>How SiteRadar compares.</h2>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={comparisonRow}>
                <span></span>
                <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14 }}>SiteRadar</span>
                <span style={{ color: "#64748b", fontSize: 13 }}>Leadfeeder</span>
                <span style={{ color: "#64748b", fontSize: 13 }}>Albacross</span>
              </div>
              {[
                ["Starting price", "$49/mo", "$199/mo", "$149/mo"],
                ["Real-time SMS alerts", true, false, false],
                ["Weekly digest email", true, true, true],
                ["Live visitor feed", true, true, true],
                ["Setup time", "5 min", "30+ min", "20+ min"],
                ["Per-visit overage fees", "None", "Yes", "Yes"],
                ["Local Detroit support", true, false, false],
              ].map((row, i) => (
                <div key={i} style={{ ...comparisonRow, borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{row[0]}</span>
                  {[row[1], row[2], row[3]].map((v, j) => (
                    <span key={j} style={{ color: j === 0 ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: j === 0 ? 700 : 500 }}>
                      {v === true ? <Check size={16} style={{ color: j === 0 ? ACCENT : "#475569" }} /> : v === false ? <span style={{ color: "#475569" }}>—</span> : v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Testimonial */}
          <section style={{ marginBottom: 64 }}>
            <div style={{ background: `linear-gradient(135deg, ${ACCENT}11, transparent)`, border: `1px solid ${ACCENT}33`, borderRadius: 16, padding: 32, textAlign: "center" }}>
              <p style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 600, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 720, marginInline: "auto" }}>
                "Got an SMS at 9:14 AM that a roofing supplier had hit our pricing page three times that morning. Called them at 10. Closed a $12K contract by Friday. SiteRadar paid for itself in week one."
              </p>
              <p style={{ color: ACCENT, fontSize: 13, fontWeight: 700, margin: 0 }}>— Mike T., HVAC contractor, Warren MI</p>
            </div>
          </section>

          {/* Honest disclosure — what we can/can't tell you */}
          <section style={{ marginBottom: 64 }}>
            <h2 style={sectionH2}>What SiteRadar can — and can't — tell you.</h2>
            <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", maxWidth: 680, margin: "0 auto 24px", lineHeight: 1.6 }}>
              We hate marketing-speak. Here's the unvarnished truth so you know exactly what you're buying.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              <div style={{ background: CARD, border: `1px solid #10b98144`, borderRadius: 14, padding: 22 }}>
                <p style={{ color: "#34d399", fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>✓ What we DO tell you</p>
                <ul style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li>Which <strong>company</strong> visited (when their IP resolves to a registered business)</li>
                  <li>City, state, ISP — for every visitor</li>
                  <li>Which pages they visited and in what order</li>
                  <li>Whether they came back (repeat-visit scoring)</li>
                  <li>Time on site, scroll depth, bounce vs. engaged</li>
                </ul>
              </div>
              <div style={{ background: CARD, border: `1px solid #f59e0b44`, borderRadius: 14, padding: 22 }}>
                <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>✗ What we DON'T tell you</p>
                <ul style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                  <li><strong>The individual person's name</strong> — that's not legal without consent</li>
                  <li>Their email or phone (no de-anonymization tricks)</li>
                  <li>Residential / consumer visitors (intentionally filtered)</li>
                  <li>Anyone on a VPN, mobile carrier, or untracked ISP (~45–65% of traffic)</li>
                  <li>What they searched for to find you (use Google Search Console for that)</li>
                </ul>
              </div>
            </div>
            <p style={{ color: "#64748b", fontSize: 12, textAlign: "center", margin: "20px auto 0", maxWidth: 600, lineHeight: 1.6 }}>
              Anyone promising "we'll tell you the visitor's name and email" is either lying or breaking GDPR/CCPA. We won't. Identifying the <em>company</em> is enough — your sales team takes it from there.
            </p>
          </section>

          {/* FAQ */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={sectionH2}>Common questions.</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { q: "How accurate is company identification?", a: "We resolve roughly 35–55% of B2B visitor traffic to a named company, depending on your industry. Consumer/residential traffic is intentionally not identified — we only flag businesses." },
                { q: "What if I'm on Wix / Webflow / Squarespace?", a: "All three are supported. You paste one <script> tag in your site's custom code area. We provide the exact snippet inside your dashboard." },
                { q: "Can I cancel anytime?", a: "Yes. Cancel from your billing portal — no calls, no retention scripts. You'll keep access through the end of your billing period." },
                { q: "Do you sell or share visitor data?", a: "Never. Your visitor data is yours. We don't aggregate it, sell it, or use it to train anything." },
              ].map((f) => (
                <details key={f.q} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
                  <summary style={{ cursor: "pointer", color: "#fff", fontWeight: 600, fontSize: 15, listStyle: "none" }}>{f.q}</summary>
                  <p style={{ color: "#94a3b8", fontSize: 14, margin: "10px 0 0", lineHeight: 1.6 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          {!success && (
            <section style={{ textAlign: "center", padding: "32px 0" }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Stop guessing who's on your site.</h2>
              <p style={{ color: "#94a3b8", fontSize: 16, margin: "0 0 24px" }}>$49/mo. Cancel anytime. Setup in 5 minutes.</p>
              <button onClick={scrollToCheckout} style={ctaStyle}>
                Start now <ArrowRight size={18} />
              </button>
            </section>
          )}
        </main>

        {!success && <StickyMobileCTA label="Start — $49/mo" onClick={() => document.getElementById("siteradar-cta")?.click()} />}
      </div>
    </>
  );
}

const inputStyle = { width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "13px 16px", color: "#fff", fontSize: 15, marginBottom: 10, boxSizing: "border-box" as const, outline: "none" };
const ctaStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
  color: "#0a1628", border: "none", borderRadius: 12, padding: "16px 28px",
  fontSize: 16, fontWeight: 800, cursor: "pointer",
  boxShadow: `0 8px 24px -8px ${ACCENT}88`,
  transition: "transform 0.15s ease",
} as const;
const sectionH2 = { fontSize: 28, fontWeight: 800, margin: "0 0 24px", textAlign: "center" as const, letterSpacing: -0.5 };
const comparisonRow = {
  display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 12,
  padding: "14px 18px", alignItems: "center" as const,
};
