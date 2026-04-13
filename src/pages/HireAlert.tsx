import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ROLE_OPTIONS = [
  { key: "boiler_operator", label: "Boiler Operator (1st/2nd Class)" },
  { key: "steam_engineer", label: "Steam Engineer" },
  { key: "pressure_vessel", label: "Pressure Vessel Inspector" },
  { key: "hvac_tech", label: "HVAC Technician" },
  { key: "plumber", label: "Plumber / Master Plumber" },
  { key: "pipefitter", label: "Pipefitter / Steamfitter (UA 636)" },
  { key: "electrician", label: "Electrician" },
  { key: "industrial_mechanic", label: "Industrial Mechanic" },
];

export default function HireAlert() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<"standalone" | "bundle">("standalone");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["boiler_operator", "hvac_tech"]);
  const [loading, setLoading] = useState(false);

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px" }}>TechAlert is Live</h1>
          <p style={{ color: "#00d4ff", fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Your hiring advantage starts tomorrow at 7am.</p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
            Check your email — we sent your welcome guide with everything you need to know. We'll scan MIOSHA, Apollo, and job boards every morning and alert you the moment a match appears.
          </p>
          <a href="/" style={{ background: "#00d4ff", color: "#0a1628", padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none", display: "inline-block" }}>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const toggleRole = (key: string) => {
    setSelectedRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  };

  const handleCheckout = async () => {
    if (!email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    if (!selectedRoles.length) {
      toast({ title: "Select at least one trade to monitor", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hire-alert-checkout", {
        body: { email, company_name: company, phone, plan, target_roles: selectedRoles },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead title="TechAlert — Licensed Tradesperson Hiring Monitor | Detroit Web Agency" description="Daily MIOSHA + Apollo + job board scans. Get instant alerts when licensed boiler operators, HVAC techs, plumbers, and electricians become available in Michigan. $49–99/mo." path="/hire-alert" />

      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
        <a href="tel:3139921219" style={{ color: "#00d4ff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>(313) 992-1219</a>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#00d4ff22", border: "1px solid #00d4ff55", borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#00d4ff", textTransform: "uppercase", marginBottom: 24 }}>
          TechAlert Hiring Monitor
        </div>

        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 24px" }}>
          Be First When a Licensed Tech<br />
          <span style={{ color: "#00d4ff" }}>Goes Available in Metro Detroit</span>
        </h1>

        <p style={{ fontSize: 20, color: "#94a3b8", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 40px" }}>
          We scan Michigan's MIOSHA public license database, Apollo, and job boards every day.
          You get the alert. <strong style={{ color: "#fff" }}>Your competitors don't.</strong>
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#checkout" style={{ background: "#00d4ff", color: "#0a1628", padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none" }}>
            Start Getting Alerts →
          </a>
          <a href="tel:3139921219" style={{ background: "transparent", border: "2px solid #00d4ff", color: "#00d4ff", padding: "14px 32px", borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
            Call Matt
          </a>
        </div>
      </section>

      {/* Secret Weapon Callout */}
      <section style={{ maxWidth: 900, margin: "0 auto 60px", padding: "0 24px" }}>
        <div style={{ background: "#001a33", border: "2px solid #00d4ff", borderRadius: 12, padding: "32px 36px" }}>
          <p style={{ margin: "0 0 8px", color: "#00d4ff", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>The Secret Weapon</p>
          <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 800 }}>
            Michigan MIOSHA Publishes Every Licensed Boiler Operator in the State
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 16, lineHeight: 1.7 }}>
            It's public record. Every licensed 1st Class Boiler Operator, 2nd Class Boiler Operator, Steam Engineer,
            and Pressure Vessel Inspector in Michigan is in that database. When a new license is issued — that's a
            newly certified tech entering the market. We check it every single day.
            <strong style={{ color: "#fff" }}> No other hiring tool does this.</strong>
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ maxWidth: 900, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Three Sources. Daily. Automated.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {[
            {
              icon: "🏛️",
              title: "MIOSHA License DB",
              sub: "Secret Weapon",
              desc: "We scrape Michigan's public boiler operator and steam engineer license registry daily. New license = new talent entering the market.",
            },
            {
              icon: "🔍",
              title: "Apollo Professional DB",
              sub: "25M+ Professionals",
              desc: "We search Apollo for HVAC techs, plumbers, pipefitters, and electricians in Metro Detroit by job title and location.",
            },
            {
              icon: "📋",
              title: "Job Board Monitoring",
              sub: "Active Seekers",
              desc: "We scan job boards and forums for tradespeople actively posting their availability — including UA Local 636 pipefitters.",
            },
          ].map((f) => (
            <div key={f.title} style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 12, padding: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ color: "#00d4ff", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{f.sub}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>{f.title}</h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section style={{ maxWidth: 900, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>What You Get</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { icon: "📧", label: "Daily Email Digest", desc: "Every candidate scored 5+ delivered to your inbox each morning" },
            { icon: "📱", label: "SMS Hot Alerts", desc: "Instant text when a candidate scores 7+ — before your competitors call" },
            { icon: "🏅", label: "AI Availability Score", desc: "Each candidate rated 1–10 on immediate hire likelihood with reason" },
            { icon: "🔒", label: "License Verification", desc: "MIOSHA license numbers, types, and expiry dates included" },
            { icon: "📍", label: "Metro Detroit Focus", desc: "Wayne, Oakland, Macomb counties — where your techs need to live" },
            { icon: "🎯", label: "Trade-Specific", desc: "Target the exact roles you need: HVAC, boiler, plumbing, electrical" },
          ].map((f) => (
            <div key={f.label} style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
              <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>{f.label}</h4>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Target Roles */}
      <section style={{ background: "#0d2137", padding: "60px 24px", marginBottom: 80 }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Trades We Monitor</h2>
          <p style={{ color: "#94a3b8", marginBottom: 32 }}>We track licensed and experienced professionals across all major field service trades in Michigan.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {["1st Class Boiler Operator", "2nd Class Boiler Operator", "Steam Engineer", "Pressure Vessel Inspector", "HVAC Technician", "Plumber", "Master Plumber", "Pipefitter", "Steamfitter (UA 636)", "Electrician", "Industrial Mechanic", "Refrigeration Tech"].map((role) => (
              <span key={role} style={{ background: "#001a33", border: "1px solid #1e3a5f", borderRadius: 20, padding: "6px 14px", fontSize: 13, color: "#94a3b8" }}>{role}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 800, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Simple Pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {/* Standalone */}
          <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 32 }}>
            <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Standalone</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>$99<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span></div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>For any field service company in Michigan</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Daily MIOSHA license scan", "Apollo professional search", "Job board monitoring", "AI availability scoring", "Email digest", "SMS hot alerts"].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: "#00d4ff" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("standalone"); document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ width: "100%", background: "#1e3a5f", border: "1px solid #00d4ff", color: "#00d4ff", padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Get Started — $99/mo
            </button>
          </div>

          {/* Bundle */}
          <div style={{ background: "#001a33", border: "2px solid #00d4ff", borderRadius: 14, padding: 32, position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#00d4ff", color: "#0a1628", padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
              BEST VALUE — WITH FIELD CRM
            </div>
            <p style={{ margin: "0 0 8px", color: "#00d4ff", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Field CRM Bundle</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>$49<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span></div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add-on for Detroit Web Agency Field CRM clients</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Everything in standalone", "Integrated with your Field CRM", "Candidates pre-matched to your roles", "Priority SMS alerts", "50% savings vs standalone"].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: "#00d4ff" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("bundle"); document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ width: "100%", background: "#00d4ff", border: "none", color: "#0a1628", padding: "12px", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
            >
              Add to Field CRM — $49/mo
            </button>
          </div>
        </div>
      </section>

      {/* Checkout Form */}
      <section id="checkout" style={{ maxWidth: 520, margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 40 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Start Getting Alerts</h2>
          <p style={{ margin: "0 0 28px", color: "#94a3b8", fontSize: 14 }}>
            {plan === "bundle" ? "$49/mo — Field CRM Bundle" : "$99/mo — Standalone"}
            &nbsp;·&nbsp;<button onClick={() => setPlan(plan === "bundle" ? "standalone" : "bundle")} style={{ background: "none", border: "none", color: "#00d4ff", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>Switch to {plan === "bundle" ? "standalone ($99)" : "bundle ($49)"}</button>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input
              type="email"
              placeholder="Your email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "12px 14px" }}
            />
            <Input
              type="text"
              placeholder="Company name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "12px 14px" }}
            />
            <Input
              type="tel"
              placeholder="Phone (for SMS alerts)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "12px 14px" }}
            />
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Which trades do you want to monitor? *</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ROLE_OPTIONS.map((r) => (
                  <label key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 10px", borderRadius: 6, background: selectedRoles.includes(r.key) ? "#00d4ff22" : "#001a33", border: `1px solid ${selectedRoles.includes(r.key) ? "#00d4ff" : "#1e3a5f"}`, fontSize: 13, color: selectedRoles.includes(r.key) ? "#fff" : "#94a3b8" }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.key)}
                      onChange={() => toggleRole(r.key)}
                      style={{ accentColor: "#00d4ff", width: 14, height: 14, flexShrink: 0 }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              style={{ background: "#00d4ff", color: "#0a1628", fontWeight: 800, fontSize: 16, padding: "14px", borderRadius: 8, border: "none" }}
            >
              {loading ? "Redirecting..." : `Start for ${plan === "bundle" ? "$49" : "$99"}/mo →`}
            </Button>
          </div>

          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Secure checkout via Stripe · Cancel anytime · Or call Matt: (313) 992-1219
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e3a5f", padding: "32px 24px", textAlign: "center", color: "#475569", fontSize: 13 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#00d4ff" }}>DETROIT WEB AGENCY</p>
        <p style={{ margin: 0 }}>Grosse Pointe, MI · (313) 992-1219 · detroitwebagent.com · "We Handle The Tech"</p>
      </footer>

    </div>
  );
}
