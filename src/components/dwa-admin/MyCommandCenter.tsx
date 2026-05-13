import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ExternalLink, Search, Shield, Maximize2, Minimize2,
  User, Target, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, ZoomIn,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Matt's "view as customer" command center.
 * - Each product has a customerPath (token-baked) AND prospectPath (public).
 * - Health checklist queries each *_clients table for Matt's enrollment.
 * - Iframe supports zoom (50–150 %) + fullscreen, both persisted.
 */

const MATT_EMAIL = "matt@detroitwebagent.com";
const E = encodeURIComponent(MATT_EMAIL);

const TR_TOKEN = (v: string) => `mtt-cmd-tr-${v}`;
const TALENT_TOK = "mtt-cmd-talent-dashtok000000000000";
const SITE_TOK = "mttcmdfielddeskdis000000000000ab";
const MISSED_TOK = "mttcmdmissedcalldash000000000abc";
const DEMAND_TOK = "mtt-cmd-demand-dashtok0000000000";
const BUYER_TOK = "mtt-cmd-buyer-dashtok00000000000";
const GROWTH_TOK = "mtt-cmd-growth-dashtok0000000000";
const CONTRACTOR_TOK = "mtt-cmd-contractor-roitok0000000";

type HealthCheck = () => Promise<boolean>;

type ProductTab = {
  id: string;
  group: "trade" | "core" | "intel" | "ops";
  label: string;
  emoji: string;
  customerPath: string;
  prospectPath: string;
  /** Returns true if Matt is enrolled (row exists). */
  healthCheck?: HealthCheck;
};

// --- enrollment checks ---------------------------------------------------
const checkTable = (
  table: string,
  filter: (q: any) => any,
): HealthCheck => async () => {
  try {
    const { count, error } = await filter(
      (supabase as any).from(table).select("*", { count: "exact", head: true }),
    );
    if (error) return false;
    return (count ?? 0) > 0;
  } catch { return false; }
};

const checkTradeRadar = (vertical: string) =>
  checkTable("trade_radar_clients", (q) => q.eq("email", MATT_EMAIL).eq("vertical", vertical));

// ------------------------------------------------------------------------

const tr = (v: string, label: string, emoji: string): ProductTab => ({
  id: `tr-${v}`,
  group: "trade",
  emoji,
  label,
  customerPath: `/my-${v.replace(/_/g, "-")}-radar?email=${E}&token=${TR_TOKEN(v)}`,
  prospectPath: `/${v.replace(/_/g, "-")}-radar`,
  healthCheck: checkTradeRadar(v),
});

