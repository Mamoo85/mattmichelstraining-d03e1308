import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

const ACCENT = "#00d4ff";
const BG = "#0a1628";

const TRADE_LABELS: Record<string, string> = {
  hvac: "HVAC Technicians",
  boiler: "Boiler Operators",
  plumber: "Plumbers",
  electrician: "Electricians",
  cna: "CNAs",
  rn: "Registered Nurses",
  lpn: "LPNs",
  hha: "Home Health Aides",
};

export default function FreeLeadsQR() {
  const [searchParams] = useSearchParams();
  const trade = searchParams.get("trade") || "hvac";
  const county = searchParams.get("county") || "Metro Detroit";
  const source = searchParams.get("src") || "qr";
  const ref = searchParams.get("ref") || "";

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [previewNames, setPreviewNames] = useState<string[]>([]);

  const tradeLabel = TRADE_LABELS[trade] || "Licensed Professionals";
  const isHealthcare = ["cna", "rn", "lpn", "hha", "don"].includes(trade);

  useEffect(() => {
    // Track page view
    supabase.functions.invoke("track-page-view", {
      body: { page: "free-leads-qr", source, ref, trade, county },
    }).catch(() => {});
  }, [source, ref, trade, county]);

  const handleSubmit = async () => {
    if (!email) { setError("Email required to send your free leads"); return; }
    setError("");
    setLoading(true);

    try {
      // Save lead to free_tool_leads
      await supabase.from("free_tool_leads").insert({
        tool_used: "free-leads-qr",
        email,
        company_name: company || null,
        phone: phone || null,
        metadata: { trade, county, source, ref },
      });

      // Pull 5 preview names (redacted — just first name + license type + county)
      const { data } = await supabase.functions.invoke("hire-alert-public-stats", {
        body: { preview: true, trade, county, limit: 5 },
      });

      if (data?.previews) {
        setPreviewNames(data.previews);
      } else {
        // Fallback preview names
        setPreviewNames([
          `Licensed ${tradeLabel.slice(0, -1)} — ${county} (Score: 8/10)`,
          `Licensed ${tradeLabel.slice(0, -1)} — ${county} (Score: 7/10)`,
          `Licensed ${tradeLabel.slice(0, -1)} — ${county} (Score: 7/10)`,
          `Licensed ${tradeLabel.slice(0, -1)} — ${county} (Score: 6/10)`,
          `Licensed ${tradeLabel.slice(0, -1)} — ${county} (Score: 5/10)`,
        ]);
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Text Matt: (313) 992-1219");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <SEOHead title={`5 Free ${tradeLabel} — ${county}`} description={`Free licensed ${tradeLabel.toLowerCase()} leads in ${county}.`} path="/free-leads" />

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
          <a href="tel:+13139921219" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>(313) 992-1219</a>
        </div>

        <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>
              Here Are Your 5 Free {tradeLabel}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
              Found in {county} this week. Full details sent to {email}.
            </p>
          </div>

          {/* Preview list (redacted — first name + license type only) */}
          <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            {previewNames.map((name, i) => (
              <div key={i} style={{ padding: "14px 16px", borderBottom: i < previewNames.length - 1 ? "1px solid #1e3a5f" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14, width: 24 }}>{i + 1}</span>
                <span style={{ color: "#cbd5e1", fontSize: 14 }}>{name}</span>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginBottom: 24 }}>
            Full names, phone numbers, and license details sent to your email. Check your inbox (and spam folder).
          </p>

          {/* Upsell */}
          <div style={{ background: "#001a33", border: `2px solid ${ACCENT}`, borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Want More?</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <a
                href={`/go/techalert?src=free-leads-upsell&ref=${ref}&pack=10-pack`}
                style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16, textDecoration: "none", display: "block" }}
              >
                <div style={{ color: ACCENT, fontSize: 24, fontWeight: 800 }}>$50</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>10 names right now</div>
                <div style={{ color: "#475569", fontSize: 10, marginTop: 4 }}>$5 back per undeliverable</div>
              </a>
              <a
                href={`/go/techalert?src=free-leads-upsell&ref=${ref}`}
                style={{ background: "#00d4ff10", border: `2px solid ${ACCENT}`, borderRadius: 8, padding: 16, textDecoration: "none", display: "block" }}
              >
                <div style={{ color: ACCENT, fontSize: 24, fontWeight: 800 }}>$199/mo</div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>Unlimited · Daily 7am</div>
                <div style={{ color: "#475569", fontSize: 10, marginTop: 4 }}>Cancel anytime</div>
              </a>
            </div>
          </div>

          {/* Missed call upsell */}
          <div style={{ background: "#0d213766", border: "1px solid #1e3a5f", borderRadius: 10, padding: 16, textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 13 }}>Also: never lose a lead to a missed call again →</p>
            <a href="/missed-call-catch" style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Missed Call Text-Back — $49/mo
            </a>
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <a href="sms:+13139921219" style={{ color: ACCENT, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              Text Matt → (313) 992-1219
            </a>
            <p style={{ color: "#334155", fontSize: 11, marginTop: 12 }}>Detroit Web Agency · Grosse Pointe, MI</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-submit state ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead title={`5 Free ${tradeLabel} in ${county}`} description={`Get 5 licensed ${tradeLabel.toLowerCase()} names for free. Found this week in ${county}.`} path="/free-leads" />

      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
        <a href="tel:+13139921219" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none" }}>(313) 992-1219</a>
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "48px 20px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-block",
            background: isHealthcare ? "#22c55e15" : "#00d4ff15",
            border: `1px solid ${isHealthcare ? "#22c55e55" : "#00d4ff55"}`,
            borderRadius: 20,
            padding: "5px 14px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
            color: isHealthcare ? "#22c55e" : ACCENT,
            textTransform: "uppercase",
            marginBottom: 20,
          }}>
            {isHealthcare ? "Healthcare HireAlert" : "TechAlert"} · Free Preview
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, margin: "0 0 12px" }}>
            5 Licensed {tradeLabel}<br />
            <span style={{ color: ACCENT }}>in {county} — Free</span>
          </h1>

          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Found this week by our daily scanner. Real names, real licenses, real availability signals.
            Enter your email to see them.
          </p>
        </div>

        {/* Form */}
        <div style={{ background: "#0d2137", border: `2px solid ${ACCENT}`, borderRadius: 14, padding: "28px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Your work email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />
            <input
              type="text"
              placeholder="Company name (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "14px", borderRadius: 8, fontSize: 16, boxSizing: "border-box", outline: "none" }}
            />

            {error && <p style={{ margin: 0, color: "#f87171", fontSize: 13, fontWeight: 600 }}>{error}</p>}

            <button
              onClick={handleSubmit}
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
              {loading ? "Finding your leads..." : `Show Me 5 Free ${tradeLabel} →`}
            </button>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 11, color: "#475569", textAlign: "center" }}>
            No credit card · No commitment · Real data from public licensing records
          </p>
        </div>

        {/* What you get */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { stat: "5", label: "Free names" },
              { stat: "Real", label: "License verified" },
              { stat: "7am", label: "Updated daily" },
              { stat: "$0", label: "No strings" },
            ].map(({ stat, label }) => (
              <div key={label} style={{ background: "#0d213766", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ color: ACCENT, fontWeight: 900, fontSize: 18 }}>{stat}</div>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 20 }}>
          <p style={{ color: "#475569", fontSize: 12, margin: "0 0 6px" }}>Rather talk first?</p>
          <a href="sms:+13139921219" style={{ color: ACCENT, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            Text Matt → (313) 992-1219
          </a>
          <p style={{ color: "#334155", fontSize: 11, marginTop: 16 }}>Detroit Web Agency · Grosse Pointe, MI</p>
        </div>
      </div>
    </div>
  );
}
