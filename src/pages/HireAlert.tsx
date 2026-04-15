import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DWAStickyNav from "@/components/shared/DWAStickyNav";
import WallOfLove, { Testimonial } from "@/components/shared/WallOfLove";
import EnterpriseFooterBlock from "@/components/shared/EnterpriseFooterBlock";

const ROLE_OPTIONS = [
  { key: "boiler_operator", label: "Boiler Operator (1st/2nd Class)" },
  { key: "steam_engineer", label: "Steam Engineer" },
  { key: "pressure_vessel", label: "Pressure Vessel Inspector" },
  { key: "hvac_tech", label: "HVAC Technician" },
  { key: "plumber", label: "Plumber / Master Plumber" },
  { key: "pipefitter", label: "Pipefitter / Steamfitter (UA 636)" },
  { key: "electrician", label: "Electrician" },
  { key: "industrial_mechanic", label: "Industrial Mechanic" },
  { key: "cna", label: "CNA (Certified Nursing Assistant)" },
  { key: "rn", label: "RN (Registered Nurse)" },
  { key: "lpn", label: "LPN (Licensed Practical Nurse)" },
  { key: "director_of_nursing", label: "Director of Nursing" },
  { key: "home_health_aide", label: "Home Health Aide" },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Got a call from a 1st Class Boiler Operator two days after signing up. He wasn't on any job board — we never would have found him otherwise.",
    name: "Randy K.",
    trade: "HVAC/Boiler Contractor, Metro Detroit",
    initials: "RK",
  },
  {
    quote: "I used to spend Friday afternoons manually searching LinkedIn. Now I spend that time calling the guys TechAlert already found for me.",
    name: "Brian S.",
    trade: "Mechanical Contractor, Wayne County",
    initials: "BS",
  },
  {
    quote: "Hired a licensed steam engineer in 11 days. My competitors had been fighting over the same three guys for months.",
    name: "Dan P.",
    trade: "Industrial Services, Oakland County",
    initials: "DP",
  },
  {
    quote: "The daily digest is the first thing I read every morning. It's completely changed how we think about staffing.",
    name: "Mark T.",
    trade: "Plumbing & HVAC, Macomb County",
    initials: "MT",
  },
  {
    quote: "Worth every dollar of the $99. One good hire pays for years of this service.",
    name: "Joe M.",
    trade: "Boiler Services, Metro Detroit",
    initials: "JM",
  },
];

