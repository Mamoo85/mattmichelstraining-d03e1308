import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/layout/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Filter, AlertTriangle, Shield, Info } from "lucide-react";

type ImpactFilter = "all" | "high" | "medium" | "low";

interface RegItem {
  id: string;
  client_id: string;
  source_url: string | null;
  title: string | null;
  agency: string | null;
  published_date: string | null;
  summary: string | null;
  impact_level: string;
  sent_to_client: boolean;
  created_at: string;
}

interface RegClient {
  id: string;
  company_name: string | null;
  industry: string;
  last_sent_at: string | null;
}

const IMPACT_STYLES: Record<string, { border: string; bg: string; badge: string; label: string; icon: React.ElementType }> = {
  high:   { border: "border-red-300",    bg: "bg-red-50 dark:bg-red-950/20",    badge: "bg-red-100 text-red-800 border-red-300",    label: "HIGH IMPACT",   icon: AlertTriangle },
  medium: { border: "border-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-950/20", badge: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "MEDIUM IMPACT", icon: Shield },
  low:    { border: "border-green-300",  bg: "bg-green-50 dark:bg-green-950/20",  badge: "bg-green-100 text-green-800 border-green-300",  label: "LOW IMPACT",    icon: Info },
};

const INDUSTRY_LABELS: Record<string, string> = {
  healthcare:    "Healthcare",
  finance:       "Finance & Banking",
  cannabis:      "Cannabis",
  food_bev:      "Food & Beverage",
  construction:  "Construction",
  real_estate:   "Real Estate",
  hr_employment: "HR & Employment",
};

function ImpactBadge({ level }: { level: string }) {
  const s = IMPACT_STYLES[level] || IMPACT_STYLES.low;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest border rounded px-2 py-0.5 ${s.badge}`}>
      {s.label}
    </span>
  );
}

export default function RegulatoryDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ImpactFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["regulatory-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Fetch client record
      const { data: clients, error: clientErr } = await (supabase.from as any)(
        "regulatory_monitor_clients"
      )
        .select("id, company_name, industry, last_sent_at")
        .eq("user_id", user!.id)
        .eq("subscription_status", "active")
        .limit(1);

      if (clientErr) throw new Error(clientErr.message);
      const client: RegClient | null = clients?.[0] || null;
      if (!client) return { client: null, items: [] };

      // Fetch items for this client
      const { data: items, error: itemsErr } = await (supabase.from as any)(
        "regulatory_monitor_items"
      )
        .select("*")
        .eq("client_id", client.id)
        .order("published_date", { ascending: false })
        .limit(100);

      if (itemsErr) throw new Error(itemsErr.message);
      return { client, items: (items || []) as RegItem[] };
    },
  });

  const { client, items = [] } = data || {};

  const filtered = filter === "all" ? items : items.filter((i) => i.impact_level === filter);
  const highCount = items.filter((i) => i.impact_level === "high").length;
  const medCount = items.filter((i) => i.impact_level === "medium").length;
  const lowCount = items.filter((i) => i.impact_level === "low").length;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-4">Please sign in to view your regulatory dashboard.</p>
          <a href="/auth" className="bg-[#1a2744] text-white px-6 py-3 text-sm font-bold rounded hover:bg-[#243358] transition-colors">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Regulatory Monitor Dashboard | M² Development"
        description="Your weekly AI-generated regulatory change digest."
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Header */}
        <div className="bg-[#1a2744] text-white px-6 py-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c9a227] mb-2">M² Development</p>
            <h1 className="text-2xl font-black mb-1">Regulatory Change Monitor</h1>
            {client && (
              <p className="text-slate-400 text-sm">
                {client.company_name || "Your company"} ·{" "}
                {INDUSTRY_LABELS[client.industry] || client.industry}
                {client.last_sent_at && (
                  <> · Last digest {new Date(client.last_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/20 border border-red-900/30 rounded p-4 mb-6">
              <p className="text-red-400 text-sm">Error loading data: {(error as Error).message}</p>
            </div>
          )}

          {/* No subscription */}
          {!isLoading && !client && (
            <div className="text-center py-20">
              <AlertTriangle size={32} className="text-[#c9a227] mx-auto mb-4" />
              <h2 className="text-lg font-bold text-foreground mb-2">No Active Subscription Found</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your account doesn't have an active Regulatory Monitor subscription linked to it yet.
              </p>
              <a
                href="/regulatory-monitor"
                className="inline-block bg-[#c9a227] text-[#1a2744] font-black text-sm px-6 py-3 rounded hover:bg-[#e0b83a] transition-colors"
              >
                Subscribe — $197/mo →
              </a>
            </div>
          )}

          {/* Content */}
          {!isLoading && client && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: "High Impact", count: highCount, color: "text-red-500", filter: "high" as ImpactFilter },
                  { label: "Medium Impact", count: medCount, color: "text-yellow-500", filter: "medium" as ImpactFilter },
                  { label: "Low Impact", count: lowCount, color: "text-green-500", filter: "low" as ImpactFilter },
                ].map((s) => (
                  <button
                    key={s.filter}
                    onClick={() => setFilter((prev) => (prev === s.filter ? "all" : s.filter))}
                    className={`border rounded p-4 text-center transition-colors hover:border-[#c9a227] ${filter === s.filter ? "border-[#c9a227] bg-[#c9a227]/5" : "border-border bg-card"}`}
                  >
                    <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-1">{s.label}</p>
                  </button>
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <Filter size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest mr-1">Filter:</span>
                {(["all", "high", "medium", "low"] as ImpactFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs font-bold uppercase px-3 py-1 rounded border transition-colors ${filter === f ? "bg-[#1a2744] text-white border-[#1a2744]" : "border-border text-muted-foreground hover:border-[#1a2744]"}`}
                  >
                    {f === "all" ? `All (${items.length})` : f}
                  </button>
                ))}
              </div>

              {/* Items */}
              {filtered.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded">
                  <p className="text-muted-foreground text-sm">
                    {items.length === 0
                      ? "No regulatory items yet. Your first scan runs within 24 hours of subscribing."
                      : `No ${filter}-impact items found.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map((item) => {
                    const styles = IMPACT_STYLES[item.impact_level] || IMPACT_STYLES.low;
                    const Icon = styles.icon;
                    return (
                      <div
                        key={item.id}
                        className={`border-l-4 border rounded p-5 ${styles.border} ${styles.bg}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <ImpactBadge level={item.impact_level} />
                              {item.published_date && (
                                <span className="text-[11px] text-muted-foreground">
                                  Published {new Date(item.published_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-sm text-foreground leading-tight">
                              {item.title || "Regulatory Update"}
                            </h3>
                            {item.agency && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                                {item.agency}
                              </p>
                            )}
                          </div>
                          <Icon size={18} className={`flex-shrink-0 mt-0.5 ${item.impact_level === "high" ? "text-red-500" : item.impact_level === "medium" ? "text-yellow-500" : "text-green-500"}`} />
                        </div>

                        {item.summary && (
                          <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                            {item.summary}
                          </p>
                        )}

                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c9a227] hover:text-[#e0b83a] transition-colors"
                          >
                            Read Full Text on Federal Register <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
