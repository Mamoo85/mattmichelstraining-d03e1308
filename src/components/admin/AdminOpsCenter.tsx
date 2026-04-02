import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Mail, AlertCircle, Phone, ChevronDown, ChevronRight, Users, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ALL_SERVICES = [
  { table: "social_media_clients", name: "Social Media AI", price: "$199/mo", priceNum: 199 },
  { table: "gbp_saas_clients", name: "GBP SaaS", price: "$49/mo", priceNum: 49 },
  { table: "newsletter_service_clients", name: "AI Newsletter", price: "$99/mo", priceNum: 99 },
  { table: "faq_refresh_clients", name: "FAQ Refresh", price: "$29/mo", priceNum: 29 },
  { table: "ads_copy_clients", name: "Google Ads Copy", price: "$39/mo", priceNum: 39 },
  { table: "blog_post_clients", name: "Blog Posts", price: "$79/mo", priceNum: 79 },
  { table: "competitor_watch_clients", name: "Competitor Watch", price: "$69/mo", priceNum: 69 },
  { table: "local_seo_clients", name: "Local SEO Pages", price: "$59/mo", priceNum: 59 },
  { table: "price_monitor_clients", name: "Price Monitor", price: "$49/mo", priceNum: 49 },
  { table: "meeting_prep_clients", name: "Meeting Prep", price: "$29/mo", priceNum: 29 },
  { table: "directory_submitter_clients", name: "Directory Audit", price: "$39/mo", priceNum: 39 },
  { table: "onboarding_agent_clients", name: "Onboarding Agent", price: "$59/mo", priceNum: 59 },
  { table: "handbook_clients", name: "Employee Handbook", price: "$99/mo", priceNum: 99 },
  { table: "grant_finder_clients", name: "Grant Finder", price: "$149/mo", priceNum: 149 },
  { table: "review_response_clients", name: "Review Response", price: "$49/mo", priceNum: 49 },
  { table: "battlecard_clients", name: "Competitive Battlecard", price: "$39/mo", priceNum: 39 },
  { table: "market_intel_clients", name: "Market Intelligence", price: "$49/mo", priceNum: 49 },
  { table: "permit_monitor_clients", name: "Permit Monitor", price: "$79/mo", priceNum: 79 },
  { table: "osha_compliance_clients", name: "OSHA Compliance", price: "$99/mo", priceNum: 99 },
  { table: "collections_clients", name: "Late Payment Collector", price: "$49/mo", priceNum: 49 },
  { table: "inventory_alert_clients", name: "Inventory Alerts", price: "$49/mo", priceNum: 49 },
  { table: "birthday_campaign_clients", name: "Birthday Campaign", price: "$29/mo", priceNum: 29 },
  { table: "appointment_reminders", name: "Appointment Reminders", price: "$29/mo", priceNum: 29 },
  { table: "review_request_clients", name: "Review Request SMS", price: "$29/mo", priceNum: 29 },
  { table: "contractor_clients", name: "Contractor Lead Gen", price: "$399/mo", priceNum: 399 },
  { table: "b2b_subscribers", name: "B2B Dental Database", price: "$49/mo", priceNum: 49 },
] as const;

interface ClientRecord {
  business_name: string;
  email: string;
  created_at: string;
}

interface ServiceData {
  name: string;
  price: string;
  priceNum: number;
  activeCount: number;
  totalRevenue: number;
  clients: ClientRecord[];
}

interface RosterEntry {
  email: string;
  business_name: string;
  services: string[];
  totalSpend: number;
}

