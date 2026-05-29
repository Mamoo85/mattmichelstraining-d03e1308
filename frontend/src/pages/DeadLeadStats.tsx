// /dead-lead-stats?token=XYZ — no login required, token-secured
// Shows a contractor their dead lead campaign performance.
// Link can be texted to contractors anytime Matt wants to share proof of value.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface DeadLeadStatsData {
  business_name: string;
  campaigns: number;
  total_contacts: number;
  texts_sent: number;
  positive_replies: number;
  opt_outs: number;
  revenue_recovered: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function DeadLeadStats() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [stats, setStats] = useState<DeadLeadStatsData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch(
      `${SUPABASE_URL}/functions/v1/dead-lead-stats?token=${encodeURIComponent(token)}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    )
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.stats) { setStats(data.stats); setStatus("ready"); }
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const card = (value: string | number, label: string, icon: string, color: string, sub?: string) => (
    <div style={{
      background: "#0d1a2e",
      border: `1px solid ${color}33`,
      borderRadius: 12,
      padding: "22px 18px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 30, marginBottom: 6 }}>{icon}</div>
      <div style={{ color, fontSize: 44, fontWeight: 900, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#060c18", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00d4ff", fontSize: 18, fontFamily: "sans-serif" }}>Loading your stats…</div>
    </div>
  );

  if (status === "error" || !stats) return (
    <div style={{ minHeight: "100vh", background: "#060c18", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h1 style={{ color: "#fff", fontSize: 22, margin: "0 0 12px" }}>Report Unavailable</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>
          This link may be invalid or expired. Text Matt at{" "}
          <a href="tel:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a> for help.
        </p>
      </div>
    </div>
  );

  const replyRate = stats.texts_sent > 0 ? Math.round((stats.positive_replies / stats.texts_sent) * 100) : 0;
  const revenueDisplay = `$${stats.revenue_recovered.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div style={{ minHeight: "100vh", background: "#060c18", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: "#00d4ff", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Detroit Web Agency · Dead Lead Reactivation
          </div>
          <h1 style={{ color: "#e2e8f0", fontSize: 26, fontWeight: 900, margin: "0 0 8px" }}>
            {stats.business_name}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            Campaign performance · All time
          </p>
        </div>

        {/* Revenue hero */}
        <div style={{
          background: "linear-gradient(135deg, #0a2540 0%, #0d1a2e 100%)",
          border: "1px solid #00d4ff33",
          borderRadius: 14,
          padding: "28px 24px",
          textAlign: "center",
          marginBottom: 20,
        }}>
          <div style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            Revenue Recovered
          </div>
          <div style={{ color: "#00d4ff", fontSize: 56, fontWeight: 900, lineHeight: 1, marginBottom: 6 }}>
            {revenueDisplay}
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            $50 per positive reply · {stats.campaigns} active campaign{stats.campaigns !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {card(stats.total_contacts.toLocaleString(), "Contacts Loaded", "📋", "#94a3b8")}
          {card(stats.texts_sent.toLocaleString(), "Texts Sent", "💬", "#3b82f6")}
          {card(stats.positive_replies.toLocaleString(), "Said YES", "✅", "#10b981", "Ready to book")}
          {card(`${replyRate}%`, "Reply Rate", "📈", "#f59e0b", "Industry avg: 3–5%")}
        </div>

        {stats.opt_outs > 0 && (
          <div style={{
            background: "#0d1a2e",
            border: "1px solid #1e2d4a",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: "#64748b", fontSize: 13 }}>Opt-outs (STOP replies)</span>
            <span style={{ color: "#94a3b8", fontSize: 15, fontWeight: 700 }}>{stats.opt_outs}</span>
          </div>
        )}

        {/* How it works */}
        <div style={{ background: "#0d1a2e", border: "1px solid #1e2d4a", borderRadius: 12, padding: "20px 22px", marginBottom: 20 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>How It Works</div>
          {[
            ["💬", "We text your old dead leads 3 times over 5 days"],
            ["✅", "When someone says YES, you get an instant text"],
            ["💳", "$50 charged only when a lead responds positively"],
          ].map(([icon, text], i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: "#0d1a2e", border: "1px solid #1e2d4a", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 14px" }}>
            Want to add more leads or ask a question?
          </p>
          <a
            href="tel:+13139921219"
            style={{ color: "#00d4ff", fontSize: 17, fontWeight: 700, textDecoration: "none", display: "block", marginBottom: 6 }}
          >
            Text Matt: (313) 992-1219
          </a>
          <div style={{ color: "#334155", fontSize: 11, marginTop: 12, letterSpacing: 0.5 }}>
            DETROIT WEB AGENCY · WE HANDLE THE TECH.
          </div>
        </div>

      </div>
    </div>
  );
}
