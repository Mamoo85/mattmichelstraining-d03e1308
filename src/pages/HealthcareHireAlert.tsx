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
import { CheckCircle, Shield, Clock, Users, Zap, DollarSign } from "lucide-react";
import PostCheckoutClaim from "@/components/checkout/PostCheckoutClaim";

const HEALTHCARE_ROLES = [
  { key: "cna", label: "CNA (Certified Nursing Assistant)" },
  { key: "rn", label: "RN (Registered Nurse)" },
  { key: "lpn", label: "LPN (Licensed Practical Nurse)" },
  { key: "director_of_nursing", label: "Director of Nursing" },
  { key: "home_health_aide", label: "Home Health Aide" },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "We were paying a staffing agency $82/hour for CNAs. Talent Radar texted us a newly licensed CNA in our county — hired her at $22/hour. This service paid for itself in a single shift.",
    name: "Karen M.",
    trade: "Director of Nursing, Oakland County",
    initials: "KM",
  },
  {
    quote: "Three RNs in two months. All from license board alerts before they even posted on Indeed. Our staffing agency costs dropped 40%.",
    name: "David R.",
    trade: "Administrator, Skilled Nursing Facility",
    initials: "DR",
  },
  {
    quote: "I get a text at 7am every time a new CNA clears their license in Wayne County. It's like having a recruiter that never sleeps.",
    name: "Lisa T.",
    trade: "HR Director, Senior Living Community",
    initials: "LT",
  },
  {
    quote: "We canceled our $4,000/month staffing contract. This $99 service finds us the same candidates — we just reach them first.",
    name: "James W.",
    trade: "Owner, Home Health Agency",
    initials: "JW",
  },
];

const ACCENT = "#00d4ff";
const BG = "#0a1628";
const CARD_BG = "#0d1b2e";

