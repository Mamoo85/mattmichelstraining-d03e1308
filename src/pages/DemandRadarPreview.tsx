import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";

const SUPPLIER_TYPES = [
  { value: "plumbing", label: "Plumbing Supply" },
  { value: "hvac", label: "HVAC / Mechanical" },
  { value: "electrical", label: "Electrical Supply" },
  { value: "industrial", label: "Industrial / MRO" },
  { value: "roofing", label: "Roofing / Building" },
];

export default function DemandRadarPreview() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [supplier, setSupplier] = useState("industrial");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("industry-pulse-sneak-peek", {
        body: { email, company_name: company, supplier_type: supplier },
      });
      if (fnErr) throw fnErr;
      if (data?.ok) setDone(true);
      else throw new Error("Something went wrong");
    } catch (err: any) {
      setError(err?.message || "Couldn't send the sneak peek. Try again or text Matt at (313) 992-1219.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SEOHead
        title="Demand Radar Sneak Peek — 5 Free Contractor Buying Signals | Detroit Web Agency"
        description="See which Metro Detroit contractors are about to buy — permit surges, hiring patterns, new business signals. Free sample, no card."
        path="/demand-radar-preview"
      />
      <div style={{ minHeight: "100vh", background: "#030711", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <nav style={{ padding: "16px 24px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
          <a href="/industry-pulse" style={{ color: "#00d4ff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>See Pricing →</a>
        </nav>

        <section style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 40px", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.4)", borderRadius: 20, padding: "6px 18px", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#00d4ff", textTransform: "uppercase", marginBottom: 24 }}>
            Free Sneak Peek · No Card Required
          </div>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 900, lineHeight: 1.15, margin: "0 0 18px" }}>
            5 Contractors About to Buy<br />
            <span style={{ color: "#00d4ff" }}>From Your Competition</span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 17, lineHeight: 1.6, margin: "0 auto 28px", maxWidth: 580 }}>
            Real signals from this week's scan: permit surges, hiring patterns, new MI SOS registrations.
            Filtered to your supply vertical. Free — no card needed.
          </p>
        </section>

        <section style={{ maxWidth: 520, margin: "0 auto", padding: "0 24px 80px" }}>
          {done ? (
            <div style={{ background: "linear-gradient(135deg,#0a1628,#0d2137)", border: "1px solid #00d4ff40", borderRadius: 14, padding: "36px 28px", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>📬</div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>Check your inbox</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Your 5 {SUPPLIER_TYPES.find(s => s.value === supplier)?.label} signals are on the way. Check spam if you don't see it in 5 minutes.
              </p>
              <p style={{ color: "#00d4ff", fontSize: 13, marginTop: 18 }}>Want the live feed? Start a 7-day free trial from the email link.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: "28px 24px" }}>
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Your Supply Vertical *</span>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  style={{ width: "100%", padding: "13px 14px", background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 15, outline: "none" }}
                >
                  {SUPPLIER_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Business Email *</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{ width: "100%", padding: "13px 14px", background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 15, outline: "none" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 20 }}>
                <span style={{ display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Company</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ferguson, Graybar, Watsco…"
                  style={{ width: "100%", padding: "13px 14px", background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 8, color: "#fff", fontSize: 15, outline: "none" }}
                />
              </label>

              {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", padding: "15px", background: submitting ? "#1e3a5f" : "#00d4ff", color: submitting ? "#64748b" : "#0a1628", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 16, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Sending…" : "Email Me the 5 Sample Signals →"}
              </button>
              <p style={{ color: "#64748b", fontSize: 11, textAlign: "center", marginTop: 14 }}>
                No card. No subscription. 7-day free trial available from the email.
              </p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
