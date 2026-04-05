import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, Users, TrendingUp, Mail, Globe, Wrench, Brain, Share2,
  PenTool, AlertTriangle, Bot, Loader2, RefreshCw, CheckCircle, Clock,
  XCircle, Building2, ChevronDown, ChevronUp, Zap, ArrowUpRight
} from "lucide-react";

const INTERNAL_EMAILS = ["matt@mattmichelstraining.com", "matt@mattmichelstraining.com", "matthewmichels4@gmail.com"];
const isInternal = (email: string) => INTERNAL_EMAILS.includes(email?.toLowerCase());

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

function isStale(date: string | null, days: number): boolean {
  if (!date) return true;
  return Date.now() - new Date(date).getTime() > days * 24 * 60 * 60 * 1000;
}

interface ClientDetail {
  businessName: string;
  email: string;
  industry: string | null;
  service: string;
  price: number;
  plan: string | null;
  lastActivity: string | null;
  isInternal: boolean;
  status: "active" | "stale" | "new";
  createdAt: string;
}

const AdminBusinessDashboard = () => {
  const [showAllClients, setShowAllClients] = useState(false);
  const [triggeringReport, setTriggeringReport] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-business-dashboard-v2"],
    staleTime: 60000,
    refetchInterval: 60000,
    queryFn: async () => {
      // Fetch all client tables in parallel
      const [
        contractorRes, gbpRes, socialRes, newsletterRes,
        adsRes, blogRes, battlecardRes, competitorRes,
        localSeoRes, priceMonRes, faqRes, handbookRes,
        grantRes, reviewRes, marketIntelRes, permitRes,
        oshaRes, collectionsRes, inventoryRes, birthdayRes,
        appointmentRes, reviewReqRes, directMailRes,
        emailSent7d, emailFailed7d, lastNewsletter,
        outreachLeads, dripConversions,
      ] = await Promise.all([
        (supabase as any).from("contractor_clients").select("business_name, email, industry, active, plan, last_lead_at, created_at").eq("active", true),
        (supabase as any).from("gbp_saas_clients").select("business_name, email, industry, active, plan, last_posted_at, created_at").eq("active", true),
        (supabase as any).from("social_media_clients").select("business_name, email, industry, active, plan, created_at").eq("active", true),
        supabase.from("newsletter_subscribers" as any).select("id, email, is_active").eq("is_active", true),
        (supabase as any).from("ads_copy_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("blog_post_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("battlecard_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("competitor_watch_clients").select("business_name, email, industry, active, last_report_at, created_at").eq("active", true),
        (supabase as any).from("local_seo_clients").select("business_name, email, industry, active, last_generated_at, created_at").eq("active", true),
        (supabase as any).from("price_monitor_clients").select("business_name, email, industry, active, last_report_at, created_at").eq("active", true),
        (supabase as any).from("faq_refresh_clients").select("business_name, email, industry, active, last_refreshed_at, created_at").eq("active", true),
        (supabase as any).from("handbook_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("grant_finder_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("review_response_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("market_intel_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("permit_monitor_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("osha_compliance_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("collections_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("inventory_alert_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("birthday_campaign_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("appointment_reminders").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("review_request_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        (supabase as any).from("direct_mail_clients").select("business_name, email, industry, active, last_sent_at, created_at").eq("active", true),
        // Email stats
        supabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("status", "sent").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("email_send_log").select("*", { count: "exact", head: true }).or("status.eq.dlq,status.eq.failed").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        (supabase as any).from("newsletter_sends").select("sent_at").order("sent_at", { ascending: false }).limit(1),
        (supabase as any).from("outreach_leads").select("id, status, business_name, email"),
        supabase.from("drip_conversions").select("id, email, service_interested, converted_at").order("converted_at", { ascending: false }).limit(10),
      ]);

      // Build client details
      const clients: ClientDetail[] = [];

      const addClients = (data: any[], service: string, price: number, lastField: string | null, plan?: string) => {
        (data || []).forEach((c: any) => {
          const lastAct = lastField ? c[lastField] : null;
          const daysSince = lastAct ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000) : null;
          clients.push({
            businessName: c.business_name,
            email: c.email,
            industry: c.industry,
            service,
            price,
            plan: c.plan || plan || null,
            lastActivity: lastAct,
            isInternal: isInternal(c.email),
            status: !lastAct ? "new" : daysSince !== null && daysSince <= 7 ? "active" : "stale",
            createdAt: c.created_at,
          });
        });
      };

      addClients(contractorRes.data, "Contractor Lead Gen", 399, "last_lead_at");
      addClients(gbpRes.data, "GBP SaaS", 0, "last_posted_at"); // price varies by plan
      addClients(socialRes.data, "Social Media AI", 0, "last_posted_at");
      addClients(adsRes.data, "Google Ads Copy", 39, "last_sent_at");
      addClients(blogRes.data, "Blog Posts", 79, "last_sent_at");
      addClients(battlecardRes.data, "Competitive Battlecard", 39, "last_sent_at");
      addClients(competitorRes.data, "Competitor Watch", 69, "last_report_at");
      addClients(localSeoRes.data, "Local SEO Pages", 59, "last_generated_at");
      addClients(priceMonRes.data, "Price Monitor", 49, "last_report_at");
      addClients(faqRes.data, "FAQ Refresh", 29, "last_refreshed_at");
      addClients(handbookRes.data, "Employee Handbook", 99, "last_sent_at");
      addClients(grantRes.data, "Grant Finder", 149, "last_sent_at");
      addClients(reviewRes.data, "Review Response", 49, "last_sent_at");
      addClients(marketIntelRes.data, "Market Intelligence", 49, "last_sent_at");
      addClients(permitRes.data, "Permit Monitor", 79, "last_sent_at");
      addClients(oshaRes.data, "OSHA Compliance", 99, "last_sent_at");
      addClients(collectionsRes.data, "Late Payment Collector", 49, "last_sent_at");
      addClients(inventoryRes.data, "Inventory Alerts", 49, "last_sent_at");
      addClients(birthdayRes.data, "Birthday Campaign", 29, "last_sent_at");
      addClients(appointmentRes.data, "Appointment Reminders", 29, "last_sent_at");
      addClients(reviewReqRes.data, "Review Request SMS", 29, "last_sent_at");
      addClients(directMailRes.data, "Direct Mail", 39, "last_sent_at");

      // Fix GBP pricing
      clients.forEach(c => {
        if (c.service === "GBP SaaS") c.price = c.plan === "pro" ? 99 : 49;
        if (c.service === "Social Media AI") {
          c.price = c.plan === "pro" ? 299 : c.plan === "trainer" ? 149 : 199;
        }
      });

      const realClients = clients.filter(c => !c.isInternal);
      const internalClients = clients.filter(c => c.isInternal);
      const realMRR = realClients.reduce((sum, c) => sum + c.price, 0);
      const internalCount = new Set(internalClients.map(c => c.email)).size;
      const realCount = new Set(realClients.map(c => c.email)).size;

      // Newsletter
      const now = new Date();
      const dayOfWeek = now.getDay();
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      lastMonday.setHours(0, 0, 0, 0);
      const lastNewsletterDate = lastNewsletter.data?.[0]?.sent_at ?? null;
      const newsletterSentThisWeek = lastNewsletterDate && new Date(lastNewsletterDate) >= lastMonday;

      return {
        realClients,
        internalClients,
        realMRR,
        realCount,
        internalCount,
        newsletterSubs: newsletterRes.data?.length ?? 0,
        emailsSent7d: emailSent7d.count ?? 0,
        emailsFailed7d: emailFailed7d.count ?? 0,
        newsletterSentThisWeek,
        lastNewsletterDate,
        outreachLeads: outreachLeads.data ?? [],
        dripConversions: dripConversions.data ?? [],
      };
    },
  });

  const handleTriggerReport = async () => {
    setTriggeringReport(true);
    try {
      const { error } = await supabase.functions.invoke("agent-smith-report");
      if (error) throw error;
      toast({ title: "Report Sent", description: "Daily report sent to your email" });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringReport(false);
    }
  };

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const { realClients, internalClients, realMRR, realCount, internalCount } = data;

  // Group real clients by unique business
  const realByBusiness = realClients.reduce((acc: Record<string, ClientDetail[]>, c) => {
    const key = c.email;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  // Pipeline stats
  const outreachByStatus = data.outreachLeads.reduce((acc: Record<string, number>, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const hotLeads = data.outreachLeads.filter((l: any) => l.status === "replied" || l.status === "Responded");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Business Command Center</h2>
          <p className="text-xs text-muted-foreground">Real-time revenue, operations & pipeline</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* ── TOP METRICS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Real MRR</span>
            </div>
            <p className="text-3xl font-black text-primary">${realMRR.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{realCount} paying client{realCount !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Internal</span>
            </div>
            <p className="text-3xl font-black">{internalClients.length}</p>
            <p className="text-[10px] text-muted-foreground">{internalCount} internal business{internalCount !== 1 ? "es" : ""} · $0</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Emails (7d)</span>
            </div>
            <p className="text-3xl font-black">{data.emailsSent7d}</p>
            <p className="text-[10px] text-muted-foreground">
              {data.emailsFailed7d > 0 ? (
                <span className="text-red-400">{data.emailsFailed7d} failed</span>
              ) : (
                <span className="text-green-400">0 failures</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Newsletter</span>
            </div>
            <p className="text-3xl font-black">{data.newsletterSubs}</p>
            <p className="text-[10px] text-muted-foreground">
              {data.newsletterSentThisWeek ? (
                <span className="text-green-400">✓ Sent this week</span>
              ) : (
                <span className="text-yellow-400">⚠ Not sent yet</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── ACTION ITEMS ── */}
      {(hotLeads.length > 0 || data.emailsFailed7d > 0 || !data.newsletterSentThisWeek) && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotLeads.map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/50">
                <ArrowUpRight className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">Lead replied — follow up now</p>
                  <p className="text-[10px] text-muted-foreground truncate">{l.business_name || l.email}</p>
                </div>
              </div>
            ))}
            {!data.newsletterSentThisWeek && new Date().getDay() >= 2 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/50">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                <p className="text-xs font-bold">Weekly newsletter hasn't sent yet this week</p>
              </div>
            )}
            {data.emailsFailed7d > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/50">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs font-bold">{data.emailsFailed7d} emails failed in the last 7 days</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── PAYING CLIENTS ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Paying Clients ({realClients.length} subscriptions from {realCount} businesses)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {realClients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No paying B2B clients yet</p>
              <p className="text-xs text-muted-foreground mt-1">When clients sign up through your service pages, they'll appear here with full details</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(realByBusiness).map(([email, subscriptions]) => (
                <div key={email} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{subscriptions[0].businessName}</p>
                      <p className="text-[10px] text-muted-foreground">{email} · {subscriptions[0].industry || "No industry"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">${subscriptions.reduce((s, c) => s + c.price, 0)}/mo</p>
                      <p className="text-[10px] text-muted-foreground">{subscriptions.length} service{subscriptions.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subscriptions.map((s, i) => (
                      <Badge key={i} variant={s.status === "active" ? "default" : "outline"} className="text-[9px]">
                        {s.service} · ${s.price}
                        {s.lastActivity && ` · ${timeAgo(s.lastActivity)}`}
                        {s.status === "new" && " · NEW"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── INTERNAL CLIENTS (YOUR BUSINESSES) ── */}
      <Card className="border-border/20 opacity-80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAllClients(!showAllClients)}>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Internal Clients — Your Businesses ($0 cost)
              <Badge variant="outline" className="text-[9px]">{internalClients.length} subscriptions</Badge>
            </CardTitle>
            {showAllClients ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <p className="text-[10px] text-muted-foreground">These are services running for your own business (M2 Development). They don't generate revenue.</p>
        </CardHeader>
        {showAllClients && (
          <CardContent>
            <div className="space-y-1.5">
              {internalClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/10">
                  {c.status === "active" ? <CheckCircle size={12} className="text-green-400 shrink-0" /> :
                   c.status === "new" ? <Clock size={12} className="text-yellow-400 shrink-0" /> :
                   <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                  <span className="text-xs font-medium flex-1">{c.service}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.lastActivity ? timeAgo(c.lastActivity) : "Never delivered"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SALES PIPELINE ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Sales Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.outreachLeads.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(outreachByStatus).map(([status, count]) => (
                <Badge key={status} variant={status === "replied" || status === "Responded" ? "default" : "outline"} className="text-xs">
                  {status}: {count as number}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No outreach leads in the pipeline</p>
          )}

          {data.dripConversions.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-1.5">Recent Conversions</p>
              {data.dripConversions.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 p-1.5 text-[10px]">
                  <CheckCircle size={10} className="text-green-400 shrink-0" />
                  <span className="text-muted-foreground">{c.email}</span>
                  <span className="text-foreground font-medium">{c.service_interested}</span>
                  <span className="text-muted-foreground ml-auto">{timeAgo(c.converted_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Smith */}
      <Card className="border-border/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Daily automated business report</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleTriggerReport} disabled={triggeringReport}>
            {triggeringReport ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Send Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBusinessDashboard;
