import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign,
  Users,
  TrendingUp,
  Megaphone,
  Mail,
  Globe,
  Wrench,
  Brain,
  Share2,
  PenTool,
  AlertTriangle,
  ExternalLink,
  Bot,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface StreamData {
  name: string;
  icon: React.ReactNode;
  activeClients: number;
  mrr: number;
  lastActivity: string | null;
  status: "green" | "yellow" | "red";
  alerts: string[];
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDay(date: string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const diff = Date.now() - d.getTime();
  if (diff < 7 * 24 * 60 * 60 * 1000) return days[d.getDay()];
  return d.toLocaleDateString();
}

function isStale(date: string | null, days: number): boolean {
  if (!date) return true;
  return Date.now() - new Date(date).getTime() > days * 24 * 60 * 60 * 1000;
}

const StatusDot = ({ status }: { status: "green" | "yellow" | "red" }) => {
  const colors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} shrink-0`} />
  );
};

const AdminBusinessDashboard = () => {
  const [triggeringReport, setTriggeringReport] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-business-dashboard"],
    refetchInterval: 60000,
    queryFn: async () => {
      const [
        contractorClients,
        b2bDental,
        b2bFieldRep,
        gbpClients,
        socialClients,
        newsletterSubs,
        outreachLeads,
        lastContractorLead,
        lastNewsletter,
        lastGbpPost,
        socialNeedingTokens,
      ] = await Promise.all([
        (supabase as any).from("contractor_clients").select("id, active, plan").eq("active", true),
        (supabase as any).from("b2b_subscribers").select("id, active, niche").eq("active", true).or("niche.is.null,niche.eq.dental"),
        (supabase as any).from("b2b_subscribers").select("id, active").eq("active", true).eq("niche", "field_rep_tools"),
        (supabase as any).from("gbp_saas_clients").select("id, active, plan, last_posted_at").eq("active", true),
        (supabase as any).from("social_media_clients").select("id, active, plan, business_name, access_tokens, created_at").eq("active", true),
        supabase.from("newsletter_subscribers" as any).select("id").eq("is_active", true),
        (supabase as any).from("outreach_leads").select("id, status"),
        (supabase as any).from("contractor_leads").select("created_at").order("created_at", { ascending: false }).limit(1),
        (supabase as any).from("newsletter_sends").select("sent_at").order("sent_at", { ascending: false }).limit(1),
        (supabase as any).from("gbp_saas_clients").select("last_posted_at").order("last_posted_at", { ascending: false }).limit(1),
        (supabase as any).from("social_media_clients").select("id, business_name").eq("active", true).or("access_tokens.is.null,access_tokens.eq.{}"),
      ]);

      return {
        contractorClients: contractorClients.data ?? [],
        b2bDental: b2bDental.data ?? [],
        b2bFieldRep: b2bFieldRep.data ?? [],
        gbpClients: gbpClients.data ?? [],
        socialClients: socialClients.data ?? [],
        newsletterSubs: newsletterSubs.data ?? [],
        outreachLeads: outreachLeads.data ?? [],
        lastContractorLead: lastContractorLead.data?.[0]?.created_at ?? null,
        lastNewsletter: lastNewsletter.data?.[0]?.sent_at ?? null,
        lastGbpPost: lastGbpPost.data?.[0]?.last_posted_at ?? null,
        socialNeedingTokens: socialNeedingTokens.data ?? [],
      };
    },
  });

  const handleTriggerReport = async () => {
    setTriggeringReport(true);
    try {
      const { error } = await supabase.functions.invoke("agent-smith-report");
      if (error) throw error;
      toast({ title: "Agent Smith Report", description: "Report sent to matt@m2training.com" });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringReport(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contractorCount = data.contractorClients.length;
  const contractorMRR = contractorCount * 399;

  const dentalCount = data.b2bDental.length;
  const dentalMRR = dentalCount * 49;

  const fieldRepCount = data.b2bFieldRep.length;
  const fieldRepMRR = fieldRepCount * 29;

  const gbpBasic = data.gbpClients.filter((c: any) => c.plan === "basic").length;
  const gbpPro = data.gbpClients.filter((c: any) => c.plan === "pro").length;
  const gbpMRR = gbpBasic * 49 + gbpPro * 99;

  const socialStandard = data.socialClients.filter((c: any) => c.plan === "standard").length;
  const socialPro = data.socialClients.filter((c: any) => c.plan === "pro").length;
  const socialTrainer = data.socialClients.filter((c: any) => c.plan === "trainer").length;
  const socialMRR = socialStandard * 199 + socialPro * 299 + socialTrainer * 149;

  const newsletterCount = data.newsletterSubs.length;

  const outreachByStatus = data.outreachLeads.reduce((acc: Record<string, number>, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const repliedLeads = data.outreachLeads.filter((l: any) => l.status === "replied" || l.status === "Responded");

  const totalMRR = contractorMRR + dentalMRR + fieldRepMRR + gbpMRR + socialMRR;
  const totalActiveClients = contractorCount + dentalCount + fieldRepCount + gbpBasic + gbpPro + socialStandard + socialPro + socialTrainer;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  lastMonday.setHours(0, 0, 0, 0);
  const newsletterSentThisWeek = data.lastNewsletter && new Date(data.lastNewsletter) >= lastMonday;

  const streams: StreamData[] = [
    {
      name: "Contractor Lead Gen",
      icon: <Wrench className="w-5 h-5" />,
      activeClients: contractorCount,
      mrr: contractorMRR,
      lastActivity: data.lastContractorLead,
      status: contractorCount > 0 && !isStale(data.lastContractorLead, 7) ? "green" : contractorCount > 0 ? "yellow" : "green",
      alerts: isStale(data.lastContractorLead, 2) && contractorCount > 0 ? ["No leads in 2+ days"] : [],
    },
    {
      name: "B2B Dental Database",
      icon: <Users className="w-5 h-5" />,
      activeClients: dentalCount,
      mrr: dentalMRR,
      lastActivity: null,
      status: "green",
      alerts: [],
    },
    {
      name: "Field Rep AI Tools",
      icon: <Brain className="w-5 h-5" />,
      activeClients: fieldRepCount,
      mrr: fieldRepMRR,
      lastActivity: null,
      status: "green",
      alerts: [],
    },
    {
      name: "GBP SaaS",
      icon: <Globe className="w-5 h-5" />,
      activeClients: gbpBasic + gbpPro,
      mrr: gbpMRR,
      lastActivity: data.lastGbpPost,
      status: gbpBasic + gbpPro > 0 && !isStale(data.lastGbpPost, 7) ? "green" : gbpBasic + gbpPro > 0 && isStale(data.lastGbpPost, 7) ? "yellow" : "green",
      alerts: isStale(data.lastGbpPost, 4) && gbpBasic + gbpPro > 0 ? ["No posts in 4+ days"] : [],
    },
    {
      name: "Social Media AI",
      icon: <Share2 className="w-5 h-5" />,
      activeClients: socialStandard + socialPro + socialTrainer,
      mrr: socialMRR,
      lastActivity: data.socialClients.length > 0 ? data.socialClients.reduce((latest: string | null, c: any) => {
        if (!c.created_at) return latest;
        if (!latest || c.created_at > latest) return c.created_at;
        return latest;
      }, null) : null,
      status: data.socialNeedingTokens.length > 0 ? "yellow" : "green",
      alerts: data.socialNeedingTokens.length > 0
        ? [`${data.socialNeedingTokens.length} client${data.socialNeedingTokens.length > 1 ? "s" : ""} need token connection`]
        : [],
    },
    {
      name: "Weekly Newsletter",
      icon: <Mail className="w-5 h-5" />,
      activeClients: newsletterCount,
      mrr: 0,
      lastActivity: data.lastNewsletter,
      status: newsletterSentThisWeek ? "green" : dayOfWeek >= 2 && !newsletterSentThisWeek ? "red" : "green",
      alerts: dayOfWeek >= 2 && !newsletterSentThisWeek ? ["Newsletter didn't send this Monday"] : [],
    },
    {
      name: "Web Design",
      icon: <PenTool className="w-5 h-5" />,
      activeClients: data.outreachLeads.length,
      mrr: 0,
      lastActivity: null,
      status: repliedLeads.length > 0 ? "yellow" : "green",
      alerts: repliedLeads.length > 0 ? [`${repliedLeads.length} lead${repliedLeads.length > 1 ? "s" : ""} replied — follow up`] : [],
    },
  ];

  const actionItems: { label: string; detail: string; link?: string }[] = [];

  data.socialNeedingTokens.forEach((c: any) => {
    actionItems.push({
      label: "Connect social accounts",
      detail: c.business_name || `Client #${c.id}`,
    });
  });

  repliedLeads.forEach((l: any) => {
    actionItems.push({
      label: "Lead replied — follow up",
      detail: l.business_name || `Lead #${l.id}`,
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Business Dashboard</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#e8621a]/10">
                <DollarSign className="w-6 h-6 text-[#e8621a]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total MRR</p>
                <p className="text-3xl font-bold text-[#e8621a]">${totalMRR.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">7-Day Revenue</p>
                <p className="text-3xl font-bold">${(totalMRR / 4).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">~weekly from MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <p className="text-3xl font-bold">{totalActiveClients}</p>
                <p className="text-xs text-muted-foreground">+ {newsletterCount} newsletter subs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {streams.map((s) => (
          <Card key={s.name} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.icon}
                  <CardTitle className="text-sm font-medium">{s.name}</CardTitle>
                </div>
                <StatusDot status={s.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">{s.activeClients}</span>
                <span className="text-sm font-semibold text-[#e8621a]">
                  {s.mrr > 0 ? `$${s.mrr.toLocaleString()}/mo` : "Indirect"}
                </span>
              </div>
              {s.lastActivity && (
                <p className="text-xs text-muted-foreground">
                  Last activity: {s.name === "Weekly Newsletter" ? formatDay(s.lastActivity) : timeAgo(s.lastActivity)}
                </p>
              )}
              {s.name === "GBP SaaS" && (gbpBasic > 0 || gbpPro > 0) && (
                <p className="text-xs text-muted-foreground">
                  {gbpBasic} basic / {gbpPro} pro
                </p>
              )}
              {s.name === "Social Media AI" && (socialStandard + socialPro + socialTrainer > 0) && (
                <p className="text-xs text-muted-foreground">
                  {socialStandard} std / {socialPro} pro / {socialTrainer} trainer
                </p>
              )}
              {s.name === "Web Design" && data.outreachLeads.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(outreachByStatus).map(([status, count]) => (
                    <Badge key={status} variant="outline" className="text-[10px] px-1.5 py-0">
                      {status}: {count as number}
                    </Badge>
                  ))}
                </div>
              )}
              {s.alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-yellow-500">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {alert}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {actionItems.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Matt's Action Items ({actionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agent Smith Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Daily automated business report sent to matt@m2training.com
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTriggerReport}
              disabled={triggeringReport}
            >
              {triggeringReport ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Megaphone className="w-4 h-4 mr-1" />
              )}
              Send Report Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBusinessDashboard;
