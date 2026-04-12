// AdminDeadLeads — Dead Lead Reactivation manager
// Matt selects a contractor, pastes phone/name list, creates a campaign.
// System drips white-labeled SMS over 5 days. $50 per positive reply.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, Plus, ChevronDown, ChevronUp } from "lucide-react";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-700 text-slate-300",
  drip1_sent: "bg-blue-900 text-blue-300",
  drip2_sent: "bg-blue-800 text-blue-200",
  drip3_sent: "bg-indigo-900 text-indigo-300",
  replied_positive: "bg-green-900 text-green-300",
  replied_negative: "bg-red-900 text-red-300",
  review_requested: "bg-yellow-900 text-yellow-300",
  opted_out: "bg-gray-800 text-gray-500",
};

export default function AdminDeadLeads() {
  const qc = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newForm, setNewForm] = useState({ contractor_id: "", name: "", trade: "", contacts: "" });
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: contractors } = useQuery({
    queryKey: ["contractor_clients_active"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("contractor_clients").select("id, business_name, phone").eq("active", true).order("business_name");
      return data || [];
    },
  });

  const { data: campaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ["dead_lead_campaigns"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("dead_lead_campaigns")
        .select("*, contractor_clients(business_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Global stats across ALL campaigns
  const { data: allContacts } = useQuery({
    queryKey: ["dead_lead_contacts_all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("dead_lead_contacts")
        .select("id, status, contractor_notified_at, name, phone, campaign_id, dead_lead_campaigns(name, contractor_clients(business_name))")
        .order("contractor_notified_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const globalStats = {
    total: allContacts?.length || 0,
    in_drip: allContacts?.filter((c: any) => ["drip1_sent","drip2_sent","drip3_sent"].includes(c.status)).length || 0,
    positive: allContacts?.filter((c: any) => c.status === "replied_positive").length || 0,
    campaigns: campaigns?.length || 0,
  };
  const recentActivity = allContacts?.filter((c: any) => c.status === "replied_positive").slice(0, 10) || [];
  const hasRecentActivity = recentActivity.some((c: any) => c.contractor_notified_at && Date.now() - new Date(c.contractor_notified_at).getTime() < 24 * 60 * 60 * 1000);

  const { data: contacts } = useQuery({
    queryKey: ["dead_lead_contacts", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data } = await (supabase as any)
        .from("dead_lead_contacts")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedCampaignId,
    refetchInterval: 15000,
  });

  const stats = {
    pending: contacts?.filter((c: any) => c.status === "pending").length || 0,
    in_drip: contacts?.filter((c: any) => ["drip1_sent","drip2_sent","drip3_sent"].includes(c.status)).length || 0,
    positive: contacts?.filter((c: any) => c.status === "replied_positive").length || 0,
    review: contacts?.filter((c: any) => c.status === "review_requested").length || 0,
    opted_out: contacts?.filter((c: any) => c.status === "opted_out").length || 0,
  };

  const handleCreate = async () => {
    if (!newForm.contractor_id || !newForm.name || !newForm.contacts.trim()) {
      toast.error("Contractor, campaign name, and at least one contact are required");
      return;
    }
    setCreating(true);
    try {
      const { data: camp, error } = await (supabase as any)
        .from("dead_lead_campaigns")
        .insert({ contractor_id: newForm.contractor_id, name: newForm.name, trade: newForm.trade || null })
        .select("id")
        .single();
      if (error || !camp) throw new Error(error?.message || "Failed to create campaign");

      const lines = newForm.contacts.split("\n").map(l => l.trim()).filter(Boolean);
      const contactRows = lines.map(line => {
        const parts = line.split(",").map(p => p.trim());
        const phone = parts[0]?.replace(/\D/g, "");
        const e164 = phone?.length === 10 ? `+1${phone}` : phone?.length === 11 ? `+${phone}` : parts[0];
        return { campaign_id: camp.id, contractor_id: newForm.contractor_id, phone: e164, name: parts[1] || null };
      }).filter(r => r.phone);

      if (!contactRows.length) throw new Error("No valid phone numbers found");

      const { error: insErr } = await (supabase as any).from("dead_lead_contacts").insert(contactRows);
      if (insErr) throw new Error(insErr.message);

      toast.success(`Campaign created — ${contactRows.length} contacts added`);
      setNewForm({ contractor_id: "", name: "", trade: "", contacts: "" });
      setShowNewCampaign(false);
      refetchCampaigns();
      setSelectedCampaignId(camp.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRunDrip = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("dead-lead-drip", { body: {} });
      if (error) throw error;
      toast.success(`Drip run: drip1=${data?.drip1 || 0}, drip2=${data?.drip2 || 0}, drip3=${data?.drip3 || 0}`);
      qc.invalidateQueries({ queryKey: ["dead_lead_contacts"] });
    } catch (e: any) {
      toast.error(e.message || "Drip run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", padding: "24px", color: "#e2e8f0", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>♻️ Dead Lead Reactivation</h2>
            <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>
              Upload contractor's old leads → 3-msg SMS drip → $50 per YES reply
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="outline" onClick={handleRunDrip} disabled={running}
              style={{ borderColor: "#1e3a5f", color: "#94a3b8" }}>
              {running ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
              <span style={{ marginLeft: 6 }}>Run Drip Now</span>
            </Button>
            <Button size="sm" onClick={() => setShowNewCampaign(!showNewCampaign)}
              style={{ background: "#00d4ff", color: "#0a1628", fontWeight: 700 }}>
              <Plus size={14} /><span style={{ marginLeft: 6 }}>New Campaign</span>
            </Button>
          </div>
        </div>

        {/* New Campaign Form */}
        {showNewCampaign && (
          <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: "#00d4ff", fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>New Campaign</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>CONTRACTOR *</label>
                <select value={newForm.contractor_id} onChange={e => setNewForm(f => ({ ...f, contractor_id: e.target.value }))}
                  style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 14 }}>
                  <option value="">Select contractor…</option>
                  {contractors?.map((c: any) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>CAMPAIGN NAME *</label>
                <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="April 2026 Dead Leads" style={{ background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0" }} />
              </div>
              <div>
                <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>TRADE</label>
                <Input value={newForm.trade} onChange={e => setNewForm(f => ({ ...f, trade: e.target.value }))}
                  placeholder="HVAC, Plumbing…" style={{ background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0" }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                CONTACTS * — one per line: <span style={{ color: "#94a3b8" }}>phone, name (name optional)</span>
              </label>
              <textarea
                value={newForm.contacts}
                onChange={e => setNewForm(f => ({ ...f, contacts: e.target.value }))}
                placeholder={"3135551234, John Smith\n2485557890, Sarah Jones\n3135559999"}
                rows={6}
                style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={handleCreate} disabled={creating} style={{ background: "#00d4ff", color: "#0a1628", fontWeight: 700 }}>
                {creating ? "Creating…" : "Create Campaign"}
              </Button>
              <Button variant="outline" onClick={() => setShowNewCampaign(false)} style={{ borderColor: "#1e3a5f", color: "#94a3b8" }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Global Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Contacts", value: globalStats.total, color: "#94a3b8" },
            { label: "In Drip", value: globalStats.in_drip, color: "#60a5fa" },
            { label: "Positive Replies", value: globalStats.positive, color: "#10b981" },
            { label: "Revenue Est.", value: `$${globalStats.positive * 50}`, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ color: s.color, fontSize: 24, fontWeight: 900 }}>{s.value}</div>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Activity Feed */}
        {recentActivity.length > 0 && (
          <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 8 }}>
              {hasRecentActivity && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 2s infinite" }} />}
              <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}>Recent Positive Replies</span>
              <span style={{ color: "#64748b", fontSize: 12, marginLeft: "auto" }}>Last {recentActivity.length} across all campaigns</span>
            </div>
            {recentActivity.map((c: any) => {
              const biz = c.dead_lead_campaigns?.contractor_clients?.business_name || "Unknown";
              const camp = c.dead_lead_campaigns?.name || "Unknown campaign";
              return (
                <div key={c.id} style={{ padding: "10px 14px", borderTop: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16 }}>♻️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{c.name || c.phone}</span>
                    <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>{biz} · {camp}</span>
                  </div>
                  <span style={{ color: "#10b981", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>+$50</span>
                  <span style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(c.contractor_notified_at)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Campaigns list */}
        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          {!campaigns?.length && (
            <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: 32, textAlign: "center", color: "#64748b" }}>
              No campaigns yet. Click "New Campaign" to upload a contractor's dead lead list.
            </div>
          )}
          {campaigns?.map((camp: any) => (
            <div key={camp.id}
              onClick={() => setSelectedCampaignId(selectedCampaignId === camp.id ? null : camp.id)}
              style={{ background: "#0f2342", border: `1px solid ${selectedCampaignId === camp.id ? "#00d4ff" : "#1e3a5f"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{camp.name}</span>
                  <span style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>{camp.contractor_clients?.business_name}</span>
                  {camp.trade && <span style={{ color: "#00d4ff", fontSize: 12, marginLeft: 8 }}>· {camp.trade}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${camp.status === "active" ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
                    {camp.status}
                  </span>
                  {selectedCampaignId === camp.id ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact detail table */}
        {selectedCampaignId && contacts && (
          <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
            {/* Stats row */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e3a5f", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Pending: <strong style={{ color: "#fff" }}>{stats.pending}</strong></span>
              <span style={{ color: "#64748b", fontSize: 13 }}>In drip: <strong style={{ color: "#60a5fa" }}>{stats.in_drip}</strong></span>
              <span style={{ color: "#64748b", fontSize: 13 }}>Positive: <strong style={{ color: "#10b981" }}>{stats.positive}</strong></span>
              <span style={{ color: "#64748b", fontSize: 13 }}>Review req: <strong style={{ color: "#f59e0b" }}>{stats.review}</strong></span>
              <span style={{ color: "#64748b", fontSize: 13 }}>Opted out: <strong style={{ color: "#94a3b8" }}>{stats.opted_out}</strong></span>
              <span style={{ color: "#64748b", fontSize: 13 }}>Revenue est: <strong style={{ color: "#10b981" }}>${stats.positive * 50}</strong></span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0a1628" }}>
                  {["Name", "Phone", "Status", "Reply", "Sent"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #1e3a5f" }}>
                    <td style={{ padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>{c.name || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 13, fontFamily: "monospace" }}>{c.phone}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] || "bg-gray-800 text-gray-400"}`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.reply_text || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>
                      {c.drip1_sent_at ? new Date(c.drip1_sent_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