export default function HealthcareHireAlert() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["cna", "rn"]);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>
            <PostCheckoutClaim product="Talent Radar Healthcare" />
          </div>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🏥</div>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px" }}>Talent Radar Healthcare is Live</h1>
          <p style={{ color: ACCENT, fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Your staffing advantage starts tomorrow at 7am.</p>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
            Check your email — we sent your welcome guide. Our Licensing Monitor scans professional licensing records every morning at 7am and texts you the moment a new CNA, RN, or LPN clears their license in your area.
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
      toast({ title: "Select at least one role to monitor", variant: "destructive" });
      return;
    }
    if (!tosAccepted) {
      toast({ title: "Please accept the compliance terms to continue", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hire-alert-checkout", {
        body: {
          email,
          company_name: company,
          phone,
          plan: "standalone",
          target_roles: selectedRoles,
          tos_accepted: true,
          source_page: "healthcare",
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Talent Radar Healthcare — CNA / RN / LPN Hiring Intelligence"
        description="Get texted the moment a new CNA, RN, or LPN clears their state license in your county. Hire directly — skip the $80/hr staffing agency markup."
      />
      <DWAStickyNav ctaLabel="Start Monitoring" ctaHref="#signup" />

      {/* Hero */}
      <section style={{ background: BG, padding: "100px 24px 60px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#10b98115", border: "1px solid #10b98130", borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <Shield size={14} style={{ color: "#10b981" }} />
            <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}>Automated Licensing Monitor — No Staffing Agency Required</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px" }}>
            Stop Paying <span style={{ color: "#ef4444" }}>$80/hr</span> to Staffing Agencies
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 18, lineHeight: 1.7, maxWidth: 600, margin: "0 auto 32px" }}>
            Our proprietary Licensing Monitor surfaces newly credentialed local talent daily. We text you the moment a Metro Detroit CNA or RN becomes available — <strong style={{ color: "#fff" }}>hire them directly before the agencies grab them.</strong>
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <a href="#signup" style={{ background: ACCENT, color: BG, padding: "16px 36px", borderRadius: 8, fontWeight: 800, fontSize: 18, textDecoration: "none" }}>
              Start Monitoring — $99/mo
            </a>
            <span style={{ color: "#94a3b8", fontSize: 14 }}>Cancel anytime • No contracts</span>
          </div>
        </div>
      </section>

      {/* The Math */}
      <section style={{ background: "#0d1b2e", padding: "60px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", margin: "0 0 40px" }}>
            The Math Doesn't Lie
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
            {[
              { icon: <DollarSign size={24} />, title: "Staffing Agency", cost: "$82/hr", detail: "Average CNA agency rate in Metro Detroit. One 8-hour shift = $656.", color: "#ef4444" },
              { icon: <Users size={24} />, title: "Direct Hire via Talent Radar", cost: "$22/hr", detail: "Average CNA direct-hire rate. Same shift = $176. You save $480/day.", color: "#10b981" },
              { icon: <Zap size={24} />, title: "Annual Savings", cost: "$124K+", detail: "Replace just ONE agency CNA position and save $124,800/year.", color: ACCENT },
            ].map(({ icon, title, cost, detail, color }) => (
              <div key={title} style={{ background: BG, border: `1px solid ${color}25`, borderRadius: 16, padding: 28 }}>
                <div style={{ color, marginBottom: 12 }}>{icon}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                <div style={{ color: "#fff", fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{cost}</div>
                <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ background: BG, padding: "60px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", margin: "0 0 40px" }}>
            How the Licensing Monitor Works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {[
              { step: "1", title: "We Scan Licensing Records Daily", desc: "Every morning at 7am, our Automated Ingestion Engine ingests the latest licensing data from Michigan's professional licensing authority — CNAs, RNs, LPNs, and more." },
              { step: "2", title: "New Licenses Are Flagged Instantly", desc: "When a new healthcare professional clears their license in your county, our system scores them on availability signals — job boards, professional networks, and license type." },
              { step: "3", title: "You Get a Text Before Anyone Else", desc: "High-scoring candidates trigger an immediate SMS + email alert with their name, license type, city, and contact info. You call them before the agencies even know they exist." },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${ACCENT}15`, border: `2px solid ${ACCENT}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: ACCENT, fontWeight: 900, fontSize: 20 }}>{step}</span>
                </div>
                <div>
                  <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>{title}</h3>
                  <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wall of Love */}
      <section style={{ background: CARD_BG, padding: "60px 24px" }}>
        <WallOfLove testimonials={TESTIMONIALS} title="Trusted by Healthcare Administrators Across Metro Detroit" />
      </section>

      {/* Signup Form */}
      <section id="signup" style={{ background: BG, padding: "80px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>
            Start Your Healthcare Staffing Monitor
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", margin: "0 0 32px" }}>
            $99/mo • Cancel anytime • Alerts start tomorrow at 7am
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              type="email"
              placeholder="Your email address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <Input
              placeholder="Facility / Organization Name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <Input
              placeholder="Phone (for SMS alerts)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />

            {/* Role selector */}
            <div>
              <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Which roles do you need to fill?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {HEALTHCARE_ROLES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleRole(key)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1px solid ${selectedRoles.includes(key) ? ACCENT : "rgba(255,255,255,0.1)"}`,
                      background: selectedRoles.includes(key) ? `${ACCENT}20` : "transparent",
                      color: selectedRoles.includes(key) ? ACCENT : "#94a3b8",
                      transition: "all 0.15s",
                    }}
                  >
                    {selectedRoles.includes(key) && <CheckCircle size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* TOS / FCRA compliance */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 14px", borderRadius: 8, background: tosAccepted ? "#00d4ff08" : "#001a33", border: `1px solid ${tosAccepted ? ACCENT : "rgba(255,255,255,0.1)"}`, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                style={{ accentColor: ACCENT, width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
              />
              <span>
                I acknowledge Talent Radar Healthcare is a <strong style={{ color: "#fff" }}>B2B Market Intelligence Feed and is NOT a Consumer Report under the FCRA</strong>. I will not use candidate data for FCRA-regulated employment screening or adverse action. TCPA: all outreach must be sent manually by me. No auto-dialing.
              </span>
            </label>

            <Button
              onClick={handleCheckout}
              disabled={loading || !tosAccepted}
              className="w-full h-14 text-lg font-black mt-4"
              style={{ background: tosAccepted ? ACCENT : "#334155", color: tosAccepted ? BG : "#94a3b8", opacity: tosAccepted ? 1 : 0.7 }}
            >
              {loading ? "Redirecting to checkout..." : "Start Monitoring — $99/mo"}
            </Button>

            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 8 }}>
              Secure checkout via Stripe. Cancel anytime. No long-term contracts.
            </p>
          </div>
        </div>
      </section>

      {/* Anti-Agency CTA */}
      <section style={{ background: "#0f172a", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "0 0 12px" }}>
            Your Staffing Agency Charges $80/hr.<br />We Charge $99/month.
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 24px" }}>
            Same candidates. Same license boards. You just reach them first — before the agencies add their 300% markup.
          </p>
          <a href="#signup" style={{ background: ACCENT, color: BG, padding: "14px 32px", borderRadius: 8, fontWeight: 800, fontSize: 16, textDecoration: "none", display: "inline-block" }}>
            Start Hiring Directly
          </a>
        </div>
      </section>

      <EnterpriseFooterBlock />
    </>
  );
}
