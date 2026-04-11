import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Tab = "ppl" | "candidates" | "licenses";

function StatCard({ label, value, sub, color = "#00d4ff" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: "20px 22px" }}>
      <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 8px" }}>{label}</p>
      <p style={{ color, fontSize: 28, fontWeight: 800, margin: "0 0 4px", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>{sub}</p>}
    </div>
  );
}

export default function AdminDWARevenueDashboard() {
  const [tab, setTab] = useState<Tab>("ppl");

  const { data: metrics } = useQuery({
    queryKey: ["dwa-revenue-metrics"],
    queryFn: async () => {
      const [
        { count: leadsSold },
        { data: revenue },
        { count: softLocks },
        { count: paidClients },
        { count: activeTrials },
        { count: convertedTrials },
        { count: expiredTrials },
        { count: phantomSent },
        { count: licensesTotal },
        { count: expiringSoon },
      ] = await Promise.all([
        (supabase as any).from("contractor_leads").select("id", { count: "exact", head: true }).eq("status", "sold"),
        (supabase as any).from("contractor_leads").select("payment_amount_cents").eq("status", "sold"),
        (supabase as any).from("contractor_leads").select("id", { count: "exact", head: true })
          .eq("status", "pending_checkout").gt("lock_expires_at", new Date().toISOString()),
        (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("active", true),
        (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("trial_status", "active"),
        (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("trial_status", "converted"),
        (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("trial_status", "expired"),
        (supabase as any).from("hire_alert_clients").select("id", { count: "exact", head: true }).eq("trial_status", "phantom_sent"),
        (supabase as any).from("license_monitor_items").select("id", { count: "exact", head: true }),
        (supabase as any).from("license_monitor_items").select("id", { count: "exact", head: true })
          .lte("expiry_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
          .gte("expiry_date", new Date().toISOString().split("T")[0]),
      ]);

      const totalRevenue = (revenue as any[])?.reduce((s: number, r: any) => s + (r.payment_amount_cents || 0), 0) ?? 0;
      const convTotal = (convertedTrials ?? 0) + (expiredTrials ?? 0) + (phantomSent ?? 0);
      const convRate = convTotal > 0 ? Math.round(((convertedTrials ?? 0) / convTotal) * 100) : 0;

      return {
        leadsSold: leadsSold ?? 0,
        totalRevenue: (totalRevenue / 100).toFixed(0),
        softLocks: softLocks ?? 0,
        paidClients: paidClients ?? 0,
        activeTrials: activeTrials ?? 0,
        convRate,
        phantomSent: phantomSent ?? 0,
        licensesTotal: licensesTotal ?? 0,
        expiringSoon: expiringSoon ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  const { data: pplPurchases } = useQuery({
    queryKey: ["dwa-ppl-purchases"],
    enabled: tab === "ppl",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contractor_lead_purchases")
        .select("*, contractor_leads(name, project_type, contractor_lead_sites(trade, city))")
        .order("purchased_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const { data: candidates } = useQuery({
    queryKey: ["dwa-candidates-recent"],
    enabled: tab === "candidates",
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("hire_alert_candidates")
        .select("full_name, license_type, city, availability_score, source, created_at")
        .gte("created_at", since)
        .order("availability_score", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: licenses } = useQuery({
    queryKey: ["dwa-licenses-upcoming"],
    enabled: tab === "licenses",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("license_monitor_items")
        .select("*, license_monitor_clients(business_name, owner_email)")
        .order("expiry_date", { ascending: true })
        .limit(50);
      return data ?? [];
    },
  });

  const m = metrics;
  const scoreColor = (s: number) => s >= 8 ? "#22c55e" : s >= 6 ? "#f59e0b" : "#94a3b8";

  return (
    <div style={{ padding: "28px 0", color: "#e2e8f0" }}>
      <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>
        DETROIT WEB AGENCY
      </p>
      <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 24px" }}>Revenue Dashboard</h2>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard label="PPL Leads Sold" value={m?.leadsSold ?? "—"} sub={`$${m?.totalRevenue ?? 0} revenue`} />
        <StatCard label="Soft Locks Active" value={m?.softLocks ?? "—"} sub="pending checkout" color="#f59e0b" />
        <StatCard label="TechAlert Paid" value={m?.paidClients ?? "—"} sub="active subscribers" />
        <StatCard label="Active Trials" value={m?.activeTrials ?? "—"} sub="in 72h window" color="#a78bfa" />
        <StatCard label="Trial Conv. Rate" value={m ? `${m.convRate}%` : "—"} sub="converted / total" color="#22c55e" />
        <StatCard label="Phantom Alerts" value={m?.phantomSent ?? "—"} sub="FOMO sent" color="#e8621a" />
        <StatCard label="Licenses Tracked" value={m?.licensesTotal ?? "—"} sub="across all clients" />
        <StatCard label="Expiring ≤30 Days" value={m?.expiringSoon ?? "—"} sub="need renewal" color="#ef4444" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {([["ppl", "PPL Purchases"], ["candidates", "TechAlert Candidates (7d)"], ["licenses", "Upcoming Expirations"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? "#00d4ff" : "#0f2342",
            color: tab === key ? "#0a1628" : "#94a3b8",
            border: `1px solid ${tab === key ? "#00d4ff" : "#1e3a5f"}`,
            borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {/* PPL Purchases Table */}
      {tab === "ppl" && (
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#0a1628" }}>
              {["Date", "Lead Name", "Trade", "City", "Amount"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {(pplPurchases ?? []).map((p: any, i: number) => (
                <tr key={p.id} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "transparent" : "#0a1628" }}>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{new Date(p.purchased_at).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 14px", color: "#e2e8f0", fontWeight: 600 }}>{p.contractor_leads?.name || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{p.contractor_leads?.contractor_lead_sites?.trade || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{p.contractor_leads?.contractor_lead_sites?.city || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#22c55e", fontWeight: 700 }}>${((p.amount_cents || 0) / 100).toFixed(0)}</td>
                </tr>
              ))}
              {!pplPurchases?.length && <tr><td colSpan={5} style={{ padding: "20px 14px", color: "#475569", textAlign: "center" }}>No purchases yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* TechAlert Candidates */}
      {tab === "candidates" && (
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#0a1628" }}>
              {["Name", "License", "City", "Score", "Source", "Found"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {(candidates ?? []).map((c: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "transparent" : "#0a1628" }}>
                  <td style={{ padding: "10px 14px", color: "#e2e8f0", fontWeight: 600 }}>{c.full_name || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{c.license_type || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{c.city || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: scoreColor(c.availability_score), fontWeight: 800 }}>{c.availability_score}/10</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{c.source || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!candidates?.length && <tr><td colSpan={6} style={{ padding: "20px 14px", color: "#475569", textAlign: "center" }}>No candidates in last 7 days</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* License Expirations */}
      {tab === "licenses" && (
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#0a1628" }}>
              {["Client", "License Type", "Number", "Expiry", "Days Left"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {(licenses ?? []).map((l: any, i: number) => {
                const daysLeft = Math.ceil((new Date(l.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const urgency = daysLeft <= 7 ? "#ef4444" : daysLeft <= 30 ? "#f59e0b" : "#22c55e";
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "transparent" : "#0a1628" }}>
                    <td style={{ padding: "10px 14px", color: "#e2e8f0" }}>{l.license_monitor_clients?.business_name || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{l.license_type || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{l.license_number || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{l.expiry_date || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: urgency, fontWeight: 700 }}>{daysLeft}d</span>
                    </td>
                  </tr>
                );
              })}
              {!licenses?.length && <tr><td colSpan={5} style={{ padding: "20px 14px", color: "#475569", textAlign: "center" }}>No licenses tracked yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