const PRODUCTS: ProductTab[] = [
  tr("roofing",     "Roofing",      "🏠"),
  tr("hvac",        "HVAC",         "❄️"),
  tr("plumbing",    "Plumbing",     "🚿"),
  tr("electrical",  "Electrical",   "⚡"),
  tr("pest_control","Pest Control", "🐀"),
  tr("gutters",     "Gutters",      "🌧️"),
  tr("exterior",    "Exterior",     "🎨"),
  tr("tree",        "Tree",         "🌳"),
  tr("restoration", "Restoration",  "💧"),
  tr("demo_junk",   "Demo / Junk",  "🚧"),
  tr("foundation",  "Foundation",   "🧱"),

  { id: "mortgage",    group: "core",  emoji: "🏦", label: "Mortgage Radar",
    customerPath: `/my-mortgage-radar?email=${E}`, prospectPath: "/mortgage-radar",
    healthCheck: checkTable("mortgage_radar_clients", (q) => q.eq("email", MATT_EMAIL)) },
  { id: "talent",      group: "core",  emoji: "👷", label: "Talent Radar",
    customerPath: `/talent-radar/dashboard?token=${TALENT_TOK}`, prospectPath: "/talent-radar",
    healthCheck: checkTable("hire_alert_clients", (q) => q.ilike("owner_email", MATT_EMAIL)) },
  { id: "site",        group: "core",  emoji: "🛰️", label: "SiteRadar",
    customerPath: `/my-site-radar?token=${SITE_TOK}`, prospectPath: "/site-radar",
    healthCheck: checkTable("field_crm_clients", (q) => q.eq("email", MATT_EMAIL)) },
  { id: "missed-call", group: "core",  emoji: "📞", label: "Missed-Call Catch",
    customerPath: `/my-missed-call?token=${MISSED_TOK}`, prospectPath: "/missed-call-catch",
    healthCheck: checkTable("missed_call_clients", (q) => q.eq("email", MATT_EMAIL)) },
  { id: "fielddesk",   group: "core",  emoji: "🛠️", label: "FieldDesk",
    customerPath: `/my-field-desk?email=${E}`, prospectPath: "/field-service",
    healthCheck: checkTable("field_crm_clients", (q) => q.eq("email", MATT_EMAIL)) },

  { id: "demand",     group: "intel", emoji: "📊", label: "Demand Radar",
    customerPath: `/my-demand-radar?email=${E}&token=${DEMAND_TOK}`, prospectPath: "/demand-radar",
    healthCheck: checkTable("industry_pulse_clients", (q) => q.eq("email", MATT_EMAIL).eq("buyer_type", "contractor")) },
  { id: "buyer",      group: "intel", emoji: "🛒", label: "Buyer Radar",
    customerPath: `/my-buyer-radar?token=${BUYER_TOK}&email=${E}`, prospectPath: "/buyer-radar",
    healthCheck: checkTable("industry_pulse_clients", (q) => q.eq("email", MATT_EMAIL).eq("buyer_type", "supplier")) },
  { id: "growth",     group: "intel", emoji: "📈", label: "Growth Radar",
    customerPath: `/my-industry-pulse?token=${GROWTH_TOK}&email=${E}`, prospectPath: "/industry-pulse",
    healthCheck: checkTable("industry_pulse_clients", (q) => q.eq("email", MATT_EMAIL).eq("buyer_type", "growth")) },
  { id: "contractor", group: "intel", emoji: "🔧", label: "Contractor Leads",
    customerPath: `/my-contractor-leads?token=${CONTRACTOR_TOK}&email=${E}`, prospectPath: "/contractor-leads",
    healthCheck: checkTable("contractor_clients", (q) => q.eq("email", MATT_EMAIL)) },

  { id: "dead",     group: "ops", emoji: "💀", label: "Dead Lead Reactivation",
    customerPath: `/my-dead-lead-reactivation?email=${E}`, prospectPath: "/dead-lead-reactivation",
    healthCheck: checkTable("dead_lead_campaigns", (q) => q.limit(1)) },
  { id: "counsel",  group: "ops", emoji: "⚖️", label: "Counsel Search",
    customerPath: `/my-counsel-search?email=${E}`, prospectPath: "/counsel-search" },
  { id: "addons",   group: "ops", emoji: "➕", label: "Add-ons",
    customerPath: `/my-addons?email=${E}`, prospectPath: "/addons" },
  { id: "team",     group: "ops", emoji: "👥", label: "Team",
    customerPath: `/my-team?email=${E}`, prospectPath: "/team" },
];

const GROUP_LABELS: Record<ProductTab["group"], string> = {
  trade: "🎯 Trade Radar (11)",
  core:  "🚀 Core Products",
  intel: "📡 Intelligence",
  ops:   "⚙️ Ops & Add-ons",
};

type ViewMode = "customer" | "prospect";
type HealthState = "unknown" | "ok" | "missing" | "checking";