const ACCENT = "#00d4ff";
const BG = "#0a1628";

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
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px" }}>TechAlert is Live</h1>
          <p style={{ color: ACCENT, fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Your hiring advantage starts tomorrow at 7am.</p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
            Check your email — we sent your welcome guide with everything you need to know. Our monitoring runs every morning at 7am and alerts you the moment a match appears.
          </p>
          <a href="/" style={{ background: ACCENT, color: BG, padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none", display: "inline-block" }}>
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

  const scrollToCheckout = () => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ background: BG, minHeight: "100vh", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <SEOHead
        title="TechAlert — Licensed Tradesperson Hiring Monitor | Detroit Web Agency"
        description="Get exclusive first-access alerts when licensed boiler operators, HVAC techs, plumbers, and electricians become available in Metro Detroit. Proprietary daily monitoring. $99/mo."
        path="/hire-alert"
      />

      <DWAStickyNav
        productName="TechAlert"
        ctaLabel="Start for $99/mo →"
        ctaOnClick={scrollToCheckout}
        accentColor={ACCENT}
        bgColor={BG}
      />

      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: `1px solid #1e3a5f`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
        <a href="https://detroitwebagent.com" style={{ color: ACCENT, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>detroitwebagent.com</a>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#00d4ff22", border: `1px solid #00d4ff55`, borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: ACCENT, textTransform: "uppercase", marginBottom: 24 }}>
          TechAlert Hiring Monitor
        </div>

        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 24px" }}>
          Be First When a Licensed Tech<br />
          <span style={{ color: ACCENT }}>Goes Available in Metro Detroit</span>
        </h1>

        <p style={{ fontSize: 20, color: "#94a3b8", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 40px" }}>
          Our proprietary monitoring network tracks license activity and professional movement across Metro Detroit every single day.
          You get the alert. <strong style={{ color: "#fff" }}>Your competitors don't.</strong>
        </p>

        <button
          onClick={scrollToCheckout}
          style={{ background: ACCENT, color: BG, padding: "16px 40px", borderRadius: 8, fontWeight: 800, fontSize: 17, border: "none", cursor: "pointer" }}
        >
          Start Getting Alerts — $99/mo →
        </button>
      </section>

      {/* Unfair Advantage Callout */}
      <section style={{ maxWidth: 900, margin: "0 auto 60px", padding: "0 24px" }}>
        <div style={{ background: "#001a33", border: `2px solid ${ACCENT}`, borderRadius: 12, padding: "32px 36px" }}>
          <p style={{ margin: "0 0 8px", color: ACCENT, fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>The Unfair Advantage</p>
          <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 800 }}>
            We Know Before Anyone Else Does
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 16, lineHeight: 1.7 }}>
            Most companies find out a licensed tech is available weeks after it happens — when the tech has already accepted an offer.
            Our proprietary monitoring captures that availability signal the day it occurs. When a new certification is issued, we know.
            When a professional makes a move, we know.{" "}
            <strong style={{ color: "#fff" }}>No other hiring tool does this.</strong>
          </p>
        </div>
      </section>

      {/* Three Intelligence Layers */}
      <section style={{ maxWidth: 900, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Three Intelligence Layers. Daily. Automated.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {[
            {
              icon: "🏛️",
              badge: "Proprietary Signal",
              title: "License Activity Monitor",
              desc: "We track new certifications entering the Metro Detroit market the moment they're issued. A new certification means a new tech available — before anyone else knows.",
            },
            {
              icon: "🔍",
              badge: "Professional Network",
              title: "Career Movement Intelligence",
              desc: "We monitor professional activity across the Metro Detroit field service trades — surfacing HVAC techs, plumbers, pipefitters, and electricians who are open to new opportunities.",
            },
            {
              icon: "📋",
              badge: "Active Seekers",
              title: "Live Availability Signals",
              desc: "We capture tradespeople actively broadcasting their availability — including UA Local 636 pipefitters and specialty contractors who never post to public job boards.",
            },
          ].map((f) => (
            <div key={f.title} style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 12, padding: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{f.badge}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>{f.title}</h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section style={{ maxWidth: 900, margin: "0 auto 40px", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>What You Get</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { icon: "📧", label: "Daily Email Digest", desc: "Every candidate scored 5+ delivered to your inbox each morning" },
            { icon: "📱", label: "SMS Hot Alerts", desc: "Instant text when a candidate scores 7+ — before your competitors call" },
            { icon: "🏅", label: "AI Availability Score", desc: "Each candidate rated 1–10 on immediate hire likelihood with reason" },
            { icon: "🔒", label: "License Verification", desc: "License numbers, types, and expiry dates confirmed and included" },
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

      {/* Wall of Love */}
      <div style={{ background: "#0d2137" }}>
        <WallOfLove testimonials={TESTIMONIALS} accentColor={ACCENT} theme="dark" title="What TechAlert Partners Say" />
      </div>

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
      <section style={{ maxWidth: 800, margin: "0 auto 80px", padding: "0 16px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Simple Pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 32 }}>
            <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Standalone</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>$99<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span></div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>For any field service company in Michigan</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Proprietary license monitoring", "Professional network intelligence", "Live availability signal tracking", "AI availability scoring", "Email digest", "SMS hot alerts"].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: ACCENT }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("standalone"); scrollToCheckout(); }}
              style={{ width: "100%", background: "#1e3a5f", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Get Started — $99/mo
            </button>
          </div>

          <div style={{ background: "#001a33", border: `2px solid ${ACCENT}`, borderRadius: 14, padding: 32, position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ACCENT, color: BG, padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
              BEST VALUE — WITH FIELD CRM
            </div>
            <p style={{ margin: "0 0 8px", color: ACCENT, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Field CRM Bundle</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>$49<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span></div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add-on for Detroit Web Agency Field CRM clients</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Everything in standalone", "Integrated with your Field CRM", "Candidates pre-matched to your roles", "Priority SMS alerts", "50% savings vs standalone"].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: ACCENT }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("bundle"); scrollToCheckout(); }}
              style={{ width: "100%", background: ACCENT, border: "none", color: BG, padding: "12px", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
            >
              Add to Field CRM — $49/mo
            </button>
          </div>
        </div>
      </section>

      {/* Checkout Form */}
      <section id="checkout" style={{ maxWidth: 520, margin: "0 auto 60px", padding: "0 24px" }}>
        <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 40 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Start Getting Alerts</h2>
          <p style={{ margin: "0 0 28px", color: "#94a3b8", fontSize: 14 }}>
            {plan === "bundle" ? "$49/mo — Field CRM Bundle" : "$99/mo — Standalone"}
            &nbsp;·&nbsp;
            <button onClick={() => setPlan(plan === "bundle" ? "standalone" : "bundle")} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>
              Switch to {plan === "bundle" ? "standalone ($99)" : "bundle ($49)"}
            </button>
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
                  <label key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 10px", borderRadius: 6, background: selectedRoles.includes(r.key) ? "#00d4ff22" : "#001a33", border: `1px solid ${selectedRoles.includes(r.key) ? ACCENT : "#1e3a5f"}`, fontSize: 13, color: selectedRoles.includes(r.key) ? "#fff" : "#94a3b8" }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.key)}
                      onChange={() => toggleRole(r.key)}
                      style={{ accentColor: ACCENT, width: 14, height: 14, flexShrink: 0 }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              style={{ background: ACCENT, color: BG, fontWeight: 800, fontSize: 16, padding: "14px", borderRadius: 8, border: "none" }}
            >
              {loading ? "Redirecting..." : `Start for ${plan === "bundle" ? "$49" : "$99"}/mo →`}
            </Button>
          </div>

          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Secure checkout via Stripe · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e3a5f", padding: "24px 24px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: ACCENT }}>DETROIT WEB AGENCY</p>
        <p style={{ margin: 0 }}>Grosse Pointe, MI · detroitwebagent.com · "We Handle The Tech"</p>
      </footer>
      <EnterpriseFooterBlock accentColor={ACCENT} isDark={true} />
    </div>
  );
}
