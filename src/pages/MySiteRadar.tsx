import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Copy, Check, Sparkles, Download, ArrowUpRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";

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
  const [exporting, setExporting] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem("siteradar_upsell_dismissed_v1");
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!ts || isNaN(ts)) return false;
    // resets after 14 days
    return Date.now() - ts < 14 * 24 * 60 * 60 * 1000;
  });
  const [icpKeywords, setIcpKeywords] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("siteradar_icp_keywords_v1") || "";
  });
  const [icpDraft, setIcpDraft] = useState("");
  const [icpEditing, setIcpEditing] = useState(false);
  const saveIcp = (v: string) => {
    setIcpKeywords(v);
    localStorage.setItem("siteradar_icp_keywords_v1", v);
    setIcpEditing(false);
  };
  const icpTokens = useMemo(
    () => icpKeywords.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    [icpKeywords]
  );
  const isIcpMatch = (e: { company_name?: string | null; city?: string | null; page_visited?: string | null }) => {
    if (icpTokens.length === 0) return false;
    const haystack = `${e.company_name || ""} ${e.city || ""} ${e.page_visited || ""}`.toLowerCase();
    return icpTokens.some((t) => haystack.includes(t));
  };
  const icpMatchCount = useMemo(() => events.filter(isIcpMatch).length, [events, icpTokens]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const companyDetail = useMemo(() => {
    if (!selectedCompany) return null;
    const ces = events.filter((e) => e.company_name === selectedCompany);
    const pages = [...new Set(ces.map((e) => e.page_visited).filter(Boolean))] as string[];
    return {
      name: selectedCompany,
      city: ces[0]?.city ?? null,
      pages,
      visitCount: ces.length,
      firstSeen: ces[ces.length - 1]?.created_at ?? null,
      lastSeen: ces[0]?.created_at ?? null,
      icpMatch: ces.some(isIcpMatch),
      latestEventId: ces[0]?.id ?? null,
    };
  }, [selectedCompany, events, icpTokens]);

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

  const dismissBanner = () => {
    localStorage.setItem("siteradar_upsell_dismissed_v1", String(Date.now()));
    setBannerDismissed(true);
  };

  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExport = async () => {
    if (!client) return;
    setExporting(true);
    try {
      const fromIso = new Date(exportFrom); fromIso.setHours(0, 0, 0, 0);
      const toIso = new Date(exportTo); toIso.setHours(23, 59, 59, 999);
      const { data, error: qErr } = await supabase
        .from("crm_visitor_events")
        .select("created_at, company_name, city, region, country, page_visited, referrer, ip_address, is_business, visit_count")
        .eq("client_id", client.id)
        .gte("created_at", fromIso.toISOString())
        .lte("created_at", toIso.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000);
      if (qErr) throw qErr;
      const rows = data || [];
      if (rows.length === 0) {
        alert("No events in the selected date range.");
        return;
      }
      const header = ["created_at", "company_name", "city", "region", "country", "page_visited", "referrer", "ip_address", "is_business", "visit_count"];
      const lines = [header.join(",")];
      rows.forEach((r: any) => {
        lines.push(header.map((k) => csvEscape(r[k])).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `siteradar-events-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
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
              {/* Upsell banner */}
              {!bannerDismissed && (
                <div style={{ background: "linear-gradient(135deg,#0a1628,#0d2547)", border: "1px solid #00d4ff66", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 4px" }}>
                      {client.visitor_script_key ? "🚀 Upgrade" : "📡 Activate"}
                    </p>
                    <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {client.visitor_script_key
                        ? "Bundle SiteRadar with Lead Capture for $99/mo (save $49/mo)"
                        : "Start tracking visitors today — $49/mo"}
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0" }}>
                      {client.visitor_script_key
                        ? "Identify visitors + capture missed-call leads in one bundle."
                        : "See which companies visit your site — install in 60 seconds."}
                    </p>
                  </div>
                  <a
                    href={client.visitor_script_key ? "/site-radar?bundle=1" : "/site-radar"}
                    style={{ background: "#00d4ff", color: "#0a1628", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                  >
                    {client.visitor_script_key ? "Upgrade" : "Start SiteRadar"} <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <button
                    onClick={dismissBanner}
                    aria-label="Dismiss"
                    style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <OnboardingChecklist
                product="SiteRadar"
                steps={[
                  { id: "auth", label: "Dashboard link verified", done: !!client, hint: "Open from your welcome email." },
                  { id: "snippet", label: "Tracking snippet installed", done: !!client?.visitor_script_key, hint: "Paste the script tag into your site." },
                  { id: "events", label: "First visitor tracked", done: events.length > 0, hint: "Visit your own site to test." },
                  { id: "company", label: "First business identified", done: businessesIdentified > 0, hint: "Company-level reveal happens automatically." },
                ]}
              />
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
                      <li
                        key={c.name}
                        onClick={() => setSelectedCompany(c.name)}
                        style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e3a5f", cursor: "pointer" }}
                      >
                        <span style={{ color: "#00d4ff", fontSize: 14, textDecoration: "underline", textDecorationStyle: "dotted" }}>{c.name} {c.city && <span style={{ color: "#64748b", textDecoration: "none" }}>· {c.city}</span>}</span>
                        <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: 14 }}>{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ICP Filter (Pro) */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={labelStyle}>🎯 ICP filter <span style={{ color: "#fbbf24", fontSize: 9, marginLeft: 6, padding: "2px 6px", background: "#fbbf2422", borderRadius: 4, letterSpacing: 1 }}>PRO</span></p>
                    <p style={{ color: "#64748b", fontSize: 11, margin: "4px 0 0" }}>
                      Match visitors against your ideal customer profile. Comma-separated keywords (industry, city, page).
                    </p>
                  </div>
                  {icpKeywords && !icpEditing && (
                    <span style={{ background: "#10b98122", color: "#34d399", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                      {icpMatchCount} matches
                    </span>
                  )}
                </div>
                {icpEditing ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <input
                      autoFocus
                      value={icpDraft}
                      onChange={(e) => setIcpDraft(e.target.value)}
                      placeholder="hvac, manufacturing, troy, /pricing"
                      style={{ flex: 1, minWidth: 220, background: "#030711", border: "1px solid #1e3a5f", color: "#e2e8f0", padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
                    />
                    <button onClick={() => saveIcp(icpDraft)} style={{ background: "#00d4ff", color: "#0a1628", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setIcpEditing(false)} style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8", borderRadius: 6, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {icpTokens.length === 0 ? (
                      <span style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No ICP set — visitors won't be flagged.</span>
                    ) : (
                      icpTokens.map((t) => (
                        <span key={t} style={{ background: "#0099cc22", color: "#00d4ff", fontSize: 11, padding: "3px 9px", borderRadius: 999, fontWeight: 600 }}>{t}</span>
                      ))
                    )}
                    <button onClick={() => { setIcpDraft(icpKeywords); setIcpEditing(true); }} style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#00d4ff", borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>
                      {icpKeywords ? "Edit" : "Set ICP"}
                    </button>
                  </div>
                )}
              </div>

              {/* Live feed */}
              <div style={cardStyle}>
                <p style={labelStyle}>Live visitor feed</p>
                {events.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 0" }}>Waiting for visitors…</p>
                ) : (
                  <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", maxHeight: 360, overflowY: "auto" }}>
                    {events.map((e) => {
                      const match = isIcpMatch(e);
                      return (
                        <li key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 10, background: match ? "#10b9810d" : "transparent", borderLeft: match ? "3px solid #34d399" : "3px solid transparent", paddingLeft: match ? 8 : 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.company_name ? "#34d399" : "#475569", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#e2e8f0", fontSize: 13, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {e.page_visited || "—"}
                              {match && <span style={{ marginLeft: 8, fontSize: 9, padding: "2px 6px", background: "#10b98133", color: "#34d399", borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>ICP</span>}
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
                      );
                    })}
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

              {/* Export events */}
              <div style={cardStyle}>
                <p style={labelStyle}>Export events</p>
                <p style={{ color: "#64748b", fontSize: 12, margin: "6px 0 12px" }}>
                  Download a CSV of all visitor events in the date range below.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>From</span>
                    <input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                      style={{ background: "#030711", border: "1px solid #1e3a5f", color: "#e2e8f0", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>To</span>
                    <input
                      type="date"
                      value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                      style={{ background: "#030711", border: "1px solid #1e3a5f", color: "#e2e8f0", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                    />
                  </label>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    style={{ background: "#00d4ff", color: "#0a1628", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: exporting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: exporting ? 0.6 : 1 }}
                  >
                    <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
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
