// /hire-alert-trial
// No-card 3-day trial signup for TechAlert.
// Tom's cold emails say "Reply YES and I'll turn on your free 3-day alerts manually."
// This page is the self-serve version for when we're ready to automate it.

import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";

const TRADE_OPTIONS = [
  "Boiler Operator",
  "HVAC Technician",
  "Plumber",
  "Pipefitter / Steamfitter",
  "Electrical Technician",
  "Industrial Mechanic",
  "Steam Engineer",
  "Refrigeration Mechanic",
];

export default function HireAlertTrial() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    business_name: "",
    target_roles: [] as string[],
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Capture utm_campaign from QR code URL for postcard attribution
  const utmCampaign = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("utm_campaign")
    : null;
  const utmSource = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("src") || new URLSearchParams(window.location.search).get("utm_source")
    : null;

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter((r) => r !== role)
        : [...f.target_roles, role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || form.target_roles.length === 0) {
      setErrorMsg("Email and at least one trade type are required.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const { error } = await supabase.functions.invoke("create-hire-alert-trial", {
        body: { ...form, utm_campaign: utmCampaign, utm_source: utmSource },
      });
      if (error) throw error;

      // Log postcard conversion (best-effort, don't block on failure)
      if (utmCampaign) {
        await supabase.from("postcard_conversions" as any).insert({
          campaign_id: utmCampaign,
          event: "trial_signup",
          email: form.email,
          county: null,
        }).then(() => {}, () => {});
      }
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>
            Your Trial Is Live
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.8, margin: "0 0 16px" }}>
            Our intelligence engine is scanning Metro Detroit for available licensed tradespeople in your trades right now.
          </p>
          <p style={{ color: "#00d4ff", fontSize: 15, margin: "0 0 32px" }}>
            Check your email for confirmation. Trial runs for 72 hours.
          </p>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Questions? Text Matt at{" "}
            <a href="tel:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", padding: "48px 24px" }}>
      <SEOHead title="Talent Radar Free Trial — Detroit Web Agency" description="Start your free 3-day Talent Radar trial. Our intelligence engine surfaces available licensed tradespeople across Metro Detroit and alerts you the moment a match appears." path="/talent-radar/trial" />
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 12px" }}>
            ⚡ Talent Radar by Detroit Web Agency
          </p>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px", lineHeight: 1.2 }}>
            3-Day Free Trial
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: 0 }}>
            No credit card. We'll scan for available licensed tradespeople in Metro Detroit
            and alert you when we find a match. Cancel anytime.
          </p>
        </div>

        {/* Form Card */}
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#00d4ff", height: 4 }} />
          <form onSubmit={handleSubmit} style={{ padding: "32px 28px" }}>

            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  YOUR NAME
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Mike Johnson"
                  style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 15, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  BUSINESS NAME
                </label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Metro HVAC Solutions"
                  style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 15, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  EMAIL <span style={{ color: "#e8621a" }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 15, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  CELL (for SMS alerts)
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#fff", fontSize: 15, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 10 }}>
                  TRADES TO MONITOR <span style={{ color: "#e8621a" }}>*</span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TRADE_OPTIONS.map((role) => {
                    const selected = form.target_roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        style={{
                          background: selected ? "#00d4ff" : "transparent",
                          color: selected ? "#0a1628" : "#94a3b8",
                          border: `1px solid ${selected ? "#00d4ff" : "#1e3a5f"}`,
                          borderRadius: 6,
                          padding: "8px 14px",
                          fontSize: 13,
                          fontWeight: selected ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {errorMsg && (
              <p style={{ color: "#ef4444", fontSize: 14, margin: "16px 0 0" }}>{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                marginTop: 28,
                width: "100%",
                background: status === "loading" ? "#1e3a5f" : "#00d4ff",
                color: status === "loading" ? "#94a3b8" : "#0a1628",
                border: "none",
                borderRadius: 8,
                padding: "15px",
                fontSize: 16,
                fontWeight: 800,
                cursor: status === "loading" ? "not-allowed" : "pointer",
              }}
            >
              {status === "loading" ? "Starting Trial..." : "Start My Free 3-Day Trial →"}
            </button>

            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 16 }}>
              No credit card required. Trial runs 72 hours. We'll email you when we find candidates.
            </p>
          </form>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: 32, padding: "20px 24px", background: "#0f2342", borderRadius: 10, border: "1px solid #1e3a5f" }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            HOW IT WORKS
          </p>
          {[
            ["🏛️", "Verified Credentials", "We confirm every candidate's licensing status the same day it changes"],
            ["🔍", "Mobility Signals", "Metro Detroit tradespeople showing signs of being open to new opportunities"],
            ["📋", "Active Availability", "Professionals actively signaling they're ready for their next role"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>{title}</p>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