export default function MyCommandCenter() {
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem("cc.activeId") || "tr-roofing");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>(() => (localStorage.getItem("cc.mode") as ViewMode) || "customer");
  const [maximized, setMaximized] = useState(() => localStorage.getItem("cc.maximized") === "1");
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem("cc.zoom")) || 100);
  const [healthOpen, setHealthOpen] = useState(() => localStorage.getItem("cc.healthOpen") !== "0");
  const [health, setHealth] = useState<Record<string, HealthState>>({});

  useEffect(() => { localStorage.setItem("cc.activeId", activeId); }, [activeId]);
  useEffect(() => { localStorage.setItem("cc.mode", mode); }, [mode]);
  useEffect(() => { localStorage.setItem("cc.maximized", maximized ? "1" : "0"); }, [maximized]);
  useEffect(() => { localStorage.setItem("cc.zoom", String(zoom)); }, [zoom]);
  useEffect(() => { localStorage.setItem("cc.healthOpen", healthOpen ? "1" : "0"); }, [healthOpen]);

  const runHealthChecks = useCallback(async () => {
    const initial: Record<string, HealthState> = {};
    PRODUCTS.forEach((p) => { initial[p.id] = p.healthCheck ? "checking" : "unknown"; });
    setHealth(initial);
    await Promise.all(PRODUCTS.map(async (p) => {
      if (!p.healthCheck) return;
      const ok = await p.healthCheck();
      setHealth((prev) => ({ ...prev, [p.id]: ok ? "ok" : "missing" }));
    }));
  }, []);

  useEffect(() => { runHealthChecks(); }, [runHealthChecks]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (p: ProductTab) => !q || p.label.toLowerCase().includes(q) || p.id.includes(q);
    return (Object.keys(GROUP_LABELS) as ProductTab["group"][]).map((g) => ({
      group: g, label: GROUP_LABELS[g],
      items: PRODUCTS.filter((p) => p.group === g && matches(p)),
    }));
  }, [search]);

  const active = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];
  const activeUrl = mode === "customer" ? active.customerPath : active.prospectPath;

  const okCount = Object.values(health).filter((s) => s === "ok").length;
  const missingCount = Object.values(health).filter((s) => s === "missing").length;
  const totalChecked = PRODUCTS.filter((p) => p.healthCheck).length;

  const StatusDot = ({ state }: { state: HealthState }) => {
    if (state === "ok")       return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (state === "missing")  return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
    if (state === "checking") return <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />;
    return <span className="h-3.5 w-3.5 inline-block rounded-full bg-muted-foreground/30" />;
  };

  const Toolbar = (
    <div className="border-b bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> My Command Center
          </h1>
          <p className="text-xs text-muted-foreground">
            {mode === "customer"
              ? <>Customer view — scoped to <code className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px]">{MATT_EMAIL}</code>.</>
              : <>Prospect view — exactly what a cold visitor sees.</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-card overflow-hidden">
            <button onClick={() => setMode("customer")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${mode === "customer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <User className="h-3.5 w-3.5" /> Customer
            </button>
            <button onClick={() => setMode("prospect")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l ${mode === "prospect" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Target className="h-3.5 w-3.5" /> Prospect
            </button>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filter products…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-xs" />
          </div>
          <div className="inline-flex items-center gap-1.5 border rounded-md px-2 h-8 bg-card">
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="range" min={50} max={150} step={5} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 accent-primary" />
            <span className="text-[10px] tabular-nums text-muted-foreground w-8">{zoom}%</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setMaximized((m) => !m)}>
            {maximized ? <Minimize2 className="h-3.5 w-3.5 mr-1.5" /> : <Maximize2 className="h-3.5 w-3.5 mr-1.5" />}
            {maximized ? "Exit full" : "Full screen"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={activeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open standalone
            </a>
          </Button>
        </div>
      </div>

      {/* Enrollment health checklist */}
      <div className="mb-3 border rounded-md bg-card">
        <button onClick={() => setHealthOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/50">
          <span className="flex items-center gap-2">
            {healthOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Enrollment Health
            <span className="text-emerald-600">{okCount} enrolled</span>
            {missingCount > 0 && <span className="text-rose-600">· {missingCount} missing</span>}
            <span className="text-muted-foreground font-normal">/ {totalChecked} checked</span>
          </span>
          <span onClick={(e) => { e.stopPropagation(); runHealthChecks(); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
            <RefreshCw className="h-3 w-3" /> Re-check
          </span>
        </button>
        {healthOpen && (
          <div className="border-t px-3 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
            {PRODUCTS.filter((p) => p.healthCheck).map((p) => (
              <button key={p.id} onClick={() => setActiveId(p.id)}
                className={`flex items-center gap-1.5 text-[11px] py-0.5 text-left hover:text-primary ${activeId === p.id ? "font-semibold" : ""}`}>
                <StatusDot state={health[p.id] || "unknown"} />
                <span className="truncate">{p.emoji} {p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {grouped.map((g) => g.items.length > 0 && (
          <div key={g.group} className="flex items-start gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-1.5 min-w-[120px]">
              {g.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => (
                <button key={p.id} onClick={() => setActiveId(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition border flex items-center gap-1 ${
                    activeId === p.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border text-foreground"
                  }`}>
                  <span>{p.emoji}</span>{p.label}
                  {p.healthCheck && <StatusDot state={health[p.id] || "unknown"} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Zoom via CSS transform — wrap iframe in a sized container so scroll works.
  const Frame = (
    <div className="w-full h-full overflow-auto bg-background">
      <iframe
        key={`${active.id}:${mode}`}
        src={activeUrl}
        title={`${mode === "customer" ? "Customer" : "Prospect"} view: ${active.label}`}
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top left",
          width: `${10000 / zoom}%`,
          height: `${10000 / zoom}%`,
          border: 0,
        }}
      />
    </div>
  );

  if (maximized) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
        {Toolbar}
        <div className="flex-1 bg-muted/30 overflow-hidden">{Frame}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)", minHeight: "800px" }}>
      {Toolbar}
      <div className="flex-1 bg-muted/30 overflow-hidden" style={{ minHeight: "650px" }}>{Frame}</div>
    </div>
  );
}
