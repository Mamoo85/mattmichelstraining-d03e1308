import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Channel = "all" | "sms" | "email";
type Product = "all" | "contractor_leads" | "hire_alert" | "license_monitor" | "ghost_delay" | "missed_call";
type TimeRange = "today" | "7d" | "30d";

const TIME_LABELS: Record<TimeRange, string> = { today: "Today", "7d": "7 Days", "30d": "30 Days" };
const PRODUCT_LABELS: Record<Product, string> = {
  all: "All Products", contractor_leads: "Contractor Leads", hire_alert: "TechAlert",
  license_monitor: "License Monitor", ghost_delay: "Ghost Delay", missed_call: "Missed Call",
};

function getStartDate(range: TimeRange): string {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    sent: { bg: "#22c55e22", color: "#22c55e" },
    failed: { bg: "#ef444422", color: "#ef4444" },
    skipped: { bg: "#f59e0b22", color: "#f59e0b" },
    pending: { bg: "#a78bfa22", color: "#a78bfa" },
  };
  const s = map[status] ?? { bg: "#47556922", color: "#475569" };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {status.toUpperCase()}
    </span>
  );
}

interface CommsRow {
  id: string;
  channel: string;
  product: string;
  recipient: string;
  subject: string | null;
  body_preview: string | null;
  status: string;
  provider_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AdminGlobalOutbox() {
  const [channel, setChannel] = useState<Channel>("all");
  const [product, setProduct] = useState<Product>("all");
  const [range, setRange] = useState<TimeRange>("7d");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["global-outbox", channel, product, range, search],
    queryFn: async () => {
      let q = (supabase as any)
        .from("system_comms_log")
        .select("*")
        .gte("created_at", getStartDate(range))
        .order("created_at", { ascending: false })
        .limit(200);

      if (channel !== "all") q = q.eq("channel", channel);
      if (product !== "all") q = q.eq("product", product);
      if (search) q = q.ilike("recipient", `%${search}%`);

      const { data } = await q;
      return (data ?? []) as CommsRow[];
    },
    refetchInterval: 30000,
  });

  const smsCnt = rows?.filter(r => r.channel === "sms").length ?? 0;
  const emailCnt = rows?.filter(r => r.channel === "email").length ?? 0;
  const failedCnt = rows?.filter(r => r.status === "failed").length ?? 0;

  return (
    <div style={{ padding: "28px 0", color: "#e2e8f0" }}>
      <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>
        SYSTEM MONITORING
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Global Outbox</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            <span style={{ color: "#00d4ff", fontWeight: 700 }}>{smsCnt}</span> SMS
          </span>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            <span style={{ color: "#a78bfa", fontWeight: 700 }}>{emailCnt}</span> email
          </span>
          {failedCnt > 0 && (
            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{failedCnt} failed</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {/* Channel */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "sms", "email"] as Channel[]).map(c => (
            <button key={c} onClick={() => setChannel(c)} style={{
              background: channel === c ? "#00d4ff" : "#0f2342",
              color: channel === c ? "#0a1628" : "#94a3b8",
              border: `1px solid ${channel === c ? "#00d4ff" : "#1e3a5f"}`,
              borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{c === "all" ? "All" : c.toUpperCase()}</button>
          ))}
        </div>

        {/* Time range */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["today", "7d", "30d"] as TimeRange[]).map(t => (
            <button key={t} onClick={() => setRange(t)} style={{
              background: range === t ? "#0f2342" : "transparent",
              color: range === t ? "#00d4ff" : "#64748b",
              border: `1px solid ${range === t ? "#00d4ff" : "#1e3a5f"}`,
              borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{TIME_LABELS[t]}</button>
          ))}
        </div>

        {/* Product filter */}
        <select
          value={product}
          onChange={e => setProduct(e.target.value as Product)}
          style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 6, padding: "7px 12px", color: "#e2e8f0", fontSize: 12, cursor: "pointer" }}
        >
          {(Object.entries(PRODUCT_LABELS) as [Product, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Recipient search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipient…"
          style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 6, padding: "7px 12px", color: "#e2e8f0", fontSize: 12, minWidth: 180 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#0a1628" }}>
            {["Time", "Ch", "Recipient", "Product", "Status", "Preview"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ padding: "24px 14px", color: "#475569", textAlign: "center" }}>Loading…</td></tr>
            )}
            {!isLoading && rows?.map((row, i) => (
              <>
                <tr
                  key={row.id}
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "transparent" : "#0a1628", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                    {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    <br />
                    <span style={{ fontSize: 11 }}>{new Date(row.created_at).toLocaleDateString()}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 16 }}>{row.channel === "sms" ? "📱" : "✉️"}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#e2e8f0", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.recipient}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{row.product || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{statusBadge(row.status)}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.subject ? <span style={{ color: "#94a3b8" }}>"{row.subject}" </span> : null}
                    {row.body_preview || "—"}
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-exp`} style={{ borderTop: "1px solid #1e3a5f" }}>
                    <td colSpan={6} style={{ padding: "12px 14px", background: "#0a1628" }}>
                      {row.error_message && (
                        <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 8px" }}>Error: {row.error_message}</p>
                      )}
                      {row.provider_id && (
                        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px" }}>
                          Provider ID: <span style={{ color: "#00d4ff" }}>{row.provider_id}</span>
                        </p>
                      )}
                      <pre style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 6, padding: 10, fontSize: 11, color: "#94a3b8", margin: 0, overflowX: "auto" }}>
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!isLoading && rows?.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px 14px", color: "#475569", textAlign: "center" }}>No messages in this range</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#334155", fontSize: 11, marginTop: 10, textAlign: "right" }}>Auto-refreshes every 30s</p>
    </div>
  );
}
