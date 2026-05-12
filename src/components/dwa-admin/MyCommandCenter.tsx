import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Search, Shield } from "lucide-react";

/**
 * Matt's personal "view as customer" command center.
 * Iframes each /my-* route so we render the EXACT customer experience,
 * scoped to Matt's logged-in session (matt@detroitwebagent.com).
 *
 * Trade Radar shows all 11 verticals as separate sub-tabs (the way a
 * customer enrolled in all 11 would actually see them).
 */

type ProductTab = {
  id: string;
  group: "trade" | "core" | "intel" | "ops";
  label: string;
  emoji: string;
  path: string;
};

const PRODUCTS: ProductTab[] = [
  // Trade Radar — 11 verticals (separate, like a real customer)
  { id: "tr-roofing",      group: "trade", emoji: "🏠", label: "Roofing",       path: "/my-roofing-radar" },
  { id: "tr-hvac",         group: "trade", emoji: "❄️", label: "HVAC",          path: "/my-hvac-radar" },
  { id: "tr-plumbing",     group: "trade", emoji: "🚿", label: "Plumbing",      path: "/my-plumbing-radar" },
  { id: "tr-electrical",   group: "trade", emoji: "⚡", label: "Electrical",    path: "/my-electrical-radar" },
  { id: "tr-pest",         group: "trade", emoji: "🐀", label: "Pest Control",  path: "/my-pest-control-radar" },
  { id: "tr-gutters",      group: "trade", emoji: "🌧️", label: "Gutters",       path: "/my-gutters-radar" },
  { id: "tr-exterior",     group: "trade", emoji: "🎨", label: "Exterior",      path: "/my-exterior-radar" },
  { id: "tr-tree",         group: "trade", emoji: "🌳", label: "Tree",          path: "/my-tree-radar" },
  { id: "tr-restoration",  group: "trade", emoji: "💧", label: "Restoration",   path: "/my-restoration-radar" },
  { id: "tr-demo",         group: "trade", emoji: "🚧", label: "Demo / Junk",   path: "/my-demo-junk-radar" },
  { id: "tr-foundation",   group: "trade", emoji: "🧱", label: "Foundation",    path: "/my-foundation-radar" },
  // Core radar products
  { id: "mortgage",        group: "core",  emoji: "🏦", label: "Mortgage Radar",     path: "/my-mortgage-radar" },
  { id: "talent",          group: "core",  emoji: "👷", label: "Talent Radar",       path: "/talent-radar/dashboard" },
  { id: "site",            group: "core",  emoji: "🛰️", label: "SiteRadar",          path: "/my-site-radar" },
  { id: "missed-call",     group: "core",  emoji: "📞", label: "Missed-Call Catch",  path: "/my-missed-call" },
  { id: "fielddesk",       group: "core",  emoji: "🛠️", label: "FieldDesk",          path: "/my-field-desk" },
  // Intelligence
  { id: "demand",          group: "intel", emoji: "📊", label: "Demand Radar",       path: "/my-demand-radar" },
  { id: "buyer",           group: "intel", emoji: "🛒", label: "Buyer Radar",        path: "/my-buyer-radar" },
  { id: "industry",        group: "intel", emoji: "📈", label: "Growth Radar",       path: "/my-industry-pulse" },
  { id: "contractor",      group: "intel", emoji: "🔧", label: "Contractor Leads",   path: "/my-contractor-leads" },
  // Ops
  { id: "dead",            group: "ops",   emoji: "💀", label: "Dead Lead Reactivation", path: "/my-dead-lead-reactivation" },
  { id: "counsel",         group: "ops",   emoji: "⚖️", label: "Counsel Search",     path: "/my-counsel-search" },
  { id: "addons",          group: "ops",   emoji: "➕", label: "Add-ons",            path: "/my-addons" },
  { id: "team",            group: "ops",   emoji: "👥", label: "Team",               path: "/my-team" },
];

const GROUP_LABELS: Record<ProductTab["group"], string> = {
  trade: "🎯 Trade Radar (11 Verticals)",
  core:  "🚀 Core Products",
  intel: "📡 Intelligence",
  ops:   "⚙️ Ops & Add-ons",
};

export default function MyCommandCenter() {
  const [activeId, setActiveId] = useState<string>("tr-roofing");
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (p: ProductTab) =>
      !q || p.label.toLowerCase().includes(q) || p.id.includes(q);
    return (Object.keys(GROUP_LABELS) as ProductTab["group"][]).map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: PRODUCTS.filter((p) => p.group === g && matches(p)),
    }));
  }, [search]);

  const active = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="border-b bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> My Command Center
            </h1>
            <p className="text-xs text-muted-foreground">
              View every product exactly as a paying customer sees it. Scoped to
              <code className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px]">matt@detroitwebagent.com</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-56 text-xs"
              />
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={active.path} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open standalone
              </a>
            </Button>
          </div>
        </div>

        {/* Product pills, grouped */}
        <div className="space-y-2">
          {grouped.map((g) => (
            g.items.length > 0 && (
              <div key={g.group} className="flex items-start gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-1.5 min-w-[140px]">
                  {g.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveId(p.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                        activeId === p.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted border-border text-foreground"
                      }`}
                    >
                      <span className="mr-1">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Iframe holding the live customer page */}
      <div className="flex-1 bg-muted/30 overflow-hidden">
        <iframe
          key={active.id}
          src={active.path}
          title={`Customer view: ${active.label}`}
          className="w-full h-full border-0 bg-background"
        />
      </div>
    </div>
  );
}