export default function AdminOpsCenter() {
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ops-center-v2"],
    queryFn: async () => {
      const services: ServiceData[] = [];
      let totalMRR = 0;
      let totalClients = 0;
      const rosterMap = new Map<string, RosterEntry>();

      for (const svc of ALL_SERVICES) {
        try {
          const { data: rows } = await (supabase.from as any)(svc.table)
            .select("business_name, email, created_at")
            .eq("active", true)
            .limit(200);

          const clients: ClientRecord[] = (rows || []).map((r: any) => ({
            business_name: r.business_name || "Unknown",
            email: r.email || "N/A",
            created_at: r.created_at || "",
          }));

          const c = clients.length;
          const rev = c * svc.priceNum;
          services.push({ name: svc.name, price: svc.price, priceNum: svc.priceNum, activeCount: c, totalRevenue: rev, clients });
          totalMRR += rev;
          totalClients += c;

          // Build roster
          for (const cl of clients) {
            const key = cl.email.toLowerCase();
            if (rosterMap.has(key)) {
              const existing = rosterMap.get(key)!;
              existing.services.push(svc.name);
              existing.totalSpend += svc.priceNum;
            } else {
              rosterMap.set(key, {
                email: cl.email,
                business_name: cl.business_name,
                services: [svc.name],
                totalSpend: svc.priceNum,
              });
            }
          }
        } catch {
          services.push({ name: svc.name, price: svc.price, priceNum: svc.priceNum, activeCount: 0, totalRevenue: 0, clients: [] });
        }
      }

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: emailsSent } = await supabase.from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", weekAgo);

      const { count: emailsFailed } = await supabase.from("email_send_log")
        .select("*", { count: "exact", head: true })
        .or("status.eq.dlq,status.eq.failed")
        .gte("created_at", weekAgo);

      const roster = Array.from(rosterMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);

      return {
        services: services.sort((a, b) => b.totalRevenue - a.totalRevenue),
        totalMRR,
        totalClients,
        uniqueClients: roster.length,
        emailsSent: emailsSent || 0,
        emailsFailed: emailsFailed || 0,
        roster,
      };
    },
    refetchInterval: 120000,
  });

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied");
  };

  const filteredRoster = data?.roster.filter(r =>
    r.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="text-primary" size={20} />
        <div>
          <h2 className="text-lg font-bold">Operations Command Center</h2>
          <p className="text-xs text-muted-foreground">All services — click any service to see clients</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Est. MRR", value: `$${(data?.totalMRR || 0).toLocaleString()}`, color: "text-green-400" },
          { label: "Active Subs", value: data?.totalClients || 0, color: "text-foreground" },
          { label: "Unique Clients", value: data?.uniqueClients || 0, color: "text-primary" },
          { label: "Emails Sent (7d)", value: data?.emailsSent || 0, color: "text-blue-400" },
          { label: "Emails Failed (7d)", value: data?.emailsFailed || 0, color: data?.emailsFailed ? "text-red-400" : "text-green-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Roster */}
      <Card className="border-border/40 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users size={14} className="text-primary" /> Client Roster — {data?.uniqueClients || 0} Unique Paying Clients
          </CardTitle>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/30"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {filteredRoster.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No clients found</p>
            )}
            {filteredRoster.map(client => (
              <div key={client.email} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{client.business_name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{client.email}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {client.services.map(s => (
                      <Badge key={s} variant="secondary" className="text-[8px] py-0 px-1.5">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-green-400">${client.totalSpend}/mo</div>
                  <div className="text-[9px] text-muted-foreground">{client.services.length} service{client.services.length > 1 ? "s" : ""}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyEmail(client.email)}>
                  <Copy size={12} />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <li><span className="text-foreground font-medium">Check Client Roster</span> above — are they already a client?</li>
              <li><span className="text-foreground font-medium">If new:</span> recommend their top 3 services based on industry</li>
              <li><span className="text-foreground font-medium">Send checkout link</span> via text</li>
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

      {/* Revenue by Service — Clickable */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Revenue by Service (click to expand)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {data?.services.map(svc => (
              <div key={svc.name}>
                <button
                  onClick={() => setExpandedService(expandedService === svc.name ? null : svc.name)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                >
                  {expandedService === svc.name ? <ChevronDown size={12} className="shrink-0 text-primary" /> : <ChevronRight size={12} className="shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">{svc.name}</div>
                    <div className="text-[10px] text-muted-foreground">{svc.price}</div>
                  </div>
                  <Badge variant={svc.activeCount > 0 ? "default" : "outline"} className="text-[9px]">
                    {svc.activeCount} client{svc.activeCount !== 1 ? "s" : ""}
                  </Badge>
                  <div className="text-xs font-bold text-green-400 w-20 text-right">
                    ${svc.totalRevenue.toLocaleString()}/mo
                  </div>
                </button>

                {expandedService === svc.name && (
                  <div className="ml-6 mt-1 mb-2 space-y-1">
                    {svc.clients.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground py-2 pl-2">No active clients</p>
                    ) : (
                      svc.clients.map((cl, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/10 border border-border/30">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate">{cl.business_name}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{cl.email}</div>
                          </div>
                          <div className="text-[9px] text-muted-foreground shrink-0">
                            {cl.created_at ? new Date(cl.created_at).toLocaleDateString() : "—"}
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyEmail(cl.email)}>
                            <Copy size={10} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
