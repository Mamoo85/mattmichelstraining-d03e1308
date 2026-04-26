import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PostCheckoutClaim from "@/components/checkout/PostCheckoutClaim";
import StickyMobileCTA from "@/components/shared/StickyMobileCTA";

export default function SiteRadarLanding() {
  const [params] = useSearchParams();
  const success = params.get("success") === "1" || params.get("status") === "success";
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startCheckout = async () => {
    if (!email || !businessName) { setError("Email and business name required"); return; }
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

  return (
    <>
      <Helmet>
        <title>SiteRadar — See Who's Visiting Your Website | Detroit Web Agency</title>
        <meta name="description" content="Identify the businesses visiting your site in real time. $49/mo. Setup in under 5 minutes." />
      </Helmet>
      <div style={{ minHeight: "100vh", background: "#030711", fontFamily: "-apple-system,sans-serif", color: "#fff" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 16px 120px" }}>
          <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 12px" }}>📡 SITE RADAR</p>
          <h1 style={{ fontSize: 40, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.1 }}>
            See <span style={{ color: "#00d4ff" }}>which businesses</span> visit your website.
          </h1>
          <p style={{ fontSize: 17, color: "#94a3b8", margin: "0 0 28px", lineHeight: 1.5 }}>
            Real-time visitor identification. Know who's evaluating you — before they fill out the form.
          </p>

          {success ? (
            <PostCheckoutClaim product="SiteRadar" />
          ) : (
            <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" type="email" style={inputStyle} />
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" style={inputStyle} />
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" style={inputStyle} />
              <button id="siteradar-cta" onClick={startCheckout} disabled={loading} style={{ width: "100%", background: "linear-gradient(135deg,#00d4ff,#0099cc)", color: "#0a1628", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 800, cursor: "pointer", marginTop: 8 }}>
                {loading ? "Loading…" : "Start — $49/mo"}
              </button>
              {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</p>}
              <p style={{ color: "#64748b", fontSize: 11, textAlign: "center", margin: "12px 0 0" }}>Cancel anytime · Setup in under 5 minutes</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            {[
              { t: "Real-time identification", b: "See company names, cities, and pages — the moment they hit your site." },
              { t: "High-intent alerts", b: "We text you when someone hits /pricing or /contact, and when a company visits 3+ times in a week." },
              { t: "Weekly digest", b: "Every Monday at 7am, a clean summary of who showed up." },
            ].map((f) => (
              <div key={f.t} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 12, padding: 18 }}>
                <p style={{ color: "#00d4ff", fontWeight: 700, margin: "0 0 4px" }}>{f.t}</p>
                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{f.b}</p>
              </div>
            ))}
          </div>
        </div>
        {!success && <StickyMobileCTA label="Start — $49/mo" onClick={() => document.getElementById("siteradar-cta")?.click()} />}
      </div>
    </>
  );
}

const inputStyle = { width: "100%", background: "#030711", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 14, marginBottom: 10, boxSizing: "border-box" as const };
