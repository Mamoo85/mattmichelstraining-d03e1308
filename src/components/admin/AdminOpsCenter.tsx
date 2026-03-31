import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Mail, Phone, AlertCircle } from "lucide-react";

const ALL_SERVICES = [
  { table: "social_media_clients", name: "Social Media AI", price: "$199/mo" },
  { table: "gbp_saas_clients", name: "GBP SaaS", price: "$49/mo" },
  { table: "newsletter_service_clients", name: "AI Newsletter", price: "$99/mo" },
  { table: "faq_refresh_clients", name: "FAQ Refresh", price: "$29/mo" },
  { table: "ads_copy_clients", name: "Google Ads Copy", price: "$39/mo" },
  { table: "blog_post_clients", name: "Blog Posts", price: "$79/mo" },
  { table: "competitor_watch_clients", name: "Competitor Watch", price: "$69/mo" },
  { table: "local_seo_clients", name: "Local SEO Pages", price: "$59/mo" },
  { table: "price_monitor_clients", name: "Price Monitor", price: "$49/mo" },
  { table: "meeting_prep_clients", name: "Meeting Prep", price: "$29/mo" },
  { table: "directory_submitter_clients", name: "Directory Audit", price: "$39/mo" },
  { table: "onboarding_agent_clients", name: "Onboarding Agent", price: "$59/mo" },
  { table: "handbook_clients", name: "Employee Handbook", price: "$99/mo" },
  { table: "grant_finder_clients", name: "Grant Finder", price: "$149/mo" },
  { table: "review_response_clients", name: "Review Response", price: "$49/mo" },
  { table: "battlecard_clients", name: "Competitive Battlecard", price: "$39/mo" },
  { table: "market_intel_clients", name: "Market Intelligence", price: "$49/mo" },
  { table: "permit_monitor_clients", name: "Permit Monitor", price: "$79/mo" },
  { table: "osha_compliance_clients", name: "OSHA Compliance", price: "$99/mo" },
  { table: "collections_clients", name: "Late Payment Collector", price: "$49/mo" },
  { table: "inventory_alert_clients", name: "Inventory Alerts", price: "$49/mo" },
  { table: "birthday_campaign_clients", name: "Birthday Campaign", price: "$29/mo" },
  { table: "appointment_reminders", name: "Appointment Reminders", price: "$29/mo" },
  { table: "review_request_clients", name: "Review Request SMS", price: "$29/mo" },
  { table: "contractor_clients", name: "Contractor Lead Gen", price: "$399/mo" },
  { table: "b2b_subscribers", name: "B2B Dental Database", price: "$49/mo" },
] as const;

interface ServiceSummary {
  name: string;
  price: string;
  activeCount: number;
  totalRevenue: number;
}

export default function AdminOpsCenter() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-ops-center"],
    queryFn: async () => {
      const services: ServiceSummary[] = [];
      let totalMRR = 0;
      let totalClients = 0;

      for (const svc of ALL_SERVICES) {
        try {
          const { count } = await (supabase.from as any)(svc.table)
            .select("*", { count: "exact", head: true })
            .eq("active", true);
          const c = count || 0;
          const priceNum = parseInt(svc.price.replace(/[^0-9]/g, "")) || 0;
          const rev = c * priceNum;
          services.push({ name: svc.name, price: svc.price, activeCount: c, totalRevenue: rev });
          totalMRR += rev;
          totalClients += c;
        } catch {
          services.push({ name: svc.name, price: svc.price, activeCount: 0, totalRevenue: 0 });
        }
      }

      // Email stats from last 7 days
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: emailsSent } = await supabase.from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", weekAgo);

      const { count: emailsFailed } = await supabase.from("email_send_log")
        .select("*", { count: "exact", head: true })
        .or("status.eq.dlq,status.eq.failed")
        .gte("created_at", weekAgo);

      return {
        services: services.sort((a, b) => b.totalRevenue - a.totalRevenue),
        totalMRR,
        totalClients,
        emailsSent: emailsSent || 0,
        emailsFailed: emailsFailed || 0,
      };
    },
    refetchInterval: 120000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="text-primary" size={20} />
        <div>
          <h2 className="text-lg font-bold">Operations Command Center</h2>
          <p className="text-xs text-muted-foreground">All 40+ services — revenue, clients, email health</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Est. MRR", value: `$${(data?.totalMRR || 0).toLocaleString()}`, color: "text-green-400", icon: null },
          { label: "Active Clients", value: data?.totalClients || 0, color: "text-foreground", icon: null },
          { label: "Emails Sent (7d)", value: data?.emailsSent || 0, color: "text-blue-400", icon: Mail },
          { label: "Emails Failed (7d)", value: data?.emailsFailed || 0, color: data?.emailsFailed ? "text-red-400" : "text-green-400", icon: AlertCircle },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call Triage Protocol */}
      <Card className="border-border/40 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Phone size={14} /> Inbound Call Triage Protocol
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div className="p-3 rounded-lg bg-muted/30 space-y-1.5">
            <p className="font-bold text-primary">When a call/text comes in:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li><span className="text-foreground font-medium">Ask:</span> "What's your business name and what industry are you in?"</li>
              <li><span className="text-foreground font-medium">Check Client Health</span> tab — are they already a client?</li>
              <li><span className="text-foreground font-medium">If new:</span> recommend their top 3 services based on industry</li>
              <li><span className="text-foreground font-medium">Send checkout link</span> via text: mattmichelstraining.com/[service-page]</li>
              <li><span className="text-foreground font-medium">Log the interaction</span> in CRM</li>
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-muted/20">
              <p className="font-bold text-[10px]">Contractors / Home Services</p>
              <p className="text-[9px] text-muted-foreground">Lead Gen ($399) → GBP SaaS ($49) → Local SEO ($59)</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="font-bold text-[10px]">Restaurants / Retail</p>
              <p className="text-[9px] text-muted-foreground">Social Media ($199) → Review Response ($49) → Birthday ($29)</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="font-bold text-[10px]">Professional Services</p>
              <p className="text-[9px] text-muted-foreground">Newsletter ($99) → Meeting Prep ($29) → Blog Posts ($79)</p>
            </div>
            <div className="p-2 rounded bg-muted/20">
              <p className="font-bold text-[10px]">Manufacturing / Trade</p>
              <p className="text-[9px] text-muted-foreground">OSHA ($99) → Handbook ($99) → Inventory ($49)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Service */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Revenue by Service</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {data?.services.map(svc => (
              <div key={svc.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{svc.name}</div>
                  <div className="text-[10px] text-muted-foreground">{svc.price}</div>
                </div>
                <Badge variant={svc.activeCount > 0 ? "default" : "outline"} className="text-[9px]">
                  {svc.activeCount} clients
                </Badge>
                <div className="text-xs font-bold text-green-400 w-20 text-right">
                  ${svc.totalRevenue.toLocaleString()}/mo
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
