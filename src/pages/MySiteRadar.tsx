import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Copy, Check, Sparkles, Download, ArrowUpRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ManageBillingButton from "@/components/billing/ManageBillingButton";

type Client = {
  id: string;
  business_name: string;
  email: string;
  visitor_script_key: string | null;
};

type Event = {
  id: string;
  client_id: string;
  page_visited: string | null;
  company_name: string | null;
  city: string | null;
  created_at: string;
};

export default function MySiteRadar() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [client, setClient] = useState<Client | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setError("Missing access token. Use the link from your welcome email."); setLoading(false); return; }
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: c, error: ce } = await supabase
        .from("field_crm_clients")
        .select("id,business_name,email,visitor_script_key")
        .eq("dispatch_token", token)
        .maybeSingle();
      if (ce || !c) { setError("Invalid or expired link."); setLoading(false); return; }
      setClient(c as Client);
      const { data: ev } = await supabase
        .from("crm_visitor_events")
        .select("id,client_id,page_visited,company_name,city,created_at")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setEvents((ev || []) as Event[]);
      setLoading(false);
      channel = supabase
        .channel(`siteradar-${c.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_visitor_events", filter: `client_id=eq.${c.id}` }, (payload) => {
          setEvents((prev) => [payload.new as Event, ...prev].slice(0, 100));
        })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [token]);

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.created_at) >= start).length;
  }, [events]);

  const businessesIdentified = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Set(events.filter((e) => e.company_name && new Date(e.created_at) >= today).map((e) => e.company_name)).size;
  }, [events]);

  const topCompanies = useMemo(() => {
    const map = new Map<string, { name: string; city: string | null; count: number }>();
    for (const e of events) {
      if (!e.company_name) continue;
      const key = e.company_name;
      const cur = map.get(key) || { name: e.company_name, city: e.city, count: 0 };
      cur.count++;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [events]);

  const lastEvent = events[0];
  const healthy = lastEvent && Date.now() - new Date(lastEvent.created_at).getTime() < 1000 * 60 * 60 * 24;

  const snippet = client?.visitor_script_key
    ? `<script async src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visitor-identify?key=${client.visitor_script_key}"></script>`
    : "";

  const enrich = async (eventId: string) => {
    await supabase.functions.invoke("enrich-visitor", { body: { event_id: eventId } });
  };

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <Helmet><title>SiteRadar — Your Dashboard | Detroit Web Agency</title></Helmet>
      <div style={{ minHeight: "100vh", background: "#030711", fontFamily: "-apple-system,sans-serif", padding: "32px 16px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 8px" }}>📡 SITE RADAR</p>
          <h1 style={{ color: "#fff", fontSize: 26, margin: "0 0 4px" }}>Who's visiting your site</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 24px" }}>{client?.business_name ?? "Loading…"}</p>

          {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
          {error && (
            <div style={{ background: "#1e1a2e", border: "1px solid #7c3aed", borderRadius: 12, padding: 24 }}>
              <p style={{ color: "#f87171", margin: 0 }}>{error}</p>
            </div>
          )}

          {client && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Health + stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Stat label="Today's visitors" value={todayCount} />
                <Stat label="Businesses identified" value={businessesIdentified} />
                <div style={cardStyle}>
                  <p style={labelStyle}>Tracking health</p>
                  <p style={{ color: healthy ? "#34d399" : "#f87171", fontWeight: 700, fontSize: 16, margin: "8px 0 0" }}>
                    {healthy ? "🟢 Active" : "🔴 No data 24h"}
                  </p>
                </div>
              </div>

              {/* Top companies */}
              <div style={cardStyle}>
                <p style={labelStyle}>Top 5 companies</p>
                {topCompanies.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 0" }}>No identified businesses yet.</p>
                ) : (
                  <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                    {topCompanies.map((c) => (
                      <li key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e3a5f" }}>
                        <span style={{ color: "#e2e8f0", fontSize: 14 }}>{c.name} {c.city && <span style={{ color: "#64748b" }}>· {c.city}</span>}</span>
                        <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 14 }}>{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Live feed */}
              <div style={cardStyle}>
                <p style={labelStyle}>Live visitor feed</p>
                {events.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 0" }}>Waiting for visitors…</p>
                ) : (
                  <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", maxHeight: 360, overflowY: "auto" }}>
                    {events.map((e) => (
                      <li key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.company_name ? "#34d399" : "#475569", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: "#e2e8f0", fontSize: 13, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {e.page_visited || "—"}
                          </p>
                          <p style={{ color: "#64748b", fontSize: 11, margin: "2px 0 0" }}>
                            {e.company_name || "Unknown visitor"} · {new Date(e.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        {!e.company_name && (
                          <button onClick={() => enrich(e.id)} style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#00d4ff", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Sparkles className="h-3 w-3" /> Enrich
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Snippet */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={labelStyle}>Tracking snippet</p>
                  <button onClick={copySnippet} style={{ background: "#00d4ff", color: "#0a1628", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>
                <pre style={{ background: "#030711", color: "#94a3b8", fontSize: 11, padding: 12, borderRadius: 8, marginTop: 10, overflowX: "auto" }}>{snippet}</pre>
                <p style={{ color: "#64748b", fontSize: 11, margin: "8px 0 0" }}>Paste before &lt;/body&gt; on every page.</p>
              </div>

              <div style={{ marginTop: 8 }}>
                <ManageBillingButton email={client.email} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const cardStyle = { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20 } as const;
const labelStyle = { color: "#94a3b8", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 1, margin: 0 };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={cardStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={{ color: "#00d4ff", fontSize: 28, fontWeight: 800, margin: "8px 0 0" }}>{value}</p>
    </div>
  );
}
