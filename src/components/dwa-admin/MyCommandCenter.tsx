import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Search, Shield, Maximize2, Minimize2, User, Target } from "lucide-react";

/**
 * Matt's "view as customer" command center.
 * Each product has BOTH a customerPath (with auth params pre-baked) AND a
 * prospectPath (the public marketing/landing page).
 *
 * Matt is enrolled in every product table with deterministic preview tokens
 * (see migration `matt_full_enrollment_command_center`). The Command Center
 * just appends `?email=` and/or `?token=` to each iframe URL.
 */

const MATT_EMAIL = "matt@detroitwebagent.com";
const E = encodeURIComponent(MATT_EMAIL);

// Per-product deterministic preview tokens (mirror the migration)
const TR_TOKEN = (v: string) => `mtt-cmd-tr-${v}`;
const TALENT_TOK = "mtt-cmd-talent-dashtok000000000000";
const SITE_TOK = "mttcmdfielddeskdis000000000000ab";
const MISSED_TOK = "mttcmdmissedcalldash000000000abc";
const DEMAND_TOK = "mtt-cmd-demand-dashtok0000000000";
const BUYER_TOK = "mtt-cmd-buyer-dashtok00000000000";
const GROWTH_TOK = "mtt-cmd-growth-dashtok0000000000";
const CONTRACTOR_TOK = "mtt-cmd-contractor-roitok0000000";

type ProductTab = {
  id: string;
  group: "trade" | "core" | "intel" | "ops";
  label: string;
  emoji: string;
  customerPath: string;
  prospectPath: string;
};

const tr = (v: string, label: string, emoji: string): ProductTab => ({
  id: `tr-${v}`,
  group: "trade",
  emoji,
  label,
  customerPath: `/my-${v.replace(/_/g, "-")}-radar?email=${E}&token=${TR_TOKEN(v)}`,
  prospectPath: `/${v.replace(/_/g, "-")}-radar`,
});

const PRODUCTS: ProductTab[] = [
  // Trade Radar — 11 verticals
  tr("roofing",     "Roofing",      "🏠"),
  tr("hvac",        "HVAC",         "❄️"),
  tr("plumbing",    "Plumbing",     "🚿"),
  tr("electrical",  "Electrical",   "⚡"),
  tr("pest-control","Pest Control", "🐀"),
  tr("gutters",     "Gutters",      "🌧️"),
  tr("exterior",    "Exterior",     "🎨"),
  tr("tree",        "Tree",         "🌳"),
  tr("restoration", "Restoration",  "💧"),
  tr("demo-junk",   "Demo / Junk",  "🚧"),
  tr("foundation",  "Foundation",   "🧱"),

  // Core
  { id: "mortgage",    group: "core",  emoji: "🏦", label: "Mortgage Radar",
    customerPath: `/my-mortgage-radar?email=${E}`, prospectPath: "/mortgage-radar" },
  { id: "talent",      group: "core",  emoji: "👷", label: "Talent Radar",
    customerPath: `/talent-radar/dashboard?token=${TALENT_TOK}`, prospectPath: "/talent-radar" },
  { id: "site",        group: "core",  emoji: "🛰️", label: "SiteRadar",
    customerPath: `/my-site-radar?token=${SITE_TOK}`, prospectPath: "/site-radar" },
  { id: "missed-call", group: "core",  emoji: "📞", label: "Missed-Call Catch",
    customerPath: `/my-missed-call?token=${MISSED_TOK}`, prospectPath: "/missed-call-catch" },
  { id: "fielddesk",   group: "core",  emoji: "🛠️", label: "FieldDesk",
    customerPath: `/my-field-desk?email=${E}`, prospectPath: "/field-service" },

  // Intelligence
  { id: "demand",     group: "intel", emoji: "📊", label: "Demand Radar",
    customerPath: `/my-demand-radar?email=${E}&token=${DEMAND_TOK}`, prospectPath: "/demand-radar" },
  { id: "buyer",      group: "intel", emoji: "🛒", label: "Buyer Radar",
    customerPath: `/my-buyer-radar?token=${BUYER_TOK}&email=${E}`, prospectPath: "/buyer-radar" },
  { id: "growth",     group: "intel", emoji: "📈", label: "Growth Radar",
    customerPath: `/my-industry-pulse?token=${GROWTH_TOK}&email=${E}`, prospectPath: "/industry-pulse" },
  { id: "contractor", group: "intel", emoji: "🔧", label: "Contractor Leads",
    customerPath: `/my-contractor-leads?token=${CONTRACTOR_TOK}&email=${E}`, prospectPath: "/contractor-leads" },

  // Ops
  { id: "dead",     group: "ops", emoji: "💀", label: "Dead Lead Reactivation",
    customerPath: `/my-dead-lead-reactivation?email=${E}`, prospectPath: "/dead-lead-reactivation" },
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

export default function MyCommandCenter() {
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem("cc.activeId") || "tr-roofing");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ViewMode>(() => (localStorage.getItem("cc.mode") as ViewMode) || "customer");
  const [maximized, setMaximized] = useState(false);

  useEffect(() => { localStorage.setItem("cc.activeId", activeId); }, [activeId]);
  useEffect(() => { localStorage.setItem("cc.mode", mode); }, [mode]);

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
          {/* View mode toggle */}
          <div className="inline-flex rounded-md border bg-card overflow-hidden">
            <button
              onClick={() => setMode("customer")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${mode === "customer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <User className="h-3.5 w-3.5" /> Customer
            </button>
            <button
              onClick={() => setMode("prospect")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-l ${mode === "prospect" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Target className="h-3.5 w-3.5" /> Prospect
            </button>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filter products…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-xs" />
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

      <div className="space-y-1.5">
        {grouped.map((g) => g.items.length > 0 && (
          <div key={g.group} className="flex items-start gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-1.5 min-w-[120px]">
              {g.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => (
                <button key={p.id} onClick={() => setActiveId(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                    activeId === p.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border text-foreground"
                  }`}>
                  <span className="mr-1">{p.emoji}</span>{p.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Frame = (
    <iframe
      key={`${active.id}:${mode}`}
      src={activeUrl}
      title={`${mode === "customer" ? "Customer" : "Prospect"} view: ${active.label}`}
      className="w-full h-full border-0 bg-background"
    />
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
