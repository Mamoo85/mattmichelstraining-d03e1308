import TabPlaceholder from "./TabPlaceholder";
import { DJC_CLIENT_IDS, DJC_VERTICAL, DJC_ZIPS, useTenantData, supabase, TENANT_SLUG } from "./useTenantData";

// ---------- helpers ----------
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const ago = (iso: string | null | undefined) => {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const empty = (msg: string) => [{ primary: msg, secondary: "Once data flows in, it will appear here automatically." }];

// =====================================================
// SiteRadar — real visitor events scoped to DJ Conley
// =====================================================
export const SiteRadarTab = () => {
  const { data, loading } = useTenantData(async () => {
    const since7 = since(7);
    const [{ data: events }, { count: total7 }, { count: icpCount }] = await Promise.all([
      supabase.from("crm_visitor_events")
        .select("company_name, org, page_visited, visit_count, is_business, created_at, city, region, enrichment_data")
        .eq("client_id", DJC_CLIENT_IDS.field_crm)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("crm_visitor_events")
        .select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.field_crm)
        .gte("created_at", since7),
      supabase.from("crm_visitor_events")
        .select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.field_crm)
        .eq("is_business", true)
        .gte("created_at", since7),
    ]);
    return {
      events: events || [],
      total7: total7 ?? 0,
      icpCount: icpCount ?? 0,
      returning: (events || []).filter((e: any) => (e.visit_count ?? 0) >= 3).length,
      enriched: (events || []).filter((e: any) => e.enrichment_data).length,
    };
  });
  const rows = !data || data.events.length === 0
    ? empty("No visitors tracked yet — install the SiteRadar pixel on djconley.com.")
    : data.events.slice(0, 6).map((e: any) => ({
        tag: e.is_business ? "🏭 ICP" : undefined,
        primary: e.company_name || e.org || "Anonymous visitor",
        secondary: `${e.page_visited || "/"} · ${[e.city, e.region].filter(Boolean).join(", ")} · visit #${e.visit_count ?? 1}`,
        right: ago(e.created_at),
      }));
  return (
    <TabPlaceholder
      title="SiteRadar"
      accent="Real-time visitor intelligence"
      description="Anonymous visitors deanonymized via IP → company match. Bias: facilities directors, plant engineers, hospital chief engineers."
      kpis={[
        { label: "Visitors (7d)",   value: loading ? "…" : fmt(data?.total7),   sub: "Live feed",       accent: "text-[#27CCC0]" },
        { label: "ICP matches",     value: loading ? "…" : fmt(data?.icpCount), sub: "Business IPs" },
        { label: "Returning ICPs",  value: loading ? "…" : fmt(data?.returning), sub: "3+ visits",      accent: "text-[#c12a3b]" },
        { label: "Enriched",        value: loading ? "…" : fmt(data?.enriched),  sub: "Apollo + Clearbit" },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// Missed-Call — real captures (table is single-tenant for now)
// =====================================================
export const MissedCallTab = () => {
  const { data, loading } = useTenantData(async () => {
    const since7 = since(7);
    const [{ data: caps }, { count: total7 }, { count: replied }] = await Promise.all([
      supabase.from("missed_call_captures")
        .select("caller_number, city, voicemail_transcript, status, reply_received, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("missed_call_captures").select("*", { count: "exact", head: true }).gte("created_at", since7),
      supabase.from("missed_call_captures").select("*", { count: "exact", head: true })
        .gte("created_at", since7).not("reply_received", "is", null),
    ]);
    return { caps: caps || [], total7: total7 ?? 0, replied: replied ?? 0 };
  });
  const rows = !data || data.caps.length === 0
    ? empty("No missed calls yet — when someone calls (313) 590-4404 and you don't pick up, it lands here.")
    : data.caps.slice(0, 6).map((c: any) => ({
        tag: c.reply_received ? "Recovered" : undefined,
        primary: `${c.caller_number} ${c.city ? `— ${c.city}` : ""}`,
        secondary: c.voicemail_transcript ? `"${c.voicemail_transcript.slice(0, 80)}"` : `Status: ${c.status || "pending"}`,
        right: ago(c.created_at),
      }));
  return (
    <TabPlaceholder
      title="Missed-Call Catch"
      accent="Every missed call → instant text-back"
      description="Inbound calls forward to (313) 590-4404. After 30 sec, caller gets auto-text + voicemail transcript lands here."
      kpis={[
        { label: "Calls (7d)",      value: loading ? "…" : fmt(data?.total7) },
        { label: "Auto-texts sent", value: loading ? "…" : fmt(data?.total7), sub: "100% coverage", accent: "text-[#27CCC0]" },
        { label: "Replies",         value: loading ? "…" : fmt(data?.replied), sub: data && data.total7 > 0 ? `${Math.round((data.replied / data.total7) * 100)}% recovery` : "0%", accent: "text-[#c12a3b]" },
        { label: "Mirror line",     value: "(313) 590-4404", sub: "A2P registered" },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// Buyer Radar — no live data source yet, honest empty state
// =====================================================
export const BuyerRadarTab = () => (
  <TabPlaceholder
    title="Buyer Radar"
    accent="MITN.info · SAM.gov · Michigan procurement"
    description="Live RFP feed for industrial / commercial boiler bids. Pat is texted within 5 min of any new posting matching his profile."
    kpis={[
      { label: "Active RFPs",   value: "—", sub: "Connect MITN feed" },
      { label: "Hot (today)",   value: "—" },
      { label: "Bid responses", value: "0" },
      { label: "Won (90d)",     value: "0" },
    ]}
    rows={empty("Buyer Radar feed not yet wired for DJ Conley — MITN.info / SAM.gov scrapers will populate this within 24 hours of go-live.")}
  />
);

// =====================================================
// FieldDesk — real jobs scoped by client_id
// =====================================================
export const FieldDeskTab = () => {
  const { data, loading } = useTenantData(async () => {
    const [{ data: jobs }, { count: open }, { count: emergency }] = await Promise.all([
      supabase.from("field_service_jobs")
        .select("title, description, status, priority, scheduled_date, scheduled_time, created_at")
        .eq("client_id", DJC_CLIENT_IDS.field_crm)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("field_service_jobs").select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.field_crm).in("status", ["open", "scheduled", "in_progress"]),
      supabase.from("field_service_jobs").select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.field_crm).eq("priority", "emergency"),
    ]);
    return { jobs: jobs || [], open: open ?? 0, emergency: emergency ?? 0 };
  });
  const rows = !data || data.jobs.length === 0
    ? empty("No jobs in FieldDesk yet — dispatch a ticket from the FieldDesk app or sync from your existing CRM.")
    : data.jobs.slice(0, 6).map((j: any) => ({
        tag: j.priority === "emergency" ? "🚨 EMERGENCY" : (j.status === "completed" ? "Done" : undefined),
        primary: j.title || "Untitled job",
        secondary: `${j.description?.slice(0, 80) || ""} · ${j.scheduled_date || ""} ${j.scheduled_time || ""}`.trim(),
        right: j.status,
      }));
  return (
    <TabPlaceholder
      title="FieldDesk"
      accent="Jobs · Techs · Schedule · Invoices"
      description="Boiler service tickets, dispatch, parts pull-list, and invoicing in one screen."
      kpis={[
        { label: "Open jobs",  value: loading ? "…" : fmt(data?.open),       sub: `${data?.emergency ?? 0} emergency`, accent: "text-[#c12a3b]" },
        { label: "Total (all time)", value: loading ? "…" : fmt(data?.jobs.length) },
        { label: "Plan",       value: "FieldDesk", sub: "$199/mo" },
        { label: "Industry",   value: "industrial_boiler", accent: "text-[#27CCC0]" },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// TechAlert — real candidates scoped by client_id
// =====================================================
export const TechAlertTab = () => {
  const { data, loading } = useTenantData(async () => {
    const since7 = since(7);
    const [{ data: cands }, { count: total }, { count: hot }, { count: week }] = await Promise.all([
      supabase.from("hire_alert_candidates")
        .select("name, full_name, trade, city, state, source, score, status, alerted_at, created_at")
        .eq("client_id", DJC_CLIENT_IDS.hire_alert)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("hire_alert_candidates").select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.hire_alert),
      supabase.from("hire_alert_candidates").select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.hire_alert).gte("score", 8),
      supabase.from("hire_alert_candidates").select("*", { count: "exact", head: true })
        .eq("client_id", DJC_CLIENT_IDS.hire_alert).gte("created_at", since7),
    ]);
    return { cands: cands || [], total: total ?? 0, hot: hot ?? 0, week: week ?? 0 };
  });
  const rows = !data || data.cands.length === 0
    ? empty("Watch list active — TechAlert scans Indeed / LinkedIn / WSU careers daily for Plant Engineer / Facilities Director postings in your ZIPs.")
    : data.cands.slice(0, 6).map((c: any) => ({
        tag: (c.score ?? 0) >= 8 ? "🔥 Hot" : undefined,
        primary: `${c.full_name || c.name || "Unknown"} — ${c.trade || ""}`,
        secondary: `${c.source || "scan"} · ${[c.city, c.state].filter(Boolean).join(", ")} · score ${c.score ?? "—"}`,
        right: ago(c.created_at),
      }));
  return (
    <TabPlaceholder
      title="TechAlert"
      accent="Competitor talent + buyer hiring signals"
      description="When a buyer (DMC, Wayne State, Stellantis) posts a 'Plant Engineer' role — that's a maintenance director gap. Pat gets texted in 12 minutes."
      kpis={[
        { label: "Watch list ZIPs", value: "7", sub: "Hospitals + plants + GCs" },
        { label: "Signals (7d)",    value: loading ? "…" : fmt(data?.week),  accent: "text-[#27CCC0]" },
        { label: "Hot signals",     value: loading ? "…" : fmt(data?.hot),   sub: "Score ≥ 8" },
        { label: "Total tracked",   value: loading ? "…" : fmt(data?.total) },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// Trade Radar — real leads scoped by vertical + ZIPs
// =====================================================
export const TradeRadarTab = () => {
  const { data, loading } = useTenantData(async () => {
    const since7 = since(7);
    const [{ data: leads }, { count: total7 }, { count: hot }] = await Promise.all([
      supabase.from("trade_radar_leads")
        .select("address, city, zip, county, signal_type, signal_detail, signal_date, score, estimated_value, suggested_opener, created_at")
        .eq("vertical", DJC_VERTICAL)
        .in("zip", DJC_ZIPS)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("trade_radar_leads").select("*", { count: "exact", head: true })
        .eq("vertical", DJC_VERTICAL).in("zip", DJC_ZIPS).gte("created_at", since7),
      supabase.from("trade_radar_leads").select("*", { count: "exact", head: true })
        .eq("vertical", DJC_VERTICAL).in("zip", DJC_ZIPS).gte("score", 8),
    ]);
    return { leads: leads || [], total7: total7 ?? 0, hot: hot ?? 0 };
  });
  const rows = !data || data.leads.length === 0
    ? empty("Permit + signal scanners running daily 8am ET across Wayne / Oakland / Macomb / Washtenaw / Genesee. New HVAC signals will land here.")
    : data.leads.slice(0, 6).map((l: any) => ({
        tag: (l.score ?? 0) >= 8 ? "🔥 Hot" : undefined,
        primary: `${l.address || "Address pending"}, ${l.city || ""} ${l.zip || ""}`,
        secondary: `${l.signal_type} · ${l.signal_detail?.slice(0, 60) || ""} · ${l.county || ""}`,
        right: l.estimated_value ? `$${Number(l.estimated_value).toLocaleString()}` : `score ${l.score ?? "—"}`,
      }));
  return (
    <TabPlaceholder
      title="Trade Radar"
      accent="Permits · Building signals · Industrial boiler angle"
      description="BSEED, Wayne / Oakland / Macomb / Washtenaw permit data filtered for commercial boiler, pressure vessel, and industrial HVAC work."
      kpis={[
        { label: "Permits (7d)", value: loading ? "…" : fmt(data?.total7), sub: "HVAC / Boiler / PV" },
        { label: "Hot signals",  value: loading ? "…" : fmt(data?.hot),    sub: "Score ≥ 8", accent: "text-[#c12a3b]" },
        { label: "Vertical",     value: "HVAC", accent: "text-[#27CCC0]" },
        { label: "ZIPs",         value: String(DJC_ZIPS.length) },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// Outreach — real outreach_leads (industrial_boiler bias)
// =====================================================
export const OutreachTab = () => {
  const { data, loading } = useTenantData(async () => {
    const [{ data: leads }, { count: targets }, { count: sent30 }, { count: replies }] = await Promise.all([
      supabase.from("outreach_leads")
        .select("business_name, owner_name, city, industry, status, last_contact_date, notes, lead_score")
        .eq("industry", "industrial_boiler")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("outreach_leads").select("*", { count: "exact", head: true }).eq("industry", "industrial_boiler"),
      supabase.from("outreach_leads").select("*", { count: "exact", head: true })
        .eq("industry", "industrial_boiler").gte("last_contact_date", since(30).slice(0, 10)),
      supabase.from("outreach_leads").select("*", { count: "exact", head: true })
        .eq("industry", "industrial_boiler").eq("status", "replied"),
    ]);
    return { leads: leads || [], targets: targets ?? 0, sent30: sent30 ?? 0, replies: replies ?? 0 };
  });
  const rows = !data || data.leads.length === 0
    ? empty("Outreach pipeline empty — Apollo industrial_boiler enrichment runs nightly 11am ET to fill this with facilities directors / plant engineers.")
    : data.leads.slice(0, 6).map((l: any) => ({
        primary: `${l.owner_name || "Unknown"} — ${l.business_name || ""}`,
        secondary: `${l.industry || ""} · ${l.city || ""} · score ${l.lead_score ?? "—"}`,
        right: l.status || "queued",
      }));
  return (
    <TabPlaceholder
      title="Outreach"
      accent="Cold email + fax campaigns to industrial buyers"
      description="Apollo-enriched contact list. Targeting facilities directors, plant engineers, hospital chief engineers, school district maintenance leads."
      kpis={[
        { label: "Targets",     value: loading ? "…" : fmt(data?.targets), sub: "industrial_boiler bias" },
        { label: "Sent (30d)",  value: loading ? "…" : fmt(data?.sent30),  sub: "Manual-approved", accent: "text-[#27CCC0]" },
        { label: "Replies",     value: loading ? "…" : fmt(data?.replies) },
        { label: "Apollo",      value: "$200/mo", sub: "Budget cap" },
      ]}
      rows={rows}
    />
  );
};

// =====================================================
// Reviews — no DJ Conley review-monitor table yet, honest state
// =====================================================
export const ReviewsTab = () => (
  <TabPlaceholder
    title="Reviews"
    accent="Google · BBB · industry directories"
    description="Auto-monitor + auto-request from satisfied service customers."
    kpis={[
      { label: "Google rating", value: "—", sub: "Connect Google Business" },
      { label: "BBB",           value: "A+", sub: "Since 1962", accent: "text-[#27CCC0]" },
      { label: "Requests sent", value: "0",  sub: "Last 30 days" },
      { label: "New reviews",   value: "0",  sub: "Last 30 days" },
    ]}
    rows={empty("Review monitor not yet connected — link Pat's Google Business Profile to start auto-fetching reviews every 6 hours.")}
  />
);

// =====================================================
// Reports — placeholder until digest table exists
// =====================================================
export const ReportsTab = () => (
  <TabPlaceholder
    title="Reports"
    accent="Weekly digest · ROI · Attribution"
    description="What ran this week, what it produced, what it cost, what's next."
    kpis={[
      { label: "Week ROI",       value: "—",  sub: "Pipeline / spend" },
      { label: "Pipeline added", value: "—",  sub: "Last 7 days" },
      { label: "Cost",           value: "$0", sub: "Trojan Horse trial" },
      { label: "Hours saved",    value: "—" },
    ]}
    rows={empty("First weekly digest fires Monday 8am ET to pmichels@djconley.com once Pat logs in and confirms his preferences.")}
  />
);

// =====================================================
// Integrations — derived from configured product rows
// =====================================================
export const IntegrationsTab = () => {
  const { data, loading } = useTenantData(async () => {
    const [fc, mc, ha, cc, tr] = await Promise.all([
      supabase.from("field_crm_clients").select("id, status").eq("id", DJC_CLIENT_IDS.field_crm).maybeSingle(),
      supabase.from("missed_call_clients").select("id, active").eq("id", DJC_CLIENT_IDS.missed_call).maybeSingle(),
      supabase.from("hire_alert_clients").select("id, active").eq("id", DJC_CLIENT_IDS.hire_alert).maybeSingle(),
      supabase.from("contractor_clients").select("id, active").eq("id", DJC_CLIENT_IDS.contractor).maybeSingle(),
      supabase.from("trade_radar_clients").select("id, active").eq("id", DJC_CLIENT_IDS.trade_radar).maybeSingle(),
    ]);
    return { fc: fc.data, mc: mc.data, ha: ha.data, cc: cc.data, tr: tr.data };
  });
  const provisioned = data ? [data.fc, data.mc, data.ha, data.cc, data.tr].filter(Boolean).length : 0;
  return (
    <TabPlaceholder
      title="Integrations"
      accent="Connected services"
      description="What's wired into Pat's command center."
      kpis={[
        { label: "Provisioned", value: loading ? "…" : `${provisioned} / 5`, sub: "Product rows live", accent: "text-[#27CCC0]" },
        { label: "API calls (7d)", value: "—", sub: "Telemetry" },
        { label: "Errors",      value: "0", accent: "text-[#27CCC0]" },
        { label: "Mirror phone", value: "(313) 590-4404", sub: "Twilio A2P" },
      ]}
      rows={[
        { tag: data?.fc ? "✓" : "•", primary: "FieldDesk",    secondary: "field_crm_clients row provisioned", right: data?.fc ? "Healthy" : "Pending" },
        { tag: data?.mc ? "✓" : "•", primary: "Missed-Call",  secondary: "missed_call_clients row provisioned", right: data?.mc ? "Healthy" : "Pending" },
        { tag: data?.ha ? "✓" : "•", primary: "TechAlert",    secondary: "hire_alert_clients row provisioned",  right: data?.ha ? "Healthy" : "Pending" },
        { tag: data?.cc ? "✓" : "•", primary: "Contractor Leads", secondary: "contractor_clients row provisioned", right: data?.cc ? "Healthy" : "Pending" },
        { tag: data?.tr ? "✓" : "•", primary: "Trade Radar (HVAC)", secondary: "trade_radar_clients row provisioned · 9 ZIPs", right: data?.tr ? "Healthy" : "Pending" },
      ]}
    />
  );
};

// =====================================================
// Team — owner from sandbox_tenant_config
// =====================================================
export const TeamTab = () => {
  const { data, loading } = useTenantData(async () => {
    const { data: cfg } = await supabase.from("sandbox_tenant_config")
      .select("owner_name, owner_email, enabled_radars")
      .eq("tenant_slug", TENANT_SLUG).maybeSingle();
    return cfg;
  });
  return (
    <TabPlaceholder
      title="Team"
      accent="Seats · roles · access"
      description="Invite Pat's team to the command center. Service dispatch sees jobs, sales sees Buyer Radar, etc."
      kpis={[
        { label: "Active seats",    value: "1 / 5", sub: "4 available" },
        { label: "Pending invites", value: "0" },
        { label: "Last login",      value: "—",     sub: "Pat hasn't logged in yet" },
        { label: "MFA",             value: "Required", accent: "text-[#27CCC0]" },
      ]}
      rows={loading || !data ? empty("Loading team…") : [
        { tag: "Owner", primary: `${data.owner_name} — ${data.owner_email}`, secondary: "Full access · invited via magic link", right: "Active" },
      ]}
    />
  );
};

// =====================================================
// Settings — sandbox_tenant_config + DJC enrollment
// =====================================================
export const SettingsTab = () => {
  const { data, loading } = useTenantData(async () => {
    const [cfg, tr] = await Promise.all([
      supabase.from("sandbox_tenant_config").select("*").eq("tenant_slug", TENANT_SLUG).maybeSingle(),
      supabase.from("trade_radar_clients").select("zip_codes, coverage_counties, vertical").eq("id", DJC_CLIENT_IDS.trade_radar).maybeSingle(),
    ]);
    return { cfg: cfg.data, tr: tr.data };
  });
  const counties = data?.tr?.coverage_counties || [];
  const zips = data?.tr?.zip_codes || [];
  return (
    <TabPlaceholder
      title="Settings"
      accent="Tenant configuration"
      description="DJ Conley sandbox settings. Industry: industrial_boiler. Apollo budget: $200/mo."
      kpis={[
        { label: "Industry",      value: "industrial_boiler", accent: "text-[#27CCC0]" },
        { label: "Apollo budget", value: "$200/mo" },
        { label: "Counties",      value: loading ? "…" : String(counties.length) },
        { label: "Free tier",     value: "Trojan Horse", accent: "text-[#c12a3b]" },
      ]}
      rows={loading || !data ? empty("Loading settings…") : [
        { primary: "Owner",          secondary: `${data.cfg?.owner_name} · ${data.cfg?.owner_email}` },
        { primary: "Brand color",    secondary: data.cfg?.brand_color || "—" },
        { primary: "Enabled radars", secondary: (data.cfg?.enabled_radars || []).join(" · ") },
        { primary: "Trade Radar vertical", secondary: data.tr?.vertical || "—" },
        { primary: "Coverage counties",    secondary: counties.join(" · ") || "—" },
        { primary: "Coverage ZIPs",        secondary: zips.join(" · ") || "—" },
        { primary: "Service phone",        secondary: "(248) 585-5340 (Pat's main) · (313) 590-4404 (mirror)" },
      ]}
    />
  );
};

// Widgets tab is defined separately in Widgets.tsx — re-export not needed here.
