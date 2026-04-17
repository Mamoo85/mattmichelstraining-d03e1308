import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

const ACCENT = "#00d4ff";
const BG = "#0a1628";

export default function GoTechAlert() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("src") || "supply-house";
  const ref = searchParams.get("ref") || "";
  const isSuccess = searchParams.get("success") === "1";
  const cityParam = searchParams.get("city") || "";

  // City-aware content
  const CITY_CONFIG: Record<string, { name: string; region: string; trades: string; healthcare: string }> = {
    detroit: { name: "Metro Detroit", region: "Wayne, Oakland & Macomb counties", trades: "HVAC techs, boiler operators, master plumbers, and electricians", healthcare: "CNAs, LPNs, and RNs" },
    "grand-rapids": { name: "Grand Rapids", region: "Kent & Ottawa counties", trades: "HVAC installers, electricians, and plumbers", healthcare: "CNAs and RNs" },
    lansing: { name: "Lansing", region: "Ingham & Eaton counties", trades: "HVAC techs, plumbers, and electricians", healthcare: "CNAs and LPNs" },
    "ann-arbor": { name: "Ann Arbor", region: "Washtenaw County", trades: "HVAC techs, electricians, and plumbers", healthcare: "RNs and CNAs" },
    flint: { name: "Flint", region: "Genesee County", trades: "plumbers, HVAC techs, and electricians", healthcare: "CNAs, LPNs, and RNs" },
    kalamazoo: { name: "Kalamazoo", region: "Kalamazoo County", trades: "HVAC techs, electricians, and welders", healthcare: "CNAs and RNs" },
    "traverse-city": { name: "Traverse City", region: "Grand Traverse County", trades: "HVAC techs and plumbers", healthcare: "RNs, CNAs, and LPNs" },
    saginaw: { name: "Saginaw / Bay City", region: "Saginaw, Bay & Midland counties", trades: "boiler operators, HVAC techs, and electricians", healthcare: "CNAs and RNs" },
    muskegon: { name: "Muskegon", region: "Muskegon County", trades: "HVAC techs, plumbers, and welders", healthcare: "CNAs and RNs" },
  };
  const city = CITY_CONFIG[cityParam.toLowerCase()] || CITY_CONFIG.detroit;
  const cityLabel = city.name;

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [weeklyStats, setWeeklyStats] = useState<{ candidates: number; new_candidates: number; alerts: number } | null>(null);
  const [slotsRemaining, setSlotsRemaining] = useState<number | null>(null);
  const [betaFull, setBetaFull] = useState(false);

  useEffect(() => {
    // Track QR scan
    supabase.functions.invoke("track-page-view", {
      body: { page: "go-techalert", source, ref },
    }).catch(() => {});

    // Load beta slots
    supabase
      .from("hire_alert_clients")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .then(({ count }) => {
        const taken = count ?? 0;
        const remaining = Math.max(0, 10 - taken);
        setSlotsRemaining(remaining);
        setBetaFull(remaining <= 0);
      });

    // Load scanner stats
    supabase.functions.invoke("hire-alert-public-stats", { method: "GET" as never })
      .then(({ data }) => { if (data?.ok) setWeeklyStats(data.weekly); })
      .catch(() => {});
  }, [source, ref]);

  const price = betaFull ? 149 : 99;

  const handleCheckout = async () => {
    if (!email) { setError("Email required"); return; }
    setError("");
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-hire-alert-checkout", {
        body: {
          email,
          company_name: company,
          phone,
          plan: "standalone",
          target_roles: ["boiler_operator", "hvac_tech", "plumber", "electrician"],
          tos_accepted: true,
          source: `qr-${source}`,
          ref,
        },
      });
      if (fnError || !data?.url) throw new Error(fnError?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>You're In.</h1>
          <p style={{ color: ACCENT, fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>TechAlert starts scanning tomorrow at 7am.</p>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
            Check your email for your welcome guide. You'll get your first candidate alert within 24–48 hours.
          </p>
          <a href="sms:+13139921219" style={{ display: "inline-block", marginTop: 24, color: ACCENT, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            Questions? Text Matt → (313) 992-1219
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title={`TechAlert — Find Licensed Techs in ${cityLabel} Before Your Competitors`}
        description={`Exclusive hiring intelligence for ${cityLabel} contractors. Licensed ${city.trades} found daily.`}
        path="/go/techalert"
      />

      {/* Compact header */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
        <a href="tel:+13139921219" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>(313) 992-1219</a>
      </div>

      {/* Live stats bar */}
      {weeklyStats && weeklyStats.candidates > 0 && (
        <div style={{ background: "#00d4ff08", borderBottom: "1px solid #00d4ff15", padding: "8px 20px", textAlign: "center" }}>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Scanner Live · Last 7 Days: </span>
          <span style={{ color: ACCENT, fontWeight: 900, fontSize: 14 }}>{weeklyStats.candidates.toLocaleString()}</span>
          <span style={{ color: "#475569", fontSize: 11 }}> candidates found · </span>
          <span style={{ color: ACCENT, fontWeight: 900, fontSize: 14 }}>{weeklyStats.new_candidates.toLocaleString()}</span>
          <span style={{ color: "#475569", fontSize: 11 }}> new this week</span>
        </div>
      )}

      {/* Hero — ultra-compact, mobile-first */}
      <div style={{ padding: "40px 20px 24px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          display: "inline-block",
          background: betaFull ? "#7f1d1d" : "#00d4ff15",
          border: `1px solid ${betaFull ? "#dc2626" : "#00d4ff55"}`,
          borderRadius: 20,
          padding: "5px 14px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.5,
          color: betaFull ? "#fca5a5" : ACCENT,
          textTransform: "uppercase",
          marginBottom: 20,
        }}>
          {betaFull ? "Beta Full — $149/mo" : slotsRemaining !== null ? `${slotsRemaining} Beta Slots Left — $99/mo` : "TechAlert"}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, margin: "0 0 12px" }}>
          Find Licensed Techs<br />
          <span style={{ color: ACCENT }}>in {cityLabel}</span><br />
          Before Your Competitors
        </h1>

        <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, margin: "0 0 6px" }}>
          Daily alerts when boiler operators, HVAC techs, plumbers & electricians become available in Metro Detroit.
        </p>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>
          One good hire pays for years of this service.
        </p>
      </div>

      {/* Checkout form — the whole point */}
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px 40px" }}>
        <div style={{ background: "#0d2137", border: `2px solid ${ACCENT}`, borderRadius: 14, padding: "28px 24px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>
            {betaFull ? "Start TechAlert" : "Claim Your Beta Slot"}
          </h2>
          <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 13 }}>
            ${price}/mo · Cancel anytime{!betaFull && " · Beta price locked forever"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Your email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px 14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />
            <input
              type="text"
              placeholder="Company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px 14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />
            <input
              type="tel"
              placeholder="Phone (for SMS alerts)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px 14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />

            {error && (
              <p style={{ margin: 0, color: "#f87171", fontSize: 13, fontWeight: 600 }}>{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{
                width: "100%",
                background: ACCENT,
                color: BG,
                fontWeight: 800,
                fontSize: 17,
                padding: "16px",
                borderRadius: 8,
                border: "none",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Redirecting to Stripe..." : betaFull ? `Start for $${price}/mo →` : `Claim Beta Slot — $${price}/mo →`}
            </button>
          </div>

          <p style={{ margin: "14px 0 0", fontSize: 11, color: "#475569", textAlign: "center" }}>
            Secure checkout via Stripe · All major trades monitored · Cancel anytime
          </p>
        </div>

        {/* On-demand a la carte option */}
        <div style={{ marginTop: 16, background: "#0d213766", border: "1px solid #f97316", borderRadius: 12, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#f97316" }}>
            Just need names right now?
          </h3>
          <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: 13 }}>
            One-time purchase. No subscription. $5 refund per name we can't deliver.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={async () => {
                if (!email) { setError("Enter your email above first"); return; }
                setLoading(true);
                try {
                  const { data, error: fnError } = await supabase.functions.invoke("create-hirealert-ondemand", {
                    body: { email, company_name: company, phone, pack: "10-pack", source: `qr-${source}`, ref },
                  });
                  if (fnError || !data?.url) throw new Error(fnError?.message || "Checkout failed");
                  window.location.href = data.url;
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Something went wrong");
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ background: "#f97316", color: "#fff", fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 8, border: "none", cursor: "pointer" }}
            >
              10 Names — $50
            </button>
            <button
              onClick={async () => {
                if (!email) { setError("Enter your email above first"); return; }
                setLoading(true);
                try {
                  const { data, error: fnError } = await supabase.functions.invoke("create-hirealert-ondemand", {
                    body: { email, company_name: company, phone, pack: "5-pack", source: `qr-${source}`, ref },
                  });
                  if (fnError || !data?.url) throw new Error(fnError?.message || "Checkout failed");
                  window.location.href = data.url;
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Something went wrong");
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ background: "transparent", color: "#f97316", fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 8, border: "2px solid #f97316", cursor: "pointer" }}
            >
              5 Names — $25
            </button>
          </div>
        </div>

        {/* Free leads option */}
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a href={`/free-leads?trade=hvac&county=Metro+Detroit&src=${source}&ref=${ref}`} style={{ color: "#22c55e", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            Or get 5 names FREE → just enter your email
          </a>
        </div>

        {/* Social proof strip */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { stat: "2 days", label: "Avg. time to first candidate" },
            { stat: "7am daily", label: "Automated scanner runs" },
            { stat: "$0", label: "Setup fee" },
            { stat: "11 days", label: "Fastest hire on record" },
          ].map(({ stat, label }) => (
            <div key={label} style={{ background: "#0d213766", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ color: ACCENT, fontWeight: 900, fontSize: 18 }}>{stat}</div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Quick testimonial */}
        <div style={{ marginTop: 24, background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, fontStyle: "italic" }}>
            "Got a call from a 1st Class Boiler Operator two days after signing up. He wasn't on any job board — we never would have found him otherwise."
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
            — Randy K., HVAC/Boiler Contractor, Metro Detroit
          </p>
        </div>

        {/* What we monitor */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Trades We Monitor</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {["Boiler Operators", "HVAC Techs", "Plumbers", "Electricians", "Pipefitters", "Steam Engineers", "CNAs", "RNs"].map((t) => (
              <span key={t} style={{ background: "#001a33", border: "1px solid #1e3a5f", borderRadius: 16, padding: "4px 10px", fontSize: 11, color: "#94a3b8" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: 32, textAlign: "center", paddingBottom: 20 }}>
          <p style={{ color: "#475569", fontSize: 12, margin: "0 0 6px" }}>Rather talk first?</p>
          <a href="sms:+13139921219" style={{ color: ACCENT, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            Text Matt → (313) 992-1219
          </a>
          <p style={{ color: "#334155", fontSize: 11, marginTop: 16 }}>
            Detroit Web Agency · Grosse Pointe, MI · detroitwebagent.com
          </p>
        </div>
      </div>
    </div>
  );
}
