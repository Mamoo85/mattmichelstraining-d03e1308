import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ClientRow {
  service: string;
  price: string;
  businessName: string;
  email: string;
  active: boolean;
  lastDelivery: string | null;
  daysSince: number | null;
  status: "green" | "yellow" | "red";
}

const SERVICE_TABLES = [
  { table: "newsletter_service_clients", service: "AI Newsletter", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "faq_refresh_clients", service: "FAQ Refresh", price: "$29/mo", lastField: "last_refreshed_at", freq: 30 },
  { table: "ads_copy_clients", service: "Google Ads Copy", price: "$39/mo", lastField: "last_sent_at", freq: 30 },
  { table: "blog_post_clients", service: "Blog Posts", price: "$79/mo", lastField: "last_sent_at", freq: 30 },
  { table: "competitor_watch_clients", service: "Competitor Watch", price: "$69/mo", lastField: "last_report_at", freq: 7 },
  { table: "local_seo_clients", service: "Local SEO Pages", price: "$59/mo", lastField: "last_generated_at", freq: 30 },
  { table: "price_monitor_clients", service: "Price Monitor", price: "$49/mo", lastField: "last_report_at", freq: 7 },
  { table: "meeting_prep_clients", service: "Meeting Prep", price: "$29/mo", lastField: null, freq: 0 },
  { table: "directory_submitter_clients", service: "Directory Audit", price: "$39/mo", lastField: "last_audit_at", freq: 30 },
  { table: "onboarding_agent_clients", service: "Onboarding Agent", price: "$59/mo", lastField: null, freq: 0 },
  { table: "handbook_clients", service: "Employee Handbook", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "grant_finder_clients", service: "Grant Finder", price: "$149/mo", lastField: "last_sent_at", freq: 7 },
  { table: "review_response_clients", service: "Review Response", price: "$49/mo", lastField: "last_sent_at", freq: 1 },
  { table: "battlecard_clients", service: "Competitive Battlecard", price: "$39/mo", lastField: "last_sent_at", freq: 30 },
  { table: "market_intel_clients", service: "Market Intelligence", price: "$49/mo", lastField: "last_sent_at", freq: 7 },
] as const;

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getStatus(days: number | null, freq: number): "green" | "yellow" | "red" {
  if (freq === 0 || days === null) return "yellow";
  if (days <= freq) return "green";
  if (days <= freq * 1.5) return "yellow";
  return "red";
}

export default function AdminClientHealth() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-client-health"],
    queryFn: async () => {
      const rows: ClientRow[] = [];
      for (const cfg of SERVICE_TABLES) {
        try {
          const { data } = await (supabase.from as any)(cfg.table)
            .select("business_name, email, active" + (cfg.lastField ? `, ${cfg.lastField}` : ""))
            .eq("active", true)
            .limit(100);
          if (data) {
            for (const r of data) {
              const lastVal = cfg.lastField ? r[cfg.lastField] : null;
              const days = daysBetween(lastVal);
              rows.push({
                service: cfg.service,
                price: cfg.price,
                businessName: r.business_name,
                email: r.email,
                active: r.active,
                lastDelivery: lastVal ? new Date(lastVal).toLocaleDateString() : "Never",
                daysSince: days,
                status: getStatus(days, cfg.freq),
              });
            }
          }
        } catch {}
      }
      return rows.sort((a, b) => {
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.status] - order[b.status];
      });
    },
    refetchInterval: 60000,
  });

  const counts = {
    total: clients?.length ?? 0,
    green: clients?.filter(c => c.status === "green").length ?? 0,
    yellow: clients?.filter(c => c.status === "yellow").length ?? 0,
    red: clients?.filter(c => c.status === "red").length ?? 0,
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Client Health Dashboard</h2>
        <p className="text-xs text-muted-foreground">All B2B service subscribers — delivery status across every product</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Active", value: counts.total, color: "text-foreground" },
          { label: "On Track", value: counts.green, color: "text-green-400" },
          { label: "Due Soon", value: counts.yellow, color: "text-yellow-400" },
          { label: "Overdue", value: counts.red, color: "text-red-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {clients?.map((c, i) => (
              <div key={`${c.email}-${c.service}-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                {c.status === "green" ? <CheckCircle size={14} className="text-green-400 shrink-0" /> :
                 c.status === "yellow" ? <Clock size={14} className="text-yellow-400 shrink-0" /> :
                 <AlertTriangle size={14} className="text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{c.businessName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">{c.service}</Badge>
                <div className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                  {c.daysSince !== null ? `${c.daysSince}d ago` : c.lastDelivery}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground shrink-0 w-14 text-right">{c.price}</div>
              </div>
            ))}
            {(!clients || clients.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-8">No active B2B clients found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
