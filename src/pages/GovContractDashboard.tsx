import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/layout/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Filter, AlertTriangle } from "lucide-react";

type Rec = "bid" | "review" | "no-bid" | "all";

interface Opportunity {
  id: string;
  sam_notice_id: string;
  title: string;
  agency: string | null;
  naics_code: string | null;
  set_aside: string | null;
  response_deadline: string | null;
  posted_date: string | null;
  sam_url: string | null;
  match_score: number | null;
  bid_recommendation: string | null;
  ai_summary: string | null;
  sent_to_client: boolean;
  created_at: string;
}

function recBadgeClass(rec: string | null): string {
  if (rec === "bid") return "bg-green-100 text-green-800 border-green-300";
  if (rec === "review") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (rec === "no-bid") return "bg-red-100 text-red-800 border-red-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function recLabel(rec: string | null): string {
  if (rec === "bid") return "BID";
  if (rec === "review") return "REVIEW";
  if (rec === "no-bid") return "NO-BID";
  return "UNKNOWN";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 70) return "text-green-600 font-black";
  if (score >= 40) return "text-yellow-600 font-black";
  return "text-red-600 font-black";
}

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff <= 72 * 60 * 60 * 1000;
}

export default function GovContractDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Rec>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["gov-contract-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Find the client record for this user
      const { data: clients } = await (supabase.from as any)("gov_contract_clients")
        .select("id, company_name, naics_codes, keywords, set_aside_types, subscription_status, last_notified_at")
        .eq("user_id", user!.id)
        .limit(1);

      if (!clients || clients.length === 0) return { client: null, opportunities: [] };

      const client = clients[0];

      const { data: opps } = await (supabase.from as any)("gov_contract_opportunities")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(200);

      return { client, opportunities: (opps || []) as Opportunity[] };
    },
  });

  const filtered = (data?.opportunities || []).filter((o: Opportunity) => {
    if (filter === "all") return true;
    return o.bid_recommendation === filter;
  });

  const urgentCount = (data?.opportunities || []).filter((o: Opportunity) => isUrgent(o.response_deadline)).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="text-destructive text-sm">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  if (!data?.client) {
    return (
      <>
        <SEOHead title="Contract Dashboard | M² Development" description="Your federal contract opportunity dashboard." />
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c59b2b] mb-3">M² Development</p>
            <h1 className="text-2xl font-black text-foreground mb-3">No Active Subscription</h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              We don't have a Government Contract Monitor subscription linked to your account.
              If you just signed up, your account may need to be linked — contact Matt directly.
            </p>
            <a
              href="/gov-contract-monitor"
              className="bg-[#1e3a5f] text-white px-6 py-3 font-bold text-sm hover:bg-[#162d4a] transition-all inline-block"
            >
              Subscribe — $299/mo
            </a>
          </div>
        </div>
      </>
    );
  }

  const client = data.client;

  return (
    <>
      <SEOHead title="Contract Dashboard | M² Development" description="Your matched federal contract opportunities." />
      <div className="min-h-screen bg-background text-foreground">

        {/* Header */}
        <div className="bg-[#1e3a5f] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <p className="text-[#c59b2b] text-[11px] font-bold uppercase tracking-widest mb-1">M² Development — Federal Contract Intelligence</p>
            <h1 className="text-2xl font-black mb-1">{client.company_name || "Your Company"} — Opportunity Dashboard</h1>
            <p className="text-slate-300 text-sm">
              Monitoring NAICS: {client.naics_codes || "not set"} &nbsp;|&nbsp;
              Keywords: {client.keywords || "not set"} &nbsp;|&nbsp;
              Set-Asides: {client.set_aside_types || "all"}
            </p>
            {client.last_notified_at && (
              <p className="text-slate-400 text-xs mt-1">
                Last scan: {new Date(client.last_notified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Matches", val: data.opportunities.length, color: "text-foreground" },
              { label: "Bid", val: data.opportunities.filter((o: Opportunity) => o.bid_recommendation === "bid").length, color: "text-green-600" },
              { label: "Review", val: data.opportunities.filter((o: Opportunity) => o.bid_recommendation === "review").length, color: "text-yellow-600" },
              { label: "No-Bid", val: data.opportunities.filter((o: Opportunity) => o.bid_recommendation === "no-bid").length, color: "text-red-600" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Urgent alert banner */}
          {urgentCount > 0 && (
            <div className="bg-red-50 border-2 border-red-500 px-4 py-3 mb-5 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-semibold">
                {urgentCount} {urgentCount === 1 ? "opportunity closes" : "opportunities close"} within 72 hours — scroll down to review.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground text-xs font-medium mr-1">Filter:</span>
            {(["all", "bid", "review", "no-bid"] as Rec[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold border transition-all ${
                  filter === f
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-background text-foreground border-border hover:border-[#1e3a5f]"
                }`}
              >
                {f === "all" ? "All" : f === "bid" ? "BID" : f === "review" ? "REVIEW" : "NO-BID"}
              </button>
            ))}
          </div>

          {/* Opportunities list */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border">
              <p className="text-muted-foreground text-sm">
                {data.opportunities.length === 0
                  ? "No opportunities found yet. Your first scan runs daily — check back tomorrow."
                  : "No opportunities match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((opp: Opportunity) => {
                const urgent = isUrgent(opp.response_deadline);
                const deadline = opp.response_deadline
                  ? new Date(opp.response_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "TBD";
                const posted = opp.posted_date
                  ? new Date(opp.posted_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;

                return (
                  <div
                    key={opp.id}
                    className={`bg-card border p-5 ${urgent ? "border-red-400" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {urgent && (
                            <span className="flex items-center gap-1 text-red-600 text-[10px] font-black uppercase tracking-widest">
                              <AlertTriangle size={10} /> DEADLINE SOON
                            </span>
                          )}
                          <h3 className="font-bold text-foreground text-sm leading-snug">{opp.title}</h3>
                        </div>
                        <p className="text-muted-foreground text-[12px]">{opp.agency || "Unknown Agency"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xl ${scoreColor(opp.match_score)}`}>
                          {opp.match_score ?? "—"}
                        </span>
                        <Badge className={`text-[10px] font-black border px-2 py-0.5 ${recBadgeClass(opp.bid_recommendation)}`}>
                          {recLabel(opp.bid_recommendation)}
                        </Badge>
                      </div>
                    </div>

                    {opp.ai_summary && (
                      <p className="text-muted-foreground text-[12px] leading-relaxed mb-3 bg-muted/50 px-3 py-2 border-l-2 border-[#c59b2b]">
                        {opp.ai_summary}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground mb-3">
                      {opp.naics_code && <span>NAICS: <strong className="text-foreground">{opp.naics_code}</strong></span>}
                      {opp.set_aside && <span>Set-Aside: <strong className="text-foreground">{opp.set_aside}</strong></span>}
                      {posted && <span>Posted: <strong className="text-foreground">{posted}</strong></span>}
                      <span className={urgent ? "text-red-600 font-bold" : ""}>
                        Deadline: <strong className={urgent ? "text-red-600" : "text-foreground"}>{deadline}</strong>
                      </span>
                    </div>

                    {opp.sam_url && (
                      <a
                        href={opp.sam_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#1e3a5f] text-xs font-bold hover:underline"
                      >
                        View on SAM.gov <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 p-4 bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 text-[12px] text-muted-foreground">
            <strong className="text-foreground">Score guide:</strong> 70–100 = strong fit (BID). 40–69 = worth evaluating (REVIEW). 0–39 = likely not a fit (NO-BID).
            Opportunities are scanned daily from SAM.gov. Questions? Contact Matt at{" "}
            <a href="tel:+13138064952" className="text-[#c59b2b] font-bold">(313) 806-4952</a>.
          </div>
        </div>
      </div>
    </>
  );
}
