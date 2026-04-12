// /roi?token=XYZ — read-only, no login, token-secured (not raw client_id)
// Texted to contractors every Friday by contractor-roi-sms cron.
// Shows big bold metric cards proving DWA's value that week.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface ROIStats {
  business_name: string;
  leads_delivered: number;
  dead_leads_revived: number;
  missed_calls_caught: number;
  licenses_monitored: number;
  period_start: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ContractorROIReport() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [stats, setStats] = useState<ROIStats | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/contractor-roi-report?token=${encodeURIComponent(token)}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      );
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();
      if (data.ok && data.stats) { setStats(data.stats); setStatus("ready"); }
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  const card = (value: number, label: string, icon: string, color: string) => (
    <div style={{
      background: "#0f2342", border: `1px solid ${color}22`,
      borderRadius: 12, padding: "24px 20px", textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ color, fontSize: 48, fontWeight: 900, lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00d4ff", fontSize: 18 }}>Loading your report…</div>
    </div>
  );

  if (status === "error" || !stats) return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h1 style={{ color: "#fff", fontSize: 22, margin: "0 0 12px" }}>Report Unavailable</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>This link may have expired or is invalid. Text Matt at <a href="tel:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a> for help.</p>
      </div>
    </div>
  );

  const periodDate = new Date(stats.period_start).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", padding: "40px 24px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: "#00d4ff", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Detroit Web Agency
          </div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 8px" }}>
            {stats.business_name}
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Weekly Report · Week of {periodDate}
          </p>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {card(stats.leads_delivered, "Leads Delivered", "🎯", "#00d4ff")}
          {card(stats.dead_leads_revived, "Dead Leads Revived", "♻️", "#10b981")}
          {card(stats.missed_calls_caught, "Missed Calls Caught", "📞", "#f59e0b")}
          {card(stats.licenses_monitored, "Licenses Monitored", "🔒", "#8b5cf6")}
        </div>

        {/* Footer */}
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: "20px 24px", textAlign: "center" }}>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 12px" }}>
            Questions about your report or want to add a service?
          </p>
          <a
            href="tel:+13139921219"
            style={{ color: "#00d4ff", fontSize: 16, fontWeight: 700, textDecoration: "none" }}
          >
            Text Matt: (313) 992-1219
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
            DETROIT WEB AGENCY · WE HANDLE THE TECH.
          </div>
        </div>
      </div>
    </div>
  );
}
