// ChannelOutreachTab — shared UI for Fax/Postcard/SMS sister modules.
// Mirrors the AdminDeadLeads "Prospecting Pipeline" tab (find prospects → 4 stat
// cards → trade/city picker → last-run feedback → pitched table → view-copy modal).
// Channel-specific config (offer key, label, cap, target field) flows in as props.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LeadEmailCell from "./outreach/LeadEmailCell";

export interface ChannelConfig {
  channel: "fax" | "postcard" | "sms";
  title: string;
  subtitle: string;
  offerKey: string;
  cap: number;
  costPerSend: string;
  targetLabel: string; // "Fax #" / "Address" / "Phone"
}

const TRADES = ["", "roofer", "HVAC contractor", "plumber", "electrician"];
const CITIES = [
  "", "🌎 All Michigan",
  "Detroit MI", "Warren MI", "Sterling Heights MI", "Troy MI", "Livonia MI", "Dearborn MI",
  "Royal Oak MI", "St. Clair Shores MI", "Macomb MI", "Ferndale MI", "Southfield MI",
  "Farmington Hills MI", "Novi MI", "Rochester Hills MI", "Pontiac MI", "Auburn Hills MI",
  "Birmingham MI", "Bloomfield Hills MI", "Canton MI", "Westland MI", "Taylor MI", "Wyandotte MI",
  "Monroe MI", "Ann Arbor MI", "Ypsilanti MI", "Saline MI", "Brighton MI", "Howell MI",
  "Lansing MI", "East Lansing MI", "Okemos MI", "Jackson MI", "Kalamazoo MI", "Battle Creek MI",
  "Portage MI", "Grand Rapids MI", "Wyoming MI", "Kentwood MI", "Holland MI", "Muskegon MI",
  "Grand Haven MI", "Saugatuck MI", "Flint MI", "Burton MI", "Saginaw MI", "Bay City MI",
  "Midland MI", "Mt. Pleasant MI", "Traverse City MI", "Petoskey MI", "Cadillac MI",
  "Alpena MI", "Marquette MI", "Sault Ste. Marie MI", "Escanaba MI", "Grosse Pointe MI",
];

