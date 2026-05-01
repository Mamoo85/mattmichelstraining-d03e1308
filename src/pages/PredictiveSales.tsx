import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import {
  INDUSTRIES,
  PRODUCTS,
  getProductsForIndustry,
  getPredictiveFamily,
  type Industry,
} from "@/data/productCatalog";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

export default function PredictiveSales() {
  const [industry, setIndustry] = useState<Industry>("Boiler Service");
  const family = useMemo(() => getPredictiveFamily(), []);
  const { recommended, excluded } = useMemo(
    () => getProductsForIndustry(industry),
    [industry],
  );

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        color: "#e2e8f0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <SEOHead
        title="Predictive Sales by Detroit Web Agency — Know Who's Buying Before They Call"
        description="One umbrella, five signal feeds: live RFPs, companies in buying mode, market trend maps, who's on your site right now, and predictive hiring. Pick your industry to see what fits."
      />

      <header style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 24px" }}>
        <p
          style={{
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          Predictive Sales · Detroit Web Agency
        </p>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            lineHeight: 1.15,
            margin: "0 0 16px",
            maxWidth: 880,
          }}
        >
          Know who's buying <span style={{ color: ACCENT }}>before they call you.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 17, lineHeight: 1.7, maxWidth: 760, margin: 0 }}>
          Predictive Sales is one umbrella for five signal feeds — live RFPs, companies showing
          buying intent, sub-segment trend maps, real-time site visitor identification, and
          license-gated talent radar. We tell you exactly what fits your industry. No upsell, no
          fluff.
        </p>
      </header>

      {/* Decision matrix */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div
          style={{
            background: "#0d1f3c",
            border: `1px solid ${ACCENT}30`,
            borderRadius: 14,
            padding: "28px 28px 32px",
          }}
        >
          <p
            style={{
              color: ACCENT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Industry decision matrix
          </p>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px", color: "#fff" }}>
            What fits your shop?
          </h2>

          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Pick your industry
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value as Industry)}
            style={{
              width: "100%",
              maxWidth: 360,
              background: "#0a1628",
              color: "#fff",
              border: `1px solid ${ACCENT}50`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#34d399",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  margin: "0 0 12px",
                }}
              >
                ✓ Recommended for {industry}
              </h3>
              {recommended.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 14 }}>
                  No Predictive Sales products fit this industry yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {recommended.map((p) => (
                    <Link
                      key={p.slug}
                      to={p.route}
                      style={{
                        display: "block",
                        background: "#0a1628",
                        border: "1px solid #1e3a5f",
                        borderRadius: 10,
                        padding: "14px 18px",
                        textDecoration: "none",
                        color: "#e2e8f0",
                        transition: "border-color 120ms",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 12,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                          {p.umbrellaName}
                        </span>
                        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
                          ${p.monthlyPrice}/mo
                        </span>
                      </div>
                      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                        {p.tagline}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {excluded.length > 0 && (
              <div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    margin: "0 0 8px",
                  }}
                >
                  Honestly not for you
                </h3>
                <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>
                  We hide these from {industry} owners. We'd rather under-sell than waste your money.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {excluded.map((p) => (
                    <span
                      key={p.slug}
                      style={{
                        background: "#0a1628",
                        border: "1px dashed #1e3a5f",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {p.legacyName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Full family */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", color: "#fff" }}>
          The full Predictive Sales family
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {family.map((p) => (
            <Link
              key={p.slug}
              to={p.route}
              style={{
                background: "#0d1f3c",
                border: "1px solid #1e3a5f",
                borderRadius: 12,
                padding: "20px 20px 22px",
                textDecoration: "none",
                color: "#e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{p.legacyName}</span>
                <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13 }}>${p.monthlyPrice}/mo</span>
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{p.tagline}</p>
              <span style={{ fontSize: 11, color: ACCENT, marginTop: "auto" }}>
                Branded as: {p.umbrellaName} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Forever pricing tie-in */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${ACCENT}15, transparent)`,
            border: `1px solid ${ACCENT}40`,
            borderRadius: 14,
            padding: "28px 32px",
            textAlign: "center",
          }}
        >
          <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: "0 0 8px" }}>
            FOREVER PRICING
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            Lock today's price. Every future upgrade is free. Forever.
          </p>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px", maxWidth: 580, marginLeft: "auto", marginRight: "auto" }}>
            We push improvements every single day. You're not buying a snapshot — you're buying the cutting edge for life.
          </p>
          <Link
            to="/changelog"
            style={{
              display: "inline-block",
              color: ACCENT,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: 2,
            }}
          >
            See what we shipped this month →
          </Link>
        </div>
      </section>
    </div>
  );
}
