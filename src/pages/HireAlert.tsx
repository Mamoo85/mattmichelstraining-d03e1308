import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DWAStickyNav from "@/components/shared/DWAStickyNav";
import ReceiptStatusBanner from "@/components/checkout/ReceiptStatusBanner";
import CheckEmailCard from "@/components/checkout/CheckEmailCard";
import PostCheckoutClaim from "@/components/checkout/PostCheckoutClaim";
import StickyMobileCTA from "@/components/shared/StickyMobileCTA";
import WallOfLove, { Testimonial } from "@/components/shared/WallOfLove";
import EnterpriseFooterBlock from "@/components/shared/EnterpriseFooterBlock";
import TechAlertROICalculator from "@/components/agency/TechAlertROICalculator";
import ActionButton from "@/components/ui/action-button";
import { US_METROS, DEFAULT_METRO_ID, getMetroById, getMetroPricing, getVisibleMetros } from "@/lib/usMetros";

const ROLE_OPTIONS = [
  { key: "boiler_operator", label: "Boiler Operator (1st/2nd Class)" },
  { key: "steam_engineer", label: "Steam Engineer" },
  { key: "pressure_vessel", label: "Pressure Vessel Inspector" },
  { key: "hvac_tech", label: "HVAC Technician" },
  { key: "plumber", label: "Plumber / Master Plumber" },
  { key: "pipefitter", label: "Pipefitter / Steamfitter" },
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
    quote: "I used to spend Friday afternoons manually searching job boards. Now I spend that time calling the candidates Talent Radar already found for me.",
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
    quote: "Worth every dollar. One good hire pays for years of this service.",
    name: "Joe M.",
    trade: "Boiler Services, Metro Detroit",
    initials: "JM",
  },
];

const ACCENT = "#00d4ff";
const BG = "#0a1628";
const BETA_LIMIT = 10;

