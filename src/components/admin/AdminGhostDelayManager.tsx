import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type DraftTab = "pending" | "sent" | "cancelled";

interface Draft {
  id: string;
  lead_email: string;
  draft_subject: string;
  draft_body: string;
  send_after: string;
  sent: boolean;
  cancelled: boolean;
  category: string;
  created_at: string;
}

function Countdown({ sendAfter }: { sendAfter: string }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const update = () => setDiff(new Date(sendAfter).getTime() - Date.now());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [sendAfter]);

  if (diff <= 0) return <span style={{ color: "#22c55e", fontWeight: 700 }}>Sending…</span>;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return <span style={{ color: "#f59e0b", fontWeight: 700 }}>{mins}m {secs}s</span>;
}

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    INTERESTED: "#22c55e", OBJECTION_PRICE: "#f59e0b", OBJECTION_TIMING: "#f59e0b",
    OBJECTION_COMPETITOR: "#e8621a", NOT_INTERESTED: "#ef4444", UNSUBSCRIBE: "#64748b",
  };
  return (
    <span style={{
      background: (colors[cat] || "#475569") + "22",
      color: colors[cat] || "#94a3b8",
      border: `1px solid ${colors[cat] || "#475569"}44`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>{cat.replace("OBJECTION_", "OBJ: ")}</span>
  );
}

export default function AdminGhostDelayManager() {
  const [tab, setTab] = useState<DraftTab>("pending");
  const qc = useQueryClient();

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pending } = useQuery({
    queryKey: ["ghost-delay-pending"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("email_reply_drafts")
        .select("*")
        .eq("cancelled", false).eq("sent", false)
        .order("send_after", { ascending: true });
      return (data ?? []) as Draft[];
    },
    refetchInterval: 15000,
  });

  const { data: sent } = useQuery({
    queryKey: ["ghost-delay-sent"],
    enabled: tab === "sent",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("email_reply_drafts")
        .select("*")
        .eq("sent", true)
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Draft[];
    },
  });

  const { data: cancelled } = useQuery({
    queryKey: ["ghost-delay-cancelled"],
    enabled: tab === "cancelled",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("email_reply_drafts")
        .select("*")
        .eq("cancelled", true)
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Draft[];
    },
  });

  const cancelDraft = async (id: string) => {
    await (supabase as any).from("email_reply_drafts").update({ cancelled: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["ghost-delay-pending"] });
  };

  const sendNow = async (id: string) => {
    await (supabase as any).from("email_reply_drafts")
      .update({ send_after: new Date().toISOString() })
      .eq("id", id);
    await supabase.functions.invoke("release-pending-replies");
    qc.invalidateQueries({ queryKey: ["ghost-delay-pending"] });
  };

  const rows = tab === "pending" ? (pending ?? []) : tab === "sent" ? (sent ?? []) : (cancelled ?? []);

  return (
    <div style={{ padding: "28px 0", color: "#e2e8f0" }}>
      <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>
        GHOST DELAY SYSTEM
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>
          Reply Draft Manager
          {(pending?.length ?? 0) > 0 && (
            <span style={{ marginLeft: 10, background: "#e8621a", color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 13, fontWeight: 800 }}>
              {pending!.length}
            </span>
          )}
        </h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {([["pending", "Pending"], ["sent", "Sent (7d)"], ["cancelled", "Cancelled (7d)"]] as [DraftTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? "#e8621a" : "#0f2342",
            color: tab === key ? "#fff" : "#94a3b8",
            border: `1px solid ${tab === key ? "#e8621a" : "#1e3a5f"}`,
            borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: "pointer",
          }}>{label}{key === "pending" && pending?.length ? ` (${pending.length})` : ""}</button>
        ))}
      </div>

      <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#0a1628" }}>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>RECIPIENT</th>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>CATEGORY</th>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>SUBJECT</th>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>PREVIEW</th>
            <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>
              {tab === "pending" ? "SENDS IN" : "DATE"}
            </th>
            {tab === "pending" && <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>ACTIONS</th>}
          </tr></thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} style={{ borderTop: "1px solid #1e3a5f", background: i % 2 === 0 ? "transparent" : "#0a1628" }}>
                <td style={{ padding: "10px 14px", color: "#e2e8f0", fontWeight: 600 }}>{d.lead_email || "—"}</td>
                <td style={{ padding: "10px 14px" }}><CategoryBadge cat={d.category || "UNKNOWN"} /></td>
                <td style={{ padding: "10px 14px", color: "#94a3b8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.draft_subject || "—"}</td>
                <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(d.draft_body || "").slice(0, 100)}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {tab === "pending"
                    ? <Countdown sendAfter={d.send_after} />
                    : <span style={{ color: "#475569" }}>{new Date(d.created_at).toLocaleDateString()}</span>
                  }
                </td>
                {tab === "pending" && (
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => sendNow(d.id)} style={{ background: "#00d4ff", color: "#0a1628", border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Send Now</button>
                      <button onClick={() => cancelDraft(d.id)} style={{ background: "none", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={tab === "pending" ? 6 : 5} style={{ padding: "24px 14px", color: "#475569", textAlign: "center" }}>
                {tab === "pending" ? "No drafts queued" : `No ${tab} drafts in last 7 days`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
