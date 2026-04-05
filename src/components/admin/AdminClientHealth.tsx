import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Clock, Building2 } from "lucide-react";

const INTERNAL_EMAILS = ["matt@mattmichelstraining.com", "matt@mattmichelstraining.com", "matthewmichels4@gmail.com"];
const isInternalEmail = (email: string) => INTERNAL_EMAILS.includes(email?.toLowerCase());

interface ClientRow {
  service: string;
  price: string;
  businessName: string;
  email: string;
  industry: string | null;
  active: boolean;
  lastDelivery: string | null;
  daysSince: number | null;
  status: "green" | "yellow" | "red";
  isInternal: boolean;
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
  { table: "permit_monitor_clients", service: "Permit Monitor", price: "$79/mo", lastField: "last_sent_at", freq: 30 },
  { table: "osha_compliance_clients", service: "OSHA Compliance", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "collections_clients", service: "Late Payment Collector", price: "$49/mo", lastField: "last_sent_at", freq: 7 },
  { table: "inventory_alert_clients", service: "Inventory Alerts", price: "$49/mo", lastField: "last_sent_at", freq: 1 },
  { table: "birthday_campaign_clients", service: "Birthday Campaign", price: "$29/mo", lastField: "last_sent_at", freq: 30 },
  { table: "appointment_reminders", service: "Appointment Reminders", price: "$29/mo", lastField: "last_sent_at", freq: 1 },
  { table: "review_request_clients", service: "Review Request SMS", price: "$29/mo", lastField: "last_sent_at", freq: 7 },
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
            .select("business_name, email, active, industry" + (cfg.lastField ? `, ${cfg.lastField}` : ""))
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
                industry: r.industry || null,
                active: r.active,
                lastDelivery: lastVal ? new Date(lastVal).toLocaleDateString() : null,
                daysSince: days,
                status: getStatus(days, cfg.freq),
                isInternal: isInternalEmail(r.email),
              });
            }
          }
        } catch {}
      }
      return rows.sort((a, b) => {
        // Internal goes last
        if (a.isInternal !== b.isInternal) return a.isInternal ? 1 : -1;
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.status] - order[b.status];
      });
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const realClients = clients?.filter(c => !c.isInternal) ?? [];
  const internalClients = clients?.filter(c => c.isInternal) ?? [];

  const realCounts = {
    total: realClients.length,
    green: realClients.filter(c => c.status === "green").length,
    yellow: realClients.filter(c => c.status === "yellow").length,
    red: realClients.filter(c => c.status === "red").length,
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  const ClientRow = ({ c, i }: { c: ClientRow; i: number }) => (
    <div key={`${c.email}-${c.service}-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
      {c.status === "green" ? <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" /> :
       c.status === "yellow" ? <Clock size={14} className="text-yellow-400 shrink-0 mt-0.5" /> :
       <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold truncate">{c.businessName}</span>
          {c.isInternal && <Badge variant="outline" className="text-[8px] px-1 py-0 border-muted-foreground/30">INTERNAL</Badge>}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
        {c.industry && <div className="text-[10px] text-muted-foreground/60">{c.industry}</div>}
      </div>
      <div className="text-right shrink-0">
        <Badge variant="outline" className="text-[9px] mb-0.5">{c.service}</Badge>
        <div className="text-[10px] text-muted-foreground">
          {c.daysSince !== null ? (
            <span className={c.status === "red" ? "text-red-400 font-bold" : ""}>
              {c.daysSince}d since delivery
            </span>
          ) : (
            <span className="text-yellow-400">Never delivered</span>
          )}
        </div>
        <div className="text-[10px] font-bold text-muted-foreground">{c.price}</div>
      </div>
    </div>
  );

  const guide = getAdminGuide("health");

  return (
    <div className="space-y-6">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} />}

      <div>
        <h2 className="text-lg font-bold">Client Health Dashboard</h2>
        <p className="text-xs text-muted-foreground">Service delivery status for all B2B subscribers</p>
      </div>

      {/* Stats - Real clients only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paying Active", value: realCounts.total, color: "text-foreground", desc: "Real paying clients" },
          { label: "On Track", value: realCounts.green, color: "text-green-400", desc: "Delivered on schedule" },
          { label: "Due Soon", value: realCounts.yellow, color: "text-yellow-400", desc: "Delivery approaching or never sent" },
          { label: "Overdue", value: realCounts.red, color: "text-red-400", desc: "Past delivery deadline" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
              <div className="text-[8px] text-muted-foreground/60 mt-0.5">{s.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real Clients */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">
            Paying Clients ({realClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {realClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No paying B2B clients yet. When customers subscribe through your service pages, they'll appear here.
              </p>
            ) : (
              realClients.map((c, i) => <ClientRow key={i} c={c} i={i} />)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Internal Clients */}
      {internalClients.length > 0 && (
        <Card className="border-border/20 opacity-70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 size={14} className="text-muted-foreground" />
              Internal — Your Own Business ({internalClients.length} services)
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              These are services running for M2 Development. They don't count toward revenue.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {internalClients.map((c, i) => <ClientRow key={i} c={c} i={i} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
