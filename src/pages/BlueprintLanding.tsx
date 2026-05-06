import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, FileText, Phone, Star, Shield, Zap } from "lucide-react";

const BULLETS = [
  "The 5 non-negotiables of a contractor website that actually converts",
  "Google Business Profile 30-minute setup checklist (rank in the local 3-pack)",
  "The missed-call system that auto-recovers 30–40% of lost leads",
  "Review automation: go from 12 to 100+ Google reviews in 12 months",
  "90-day launch checklist — week-by-week, no guesswork",
  "What to ask any web agency before you pay them a dime",
];

export default function BlueprintLanding() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePaid = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-blueprint-checkout", {
        body: { email: email.trim() },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong. Call (313) 992-1219.");
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Free Contractor Website Blueprint — Detroit Web Agency</title>
        <meta name="description" content="The exact system Metro Detroit contractors use to turn their website into a 24/7 lead machine. Google Business Profile, missed-call recovery, review automation, 90-day checklist." />
      </Helmet>

      <div style={{ background: "#0a1628", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

        {/* NAV */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#00d4ff", fontWeight: 900, fontSize: "15px", letterSpacing: "-0.01em" }}>
            Detroit Web Agency
          </div>
          <a href="tel:+13139921219" style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
            <Phone size={14} />
            (313) 992-1219
          </a>
        </div>

        <div style={{ maxWidth: "680px", margin: "0 auto", padding: "60px 24px 80px" }}>

          {/* BADGE */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "20px", padding: "6px 14px", marginBottom: "28px" }}>
            <FileText size={13} color="#00d4ff" />
            <span style={{ color: "#00d4ff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Free Resource · Detroit Web Agency</span>
          </div>

          {/* HEADLINE */}
          <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            The Contractor<br />
            <span style={{ color: "#00d4ff" }}>Website Blueprint</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "17px", lineHeight: 1.65, marginBottom: "40px", maxWidth: "560px" }}>
            Everything a Metro Detroit contractor needs to turn their website into a 24/7 lead machine — without wasting money on agencies that don't know the trades.
          </p>

          {/* BULLETS */}
          <div style={{ marginBottom: "40px" }}>
            {BULLETS.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", alignItems: "flex-start" }}>
                <CheckCircle size={18} color="#00d4ff" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "15px", lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* PURCHASE BOX */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "16px", padding: "32px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ color: "#fff", fontSize: "28px", fontWeight: 900 }}>$47 <span style={{ fontSize: "14px", fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>one-time</span></div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginTop: "2px" }}>Instant access · No subscription</div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1,2,3,4,5].map(s => <Star key={s} size={14} color="#00d4ff" fill="#00d4ff" />)}
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginLeft: "4px" }}>Trades-focused</span>
              </div>
            </div>

            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePaid()}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "15px",
                marginBottom: "12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handlePaid}
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "8px",
                border: "none",
                background: loading ? "rgba(0,212,255,0.4)" : "#00d4ff",
                color: "#0a1628",
                fontSize: "16px",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? "Opening checkout…" : "Download Blueprint — $47 →"}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "12px" }}>
              <Shield size={13} color="rgba(255,255,255,0.3)" />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>Secure checkout via Stripe · Instant delivery to your email</span>
            </div>
          </div>

          {/* TRUST */}
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Zap size={20} color="#00d4ff" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>Written by a local contractor web specialist</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: 1.6 }}>
                Matt Michels has been building websites for Metro Detroit trade businesses since 2004. This blueprint is the exact framework every DWA client gets on day one — now available to anyone.
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", marginTop: "8px" }}>
                Questions? Text Matt directly: <a href="tel:+13139921219" style={{ color: "#00d4ff", textDecoration: "none" }}>(313) 992-1219</a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
