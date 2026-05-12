import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ACCENT = "#00d4ff";
const BG = "#0a1628";
const CARD = "#0d1b2e";
const BORDER = "#1e293b";

const MI_COUNTIES = [
  "Wayne", "Oakland", "Macomb", "Washtenaw", "Genesee", "Kent", "Ingham",
  "Livingston", "Saginaw", "Kalamazoo", "Ottawa", "Muskegon", "St. Clair",
];

export default function TechAlertStaffing() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [agency, setAgency] = useState("");
  const [county, setCounty] = useState("Wayne");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function startCheckout() {
    if (!email) {
      toast({ title: "Enter your email first", description: "Use the form so checkout can pre-fill your account." });
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hire-alert-checkout", {
        body: {
          email,
          company_name: agency,
          phone,
          plan: "standalone",
          target_roles: ["cna", "rn", "lpn", "home_health_aide"],
          county,
          source_page: "healthcare",
          ref: "techalert_staffing_self_checkout",
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (err: unknown) {
      toast({ title: "Checkout error", description: err instanceof Error ? err.message : "Text Matt at (313) 992-1219", variant: "destructive" });
      setCheckoutLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("techalert-staffing-lead-magnet", {
        body: { email, agency, county, phone },
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Check your inbox", description: "Your 10 free candidates are on the way." });
    } catch (err: unknown) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Try again or text Matt at (313) 992-1219",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <SEOHead
        title="TechAlert for Staffing Agencies — 10 Free CNA/RN Candidates"
        description="Stop paying $82/hr to staffing agencies. Get daily 7am alerts the moment a new CNA, LPN, or RN clears their license in your Michigan county. $149/mo. First 10 names free."
      />

      {/* Nav */}
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
          <span style={{ color: ACCENT }}>Tech</span>Alert
        </div>
        <a href="sms:+13139921219" style={{ color: ACCENT, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Text (313) 992-1219
        </a>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "48px 20px 32px", textAlign: "center" }}>
        <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
          For Michigan Healthcare Staffing Agencies
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.15, margin: "16px 0 18px", color: "#fff" }}>
          Stop paying agencies <span style={{ color: ACCENT }}>$82/hr</span> for CNAs you could hire direct.
        </h1>
        <p style={{ fontSize: 17, color: "#cbd5e1", lineHeight: 1.6, maxWidth: 680, margin: "0 auto 28px" }}>
          We text you every morning at 7am the moment a new CNA, LPN, or RN clears their license at the State of Michigan. You reach them <strong style={{ color: "#fff" }}>3–6 weeks before they hit Indeed</strong>.
        </p>

        <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          {["Wayne County", "Oakland County", "Macomb County", "All 83 MI counties"].map(c => (
            <span key={c} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "6px 12px", borderRadius: 20, fontSize: 12, color: "#94a3b8" }}>{c}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
          <a href="#free-candidates" style={{ background: ACCENT, color: BG, padding: "14px 24px", borderRadius: 8, fontWeight: 800, textDecoration: "none" }}>
            Get 10 Free Names
          </a>
          <Link to="/talent-radar/trial?vertical=healthcare" style={{ border: `1px solid ${ACCENT}`, color: ACCENT, padding: "14px 24px", borderRadius: 8, fontWeight: 800, textDecoration: "none" }}>
            Start No-Card Trial
          </Link>
          <a href="/talent-radar/setup" style={{ color: "#cbd5e1", padding: "14px 8px", fontWeight: 700, textDecoration: "none" }}>
            Self-Onboard →
          </a>
        </div>
      </section>

      {/* Lead magnet form */}
      <section id="free-candidates" style={{ maxWidth: 560, margin: "0 auto 56px", padding: "0 20px" }}>
        <div style={{ background: CARD, border: `2px solid ${ACCENT}`, borderRadius: 14, padding: 28 }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>📬</div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>Check your inbox</h2>
              <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Your 10 free candidates from {county} County are on the way. Matt will also reach out personally within 24 hours to walk through your account setup.
              </p>
              <a
                href="sms:+13139921219"
                style={{ display: "inline-block", marginTop: 20, color: ACCENT, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
              >
                Or text Matt now: (313) 992-1219 →
              </a>
              <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                <button onClick={startCheckout} disabled={checkoutLoading} style={{ background: ACCENT, color: BG, border: "none", padding: "14px 20px", borderRadius: 8, fontWeight: 900, cursor: checkoutLoading ? "wait" : "pointer" }}>
                  {checkoutLoading ? "Opening checkout…" : "Start 7-Day Checkout Trial →"}
                </button>
                <Link to="/talent-radar/trial?vertical=healthcare" style={{ border: `1px solid ${BORDER}`, color: "#cbd5e1", padding: "13px 20px", borderRadius: 8, fontWeight: 800, textDecoration: "none" }}>
                  Start No-Card Trial Instead
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                Free · No credit card
              </p>
              <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "8px 0 6px" }}>Get 10 free candidates</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 20px" }}>
                Real names from this week's Michigan LARA license filings. Emailed in 60 seconds.
              </p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Agency name (e.g. Comfort Keepers)"
                  value={agency}
                  onChange={e => setAgency(e.target.value)}
                  style={inputStyle}
                />
                <select
                  value={county}
                  onChange={e => setCounty(e.target.value)}
                  style={inputStyle}
                >
                  {MI_COUNTIES.map(c => <option key={c} value={c}>{c} County</option>)}
                </select>
                <input
                  type="email"
                  required
                  placeholder="Work email (where to send candidates)"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="tel"
                  placeholder="Phone (optional — for Matt to call)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: ACCENT, color: BG, border: "none",
                    padding: "16px 24px", borderRadius: 8, fontSize: 16, fontWeight: 800,
                    cursor: loading ? "wait" : "pointer", marginTop: 4,
                  }}
                >
                  {loading ? "Sending…" : "Send my 10 free candidates →"}
                </button>
                <p style={{ color: "#64748b", fontSize: 11, margin: "4px 0 0", textAlign: "center" }}>
                  We'll never sell or share your info. Just one follow-up email and a personal call from Matt.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* The math */}
      <section style={{ background: CARD, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "48px 20px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>
            One hire pays for the whole year.
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", margin: "0 0 32px" }}>
            Real math from a Michigan SNF that switched in March 2026.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, maxWidth: 540, margin: "0 auto" }}>
            <Row label="Staffing agency CNA rate" value="$82/hr" muted />
            <Row label="TechAlert direct-hire rate" value="$22/hr" accent />
            <Row label="Savings per shift (8hr)" value="$480" />
            <Row label="Savings per month (20 shifts)" value="$9,600" />
            <Row label="TechAlert annual cost" value="$1,788" muted />
            <Row label="Net savings, year 1" value="+$113,412" accent bold />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "48px 20px" }}>
        <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 32px" }}>
          What Michigan operators say
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <Quote
            text="We were paying a staffing agency $82/hour for CNAs. TechAlert texted us a newly licensed CNA in our county — hired her at $22/hour. This service paid for itself in a single shift."
            author="Karen M., Director of Nursing"
            location="Oakland County SNF"
          />
          <Quote
            text="Three RNs in two months. All from license board alerts before they posted on Indeed. Our agency costs dropped 40%."
            author="David R., Administrator"
            location="Skilled Nursing Facility"
          />
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: CARD, borderTop: `1px solid ${BORDER}`, padding: "48px 20px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 32px" }}>
            How TechAlert works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, maxWidth: 640, margin: "0 auto" }}>
            <Step n={1} t="We monitor LARA every night" d="Michigan's license board issues new CNA, LPN, RN, and home-health credentials daily. We capture every one within hours." />
            <Step n={2} t="You get a 7am text + email" d="Filtered by your county. Name, license type, ZIP, license number — everything you need to call them today." />
            <Step n={3} t="You hire direct, skip the agency" d="Most newly-licensed candidates haven't even updated their LinkedIn yet. You're the first call they get." />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: "56px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "0 0 12px" }}>
          $149/month. Cancel anytime.
        </h2>
        <p style={{ color: "#cbd5e1", fontSize: 15, margin: "0 0 24px" }}>
          Or scroll up and grab your 10 free candidates first.
        </p>
        <Link
          to="/talent-radar/healthcare"
          style={{
            display: "inline-block", background: ACCENT, color: BG,
            padding: "16px 36px", borderRadius: 8, fontSize: 16, fontWeight: 800, textDecoration: "none",
          }}
        >
          Start TechAlert →
        </Link>
        <p style={{ color: "#64748b", fontSize: 13, margin: "20px 0 0" }}>
          Questions? Text Matt directly: <a href="sms:+13139921219" style={{ color: ACCENT, textDecoration: "none" }}>(313) 992-1219</a>
        </p>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "20px", textAlign: "center", color: "#64748b", fontSize: 12 }}>
        Detroit Web Agency · TechAlert · Sourced from Michigan LARA public records.
      </footer>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: BG,
  border: `1px solid ${BORDER}`,
  color: "#fff",
  padding: "14px 16px",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
};

function Row({ label, value, accent, muted, bold }: { label: string; value: string; accent?: boolean; muted?: boolean; bold?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 18px",
    }}>
      <span style={{ color: muted ? "#94a3b8" : "#cbd5e1", fontSize: 14 }}>{label}</span>
      <span style={{ color: accent ? ACCENT : "#fff", fontSize: bold ? 20 : 16, fontWeight: bold ? 900 : 700 }}>{value}</span>
    </div>
  );
}

function Quote({ text, author, location }: { text: string; author: string; location: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24 }}>
      <p style={{ color: "#e2e8f0", fontSize: 15, lineHeight: 1.65, margin: "0 0 14px", fontStyle: "italic" }}>"{text}"</p>
      <p style={{ color: ACCENT, fontSize: 13, fontWeight: 700, margin: 0 }}>{author}</p>
      <p style={{ color: "#64748b", fontSize: 12, margin: "2px 0 0" }}>{location}</p>
    </div>
  );
}

function Step({ n, t, d }: { n: number; t: string; d: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
        background: ACCENT, color: BG, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: 16,
      }}>{n}</div>
      <div>
        <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: "4px 0 6px" }}>{t}</h3>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{d}</p>
      </div>
    </div>
  );
}