export default function ChannelOutreachTab({ config }: { config: ChannelConfig }) {
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<any>(null);
  const [viewCopy, setViewCopy] = useState<{ name: string; copy: string; target: string } | null>(null);

  const { data: pipeline, refetch } = useQuery({
    queryKey: [`channel_pipeline_${config.channel}`],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("outreach_leads")
        .select("id, business_name, city, industry, phone, status, drip_campaign_status, created_at, enriched_email, enriched_email_source, enriched_email_confidence, gmail_sent_at")
        .eq("offer_pitched", config.offerKey)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const stats = {
    total: pipeline?.length || 0,
    responded: pipeline?.filter((r: any) => r.status === "Responded" || r.status === "responded").length || 0,
    active: pipeline?.filter((r: any) => r.status === "emailed" && !(r.drip_campaign_status?.d8_sent || r.drip_campaign_status?.d14_sent || r.drip_campaign_status?.d7_sent)).length || 0,
    complete: pipeline?.filter((r: any) => r.drip_campaign_status?.d8_sent || r.drip_campaign_status?.d14_sent || r.drip_campaign_status?.d7_sent || r.status === "drip_complete" || r.status === "closed").length || 0,
  };

  const handleRun = async () => {
    setRunning(true);
    setLast(null);
    try {
      const body: Record<string, string> = { channel: config.channel };
      if (trade) body.target_trade = trade;
      if (city) body.target_city = city;
      const { data, error } = await supabase.functions.invoke("channel-prospector", { body });
      if (error) throw error;
      setLast(data);
      if (data?.sent > 0) {
        toast.success(`${config.channel.toUpperCase()}: sent ${data.sent} of ${data.found} found`);
      } else {
        toast.message(`${config.channel.toUpperCase()}: 0 sent`, { description: data?.note || "Check errors below" });
      }
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Channel prospector failed");
      setLast({ ok: false, sent: 0, found: 0, errors: [e.message] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", padding: 16, color: "#e2e8f0", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>{config.title}</h2>
          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>{config.subtitle}</p>
        </div>

        {/* Find Prospects button */}
        <div style={{ marginBottom: 14 }}>
          <Button size="sm" onClick={handleRun} disabled={running}
            style={{ background: "#00d4ff", color: "#0a1628", fontWeight: 700 }}>
            {running ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            <span style={{ marginLeft: 6 }}>{running ? "Finding…" : "Find Prospects Now"}</span>
          </Button>
        </div>

        {/* 4 stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Sent", value: stats.total, color: "#94a3b8" },
            { label: "Replied Interested", value: stats.responded, color: "#10b981" },
            { label: "Still In Drip", value: stats.active, color: "#60a5fa" },
            { label: "Drip Complete", value: stats.complete, color: "#64748b" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ color: s.color, fontSize: 24, fontWeight: 900 }}>{s.value}</div>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trade / City picker */}
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Trade</label>
              <select value={trade} onChange={e => setTrade(e.target.value)} style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>
                {TRADES.map(t => <option key={t} value={t}>{t || "Auto-rotate"}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 4 }}>City</label>
              <select value={city} onChange={e => setCity(e.target.value)} style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>
                {CITIES.map(c => <option key={c} value={c}>{c || "Auto-rotate"}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>Cap: {config.cap}/day · Cost: {config.costPerSend}/send</div>

          {last && (
            <div style={{ marginTop: 12, padding: 10, background: "#0a1628", borderRadius: 6, border: "1px solid #1e3a5f" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ background: last.sent > 0 ? "#10b981" : "#f59e0b", color: "#0a1628", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, letterSpacing: 0.5 }}>
                  {last.sent > 0 ? "SENT" : "NO SENDS"}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {last.sent} sent · {last.found} found · {last.skipped || 0} skipped · {last.failed || 0} failed
                </span>
              </div>
              {last.note && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4 }}>⚠ {last.note}</div>}
              {last.errors?.length > 0 && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Errors: {last.errors.join(" · ")}</div>}
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                Daily cap: {last.sentAfter || 0}/{last.cap || config.cap} · combo: {last.combo?.trade}/{last.combo?.city}
              </div>
            </div>
          )}
        </div>

        {/* Pitched table */}
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e3a5f", fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Recent {config.channel.toUpperCase()} Sends
          </div>
          {!pipeline?.length ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
              No {config.channel} sends yet. Click "Find Prospects Now" to start.
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {pipeline.map((row: any) => (
                <div key={row.id} style={{ padding: "10px 14px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.business_name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {row.industry} · {row.city} · {new Date(row.created_at).toLocaleDateString()}
                    </div>
                    {row.drip_campaign_status?.channel_target && (
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>
                        {config.targetLabel}: {row.drip_campaign_status.channel_target}
                      </div>
                    )}
                    <LeadEmailCell
                      leadId={row.id}
                      businessName={row.business_name}
                      city={row.city}
                      industry={row.industry}
                      enrichedEmail={row.enriched_email}
                      enrichedSource={row.enriched_email_source}
                      enrichedConfidence={row.enriched_email_confidence}
                      gmailSentAt={row.gmail_sent_at}
                      onChange={() => refetch()}
                    />
                  </div>
                  <span style={{ background: row.status === "drip_complete" ? "#1e293b" : "#1e3a5f", color: "#94a3b8", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                    {row.status}
                  </span>
                  {row.drip_campaign_status?.copy && (
                    <Button size="sm" variant="ghost" onClick={() => setViewCopy({ name: row.business_name, copy: row.drip_campaign_status.copy, target: row.drip_campaign_status.channel_target || "" })}
                      style={{ color: "#00d4ff", padding: "4px 8px", height: "auto" }}>
                      <Eye size={12} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!viewCopy} onOpenChange={() => setViewCopy(null)}>
        <DialogContent style={{ background: "#0f2342", border: "1px solid #1e3a5f", color: "#e2e8f0", maxWidth: 600 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#00d4ff" }}>{config.channel.toUpperCase()} sent to {viewCopy?.name}</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontFamily: "monospace" }}>{config.targetLabel}: {viewCopy?.target}</div>
          <pre style={{ background: "#0a1628", padding: 14, borderRadius: 6, color: "#e2e8f0", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "inherit" }}>{viewCopy?.copy}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