export default function HireAlert() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<"standalone" | "bundle">("standalone");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["boiler_operator", "hvac_tech"]);
  const [metroId, setMetroId] = useState<string>(DEFAULT_METRO_ID);
  const selectedMetro = getMetroById(metroId);
  const [loading, setLoading] = useState(false);
  const [slotsRemaining, setSlotsRemaining] = useState<number | null>(null);
  const [betaFull, setBetaFull] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<{ candidates: number; new_candidates: number; alerts: number } | null>(null);

  useEffect(() => {
    supabase
      .from("hire_alert_clients")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .then(({ count }) => {
        const taken = count ?? 0;
        const remaining = Math.max(0, BETA_LIMIT - taken);
        setSlotsRemaining(remaining);
        setBetaFull(remaining <= 0);
      });

    // Load scanner activity stats for social proof strip
    supabase.functions.invoke("hire-alert-public-stats", { method: "GET" as never })
      .then(({ data }) => { if (data?.ok) setWeeklyStats(data.weekly); })
      .catch(() => {});
  }, []);

  // Pricing varies by metro: TX/AZ premium markets are higher; MI baseline keeps beta lock-in.
  const metroStandalone = getMetroPricing(metroId, "standalone") / 100;
  const metroBundle = getMetroPricing(metroId, "bundle") / 100;
  const standalonePrice = metroId === "detroit" && !betaFull ? 99 : metroStandalone;
  const bundlePrice = metroId === "detroit" && !betaFull ? 49 : metroBundle;

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <ReceiptStatusBanner sessionId={searchParams.get("session_id")} productLabel="HireAlert" />
            <CheckEmailCard sessionId={searchParams.get("session_id")} />
            <PostCheckoutClaim product="HireAlert" />
          </div>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px" }}>Talent Radar is Live</h1>
          <p style={{ color: ACCENT, fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Your hiring advantage starts tomorrow at 7am.</p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
            We just emailed you your dashboard link. Save it. First candidate batch hits at 7am tomorrow.
          </p>
          <a href="https://detroitwebagent.com" style={{ background: ACCENT, color: BG, padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none", display: "inline-block" }}>
            Back to Home
          </a>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 16 }}>Questions? <a href="sms:+13139921219" style={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>Text Matt at (313) 992-1219</a></p>
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
    if (!tosAccepted) {
      toast({ title: "Please accept the Terms of Service to continue", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hire-alert-checkout", {
        body: {
          email,
          company_name: company,
          phone,
          plan,
          target_roles: selectedRoles,
          tos_accepted: true,
          target_state: selectedMetro.state,
          target_metro: selectedMetro.id,
          target_zip_prefixes: selectedMetro.zipPrefixes,
        },
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
        title="Talent Radar — Licensed Tradesperson Hiring Intelligence | Detroit Web Agency"
        description="Talent Radar surfaces licensed boiler operators, HVAC techs, plumbers, and electricians the moment they become available in Metro Detroit. Proprietary daily monitoring."
        path="/hire-alert"
      />

      <DWAStickyNav
        productName="Talent Radar"
        ctaLabel={betaFull ? "Join Waitlist — $149/mo →" : `Start for $${standalonePrice}/mo →`}
        ctaOnClick={scrollToCheckout}
        accentColor={ACCENT}
        bgColor={BG}
      />

      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: `1px solid #1e3a5f`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>DETROIT WEB AGENCY</span>
        <a href="https://detroitwebagent.com" style={{ color: ACCENT, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>detroitwebagent.com</a>
      </nav>

      {/* Scarcity Banner */}
      {slotsRemaining !== null && (
        <div style={{
          background: betaFull ? "#7f1d1d" : `linear-gradient(90deg, #00d4ff22, #00d4ff11)`,
          borderBottom: `1px solid ${betaFull ? "#dc2626" : ACCENT}`,
          padding: "12px 24px",
          textAlign: "center",
        }}>
          {betaFull ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fca5a5" }}>
              ⚠️ Beta is full (10/10 slots claimed). New subscriptions are $149/mo.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ACCENT }}>
              <span style={{
                display: "inline-block",
                width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                marginRight: 8, animation: "pulse 2s infinite",
              }} />
              Only {slotsRemaining} of {BETA_LIMIT} beta slots remaining · ${standalonePrice}/mo grandfathered forever
            </p>
          )}
        </div>
      )}

      {/* Scanner Activity Strip */}
      {weeklyStats && weeklyStats.candidates > 0 && (
        <div style={{ background: "#00d4ff0a", borderBottom: "1px solid #00d4ff1a", padding: "10px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Live — Last 7 Days</span>
            {[
              { value: weeklyStats.candidates.toLocaleString(), label: "Candidates Scanned" },
              { value: weeklyStats.new_candidates.toLocaleString(), label: "New This Week" },
              { value: weeklyStats.alerts.toLocaleString(), label: "Alerts Sent" },
            ].map(({ value, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: ACCENT, fontWeight: 900, fontSize: 16 }}>{value}</span>
                <span style={{ color: "#475569", fontSize: 12 }}>{label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#00d4ff22", border: `1px solid #00d4ff55`, borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: ACCENT, textTransform: "uppercase", marginBottom: 24 }}>
          First-Strike Talent Radar
        </div>

        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 24px" }}>
          Your Competitors Are Hiring<br />
          <span style={{ color: ACCENT }}>From the Same Shrinking Pool.</span>
        </h1>

        <p style={{ fontSize: 20, color: "#94a3b8", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 16px" }}>
          Licensed boiler operators, HVAC techs, plumbers, and electricians don't post on job boards.
          Our proprietary monitoring captures availability signals the day they happen.{" "}
          <strong style={{ color: "#fff" }}>You call first. You hire first.</strong>
        </p>

        <p style={{ fontSize: 15, color: "#f97316", fontWeight: 700, margin: "0 auto 40px", maxWidth: 600 }}>
          Limited to 3 companies per trade per county — geographic exclusivity built in.
        </p>

        <button
          onClick={scrollToCheckout}
          style={{ background: ACCENT, color: BG, padding: "16px 40px", borderRadius: 8, fontWeight: 800, fontSize: 17, border: "none", cursor: "pointer" }}
        >
          {betaFull ? `Join at $${standalonePrice}/mo →` : `Claim Beta Slot — $${standalonePrice}/mo →`}
        </button>

        <div style={{ marginTop: 18 }}>
          <a
            href="/hire-alert-trial"
            style={{ display: "inline-block", background: "transparent", color: ACCENT, padding: "12px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, border: `1px solid ${ACCENT}66`, textDecoration: "none" }}
          >
            👀 See 3 days of alerts FREE — no card →
          </a>
        </div>

        {!betaFull && slotsRemaining !== null && slotsRemaining <= 3 && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#f97316", fontWeight: 700 }}>
            🔥 {slotsRemaining} slot{slotsRemaining === 1 ? "" : "s"} left — price jumps to $149/mo when full
          </p>
        )}
      </section>

      {/* Geographic Exclusivity Callout */}
      <section style={{ maxWidth: 900, margin: "0 auto 40px", padding: "0 24px" }}>
        <div style={{ background: "linear-gradient(135deg, #001a33, #0d2137)", border: "1px solid #f9731640", borderRadius: 12, padding: "28px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 4px", color: "#f97316", fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Territory Lock</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Only 3 Per Trade Per County</h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
              We limit Talent Radar to 3 companies per trade in each county. Once Wayne County HVAC is full, it's closed. Your competitors can't buy the same intelligence.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { county: "Wayne", trade: "HVAC", status: "2 of 3" },
              { county: "Oakland", trade: "HVAC", status: "Open" },
              { county: "Macomb", trade: "Boiler", status: "1 of 3" },
              { county: "Wayne", trade: "Plumbing", status: "Open" },
            ].map((slot) => (
              <div key={`${slot.county}-${slot.trade}`} style={{ background: "#001a33", border: "1px solid #1e3a5f", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{slot.county} · {slot.trade}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: slot.status === "Open" ? "#22c55e" : "#f97316" }}>{slot.status}</div>
              </div>
            ))}
          </div>
        </div>
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
            { icon: "🏅", label: "Availability Score", desc: "Each candidate rated 1–10 on immediate hire likelihood with reason" },
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
        <WallOfLove testimonials={TESTIMONIALS} accentColor={ACCENT} theme="dark" title="What Talent Radar Partners Say" />
      </div>

      {/* Competitive Comparison — Talent Radar vs Alternatives */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
          What Hiring <span style={{ color: ACCENT }}>Actually</span> Costs
        </h2>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 15, marginBottom: 48, maxWidth: 600, margin: "0 auto 48px" }}>
          Compare Talent Radar against every other way to find licensed tradespeople.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            {
              name: "Staffing Agency",
              price: "$12K–18K",
              unit: "per hire",
              items: ["20–30% of first year salary", "No exclusivity", "Same candidates sent to 5 companies", "3–6 week lead time"],
              bad: true,
            },
            {
              name: "LinkedIn Recruiter Lite",
              price: "$170",
              unit: "/mo",
              items: ["Generic keyword search", "No license verification", "No availability scoring", "You do all the sourcing work"],
              bad: true,
            },
            {
              name: "Indeed / ZipRecruiter",
              price: "$300–500",
              unit: "/mo per posting",
              items: ["Licensed techs rarely post here", "Pay per click model adds up fast", "No proactive monitoring", "Competing with every employer"],
              bad: true,
            },
            {
              name: "Talent Radar",
              price: `$${standalonePrice}`,
              unit: "/mo",
              items: ["Proprietary license monitoring", "Daily candidate alerts + scoring", "Geographic territory exclusivity", "One hire pays for years of service"],
              bad: false,
            },
          ].map((c) => (
            <div key={c.name} style={{
              background: c.bad ? "#0d213766" : "#001a33",
              border: c.bad ? "1px solid #1e3a5f" : `2px solid ${ACCENT}`,
              borderRadius: 12,
              padding: 24,
              position: "relative",
            }}>
              {!c.bad && (
                <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: ACCENT, color: BG, padding: "3px 14px", borderRadius: 20, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                  BEST VALUE
                </div>
              )}
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: c.bad ? "#94a3b8" : "#fff" }}>{c.name}</h3>
              <div style={{ fontSize: 32, fontWeight: 800, color: c.bad ? "#ef4444" : ACCENT, margin: "0 0 2px" }}>
                {c.price}<span style={{ fontSize: 14, fontWeight: 400, color: "#64748b" }}>{c.unit}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
                {c.items.map((item) => (
                  <li key={item} style={{ padding: "4px 0", fontSize: 13, color: "#94a3b8", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: c.bad ? "#ef4444" : ACCENT, flexShrink: 0 }}>{c.bad ? "✗" : "✓"}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ROI Math */}
        <div style={{
          marginTop: 32,
          background: "linear-gradient(135deg, #00d4ff10, #00d4ff05)",
          border: `2px solid ${ACCENT}30`,
          borderRadius: 12,
          padding: "28px 32px",
          textAlign: "center",
        }}>
          <p style={{ margin: "0 0 4px", color: ACCENT, fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>The Math</p>
          <h3 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 800 }}>
            One Hire Pays for a <span style={{ color: ACCENT }}>Lifetime</span> of Talent Radar
          </h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 15, lineHeight: 1.7, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            A single licensed HVAC tech generates <strong style={{ color: "#fff" }}>$80K–120K/year</strong> in billable service revenue.
            At <strong style={{ color: "#fff" }}>${standalonePrice}/mo</strong>, Talent Radar pays for itself with your first hire —
            then keeps delivering candidates every single day.
            A staffing agency charges <strong style={{ color: "#fff" }}>$12K–18K</strong> for the same hire. Once.
          </p>
        </div>
      </section>

      {/* Interactive ROI Calculator */}
      <TechAlertROICalculator />

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
      <section id="hire-alert-pricing" style={{ maxWidth: 800, margin: "0 auto 80px", padding: "0 16px" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Simple Pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 32 }}>
            <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Standalone</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>
              ${standalonePrice}<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span>
            </div>
            {!betaFull && (
              <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>
                🔒 Beta price — grandfathered forever
              </p>
            )}
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>For any field service company in Michigan</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Proprietary license monitoring", "Professional network intelligence", "Live availability signal tracking", "Availability scoring", "Email digest", "SMS hot alerts"].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: ACCENT }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("standalone"); scrollToCheckout(); }}
              style={{ width: "100%", background: "#1e3a5f", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "12px", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              Get Started — ${standalonePrice}/mo
            </button>
          </div>

          <div style={{ background: "#001a33", border: `2px solid ${ACCENT}`, borderRadius: 14, padding: 32, position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ACCENT, color: BG, padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
              BEST VALUE — WITH FIELD CRM
            </div>
            <p style={{ margin: "0 0 8px", color: ACCENT, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Field CRM Bundle</p>
            <div style={{ fontSize: 48, fontWeight: 800, margin: "0 0 4px" }}>${bundlePrice}<span style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8" }}>/mo</span></div>
            <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add-on for Detroit Web Agency Field CRM clients</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {["Everything in standalone", "Integrated with your Field CRM", "Candidates pre-matched to your roles", "Priority SMS alerts", `Save $${standalonePrice - bundlePrice}/mo vs standalone`].map((f) => (
                <li key={f} style={{ padding: "6px 0", fontSize: 14, color: "#cbd5e1", display: "flex", gap: 8 }}>
                  <span style={{ color: ACCENT }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPlan("bundle"); scrollToCheckout(); }}
              style={{ width: "100%", background: ACCENT, border: "none", color: BG, padding: "12px", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
            >
              Add to Field CRM — ${bundlePrice}/mo
            </button>
          </div>
        </div>
      </section>

      {/* Checkout Form */}
      <section id="checkout" style={{ maxWidth: 520, margin: "0 auto 60px", padding: "0 24px" }}>
        <div style={{ background: "#0d2137", border: "1px solid #1e3a5f", borderRadius: 14, padding: 40 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
            {betaFull ? "Join Talent Radar" : "Claim Your Beta Slot"}
          </h2>
          <p style={{ margin: "0 0 28px", color: "#94a3b8", fontSize: 14 }}>
            {plan === "bundle" ? `$${bundlePrice}/mo — Field CRM Bundle` : `$${standalonePrice}/mo — Standalone`}
            &nbsp;·&nbsp;
            <button onClick={() => setPlan(plan === "bundle" ? "standalone" : "bundle")} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>
              Switch to {plan === "bundle" ? `standalone ($${standalonePrice})` : `bundle ($${bundlePrice})`}
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
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Which market? *</p>
              <select
                value={metroId}
                onChange={(e) => setMetroId(e.target.value)}
                style={{ width: "100%", background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "12px 14px", borderRadius: 6, fontSize: 14 }}
              >
                {(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("all") === "1"
                  ? getVisibleMetros(true)
                  : getVisibleMetros(false)
                ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.priorityMarket ? " ⚡" : ""}{!m.betaActive ? " (coming soon)" : ""}
                  </option>
                ))}
              </select>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: selectedMetro.coverage === "full" ? "#22c55e" : selectedMetro.coverage === "healthcare_full_trades_partial" ? "#fbbf24" : "#94a3b8", lineHeight: 1.5 }}>
                {selectedMetro.coverage === "full" ? "✓ " : selectedMetro.coverage === "healthcare_full_trades_partial" ? "⚡ " : "ℹ️ "}
                {selectedMetro.coverageLabel}
              </p>
              {metroId !== "detroit" && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: ACCENT, fontWeight: 600 }}>
                  ${metroStandalone}/mo standalone · ${metroBundle}/mo bundle
                </p>
              )}
            </div>
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Which roles do you want to monitor? *</p>
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

            {/* TOS Compliance Checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 14px", borderRadius: 8, background: tosAccepted ? "#00d4ff08" : "#001a33", border: `1px solid ${tosAccepted ? ACCENT : "#1e3a5f"}`, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                style={{ accentColor: ACCENT, width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
              />
              <span>
                I acknowledge Talent Radar data is a <strong style={{ color: "#fff" }}>B2B Market Intelligence Feed and is NOT a Consumer Report under the FCRA</strong>. I will not use it for FCRA permissible purposes (employment eligibility decisions, background screening, adverse action). Auto-dialed/pre-recorded calls or texts to listed candidates are prohibited (TCPA). Reverse-engineering or resale of the underlying data is prohibited. Violation = immediate termination + indemnification.{" "}
                <a href="/legal/techalert-terms" target="_blank" style={{ color: ACCENT, textDecoration: "underline" }}>Full Talent Radar Terms</a>
              </span>
            </label>

            {/* MSP / Enterprise inquiry CTA */}
            <div style={{ marginTop: 16, padding: "14px 16px", background: "#001a33", border: `1px dashed ${ACCENT}66`, borderRadius: 8, fontSize: 13, color: "#94a3b8" }}>
              <strong style={{ color: ACCENT }}>Staffing agency or MSP?</strong> Enterprise tier with statewide territory exclusivity, signed MSA, and direct VMS integration starts at $2,500/mo.{" "}
              <Link to="/hire-alert/enterprise" style={{ color: ACCENT, textDecoration: "underline", fontWeight: 600 }}>
                Request a discovery call →
              </Link>
            </div>

            <ActionButton
              onClick={handleCheckout}
              disabled={!tosAccepted}
              busyLabel="Redirecting…"
              ariaLabel={`Start Talent Radar — $${plan === "bundle" ? bundlePrice : standalonePrice}/mo`}
              style={{ background: tosAccepted ? ACCENT : "#334155", color: tosAccepted ? BG : "#94a3b8", padding: "14px", opacity: tosAccepted ? 1 : 0.7 }}
            >
              {betaFull
                ? `Start for $${plan === "bundle" ? bundlePrice : standalonePrice}/mo →`
                : `Claim Beta Slot — $${plan === "bundle" ? bundlePrice : standalonePrice}/mo →`}
            </ActionButton>
          </div>

          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Secure checkout via Stripe · Cancel anytime
            {!betaFull && " · Beta price locked forever"}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e3a5f", padding: "24px 24px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: ACCENT }}>DETROIT WEB AGENCY</p>
        <p style={{ margin: 0 }}>Grosse Pointe, MI · detroitwebagent.com · "We Handle The Tech"</p>
      </footer>
      <EnterpriseFooterBlock accentColor={ACCENT} isDark={true} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <StickyMobileCTA label="Start TechAlert →" onClick={handleCheckout} />
    </div>
  );
}
