import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const STAGES = [
  {
    label: "Day 0 — Discovery",
    body: "We pull a snapshot of your eWay export (customers, projects, contacts, recent jobs). Nothing in eWay is touched.",
  },
  {
    label: "Day 1–3 — Mirror",
    body: "FieldDesk gets seeded with your data. Your office still works in eWay. Your techs start using FieldDesk for new jobs only.",
  },
  {
    label: "Week 1–4 — Dual-run",
    body: "Both systems are live. We watch for drift, fix any field-mapping issues, train your team. Your call when to flip the office over.",
  },
  {
    label: "Cutover",
    body: "Office closes eWay. FieldDesk becomes system of record. eWay export is archived for legal/compliance retention.",
  },
];

export default function FieldDeskMigration() {
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [techCount, setTechCount] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; message: string }>(null);

  async function startImport(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "fielddesk-import-eway",
        {
          body: {
            org_name: orgName,
            contact_email: contactEmail,
            tech_count: techCount,
            mode: "discovery",
          },
        },
      );
      if (error) throw error;
      setResult({
        ok: true,
        message:
          (data as { message?: string })?.message ??
          "Got it — we'll be in touch within one business day to schedule discovery.",
      });
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please email matt@detroitwebagent.com.",
      });
    } finally {
      setSubmitting(false);
    }
  }

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
        title="FieldDesk Migration Path from eWay CRM | Detroit Web Agency"
        description="Move from eWay CRM to FieldDesk on your timeline. Dual-run period, full data import, zero downtime. We've done this before."
      />

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px" }}>
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
          FieldDesk Migration Path
        </p>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            lineHeight: 1.2,
            margin: "0 0 18px",
          }}
        >
          Move off eWay.{" "}
          <span style={{ color: ACCENT }}>On your timeline.</span>
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 36px" }}>
          You don't need to rip the band-aid. We mirror your eWay data into FieldDesk,
          run both systems in parallel for as long as you want, and only flip your
          office when you're ready. Most shops dual-run 2–4 weeks.
        </p>

        <div style={{ display: "grid", gap: 12, marginBottom: 36 }}>
          {STAGES.map((s, i) => (
            <div
              key={i}
              style={{
                background: "#0d1f3c",
                border: "1px solid #1e3a5f",
                borderRadius: 12,
                padding: "18px 22px",
              }}
            >
              <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 6px" }}>
                {s.label}
              </p>
              <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <form
          onSubmit={startImport}
          style={{
            background: "#0d1f3c",
            border: `1px solid ${ACCENT}30`,
            borderRadius: 14,
            padding: "28px 28px",
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
            Start a discovery call
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 20px" }}>
            We'll reach out within one business day. Nothing is changed in eWay.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              required
              type="text"
              placeholder="Company name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={inputStyle}
            />
            <input
              required
              type="email"
              placeholder="Your email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              required
              type="number"
              min={1}
              placeholder="Number of techs"
              value={techCount}
              onChange={(e) => setTechCount(parseInt(e.target.value, 10) || 1)}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: ACCENT,
                color: "#0a1628",
                fontWeight: 800,
                fontSize: 15,
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Request migration discovery"}
            </button>
          </div>

          {result && (
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                color: result.ok ? "#34d399" : "#f87171",
              }}
            >
              {result.message}
            </p>
          )}
        </form>

        <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 8 }}>
          Not sure yet? Keep eWay and add our Marketing Layer instead.
        </p>
        <div style={{ textAlign: "center" }}>
          <Link
            to="/marketing-layer-for-eway"
            style={{
              color: ACCENT,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: 2,
            }}
          >
            See the Marketing Layer for eWay →
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  borderRadius: 8,
  color: "#fff",
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "inherit",
};
