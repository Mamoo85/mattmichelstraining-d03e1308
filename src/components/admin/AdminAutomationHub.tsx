import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Zap, Mail, Package, BarChart3, Play, Eye, Loader2,
  CheckCircle, Clock, RefreshCw, TrendingUp
} from "lucide-react";

interface AutomationCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  status: "active" | "idle" | "running";
  stats: { label: string; value: string | number }[];
  actions: { label: string; onClick: () => void; loading?: boolean; variant?: "default" | "outline" }[];
  badge?: string;
}

function AutomationCard({ icon: Icon, title, description, status, stats, actions, badge }: AutomationCardProps) {
  const statusColor = status === "active" ? "text-green-500" : status === "running" ? "text-primary" : "text-muted-foreground";
  const statusLabel = status === "active" ? "Active" : status === "running" ? "Running..." : "Idle";

  return (
    <Card className="border-border/40 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">{title}</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className={`flex items-center gap-1 text-[10px] font-bold ${statusColor}`}>
              {status === "running" ? <Loader2 size={10} className="animate-spin" /> : <div className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-green-500" : "bg-muted-foreground"}`} />}
              {statusLabel}
            </div>
            {badge && <Badge variant="outline" className="text-[9px] px-1.5">{badge}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className="text-center p-2 bg-muted/30 rounded-lg">
              <div className="text-base font-black text-foreground">{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {actions.map(action => (
            <Button
              key={action.label}
              onClick={action.onClick}
              disabled={action.loading}
              variant={action.variant || "default"}
              size="sm"
              className="flex-1 text-xs font-bold"
            >
              {action.loading ? <Loader2 size={11} className="animate-spin mr-1" /> : null}
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAutomationHub() {
  const [newsletterRunning, setNewsletterRunning] = useState(false);
  const [newsletterDryRunning, setNewsletterDryRunning] = useState(false);
  const [productsRunning, setProductsRunning] = useState(false);
  const [lastDryRun, setLastDryRun] = useState<{ subject: string; wordCount: number } | null>(null);

  // Fetch newsletter stats
  const { data: newsletterStats } = useQuery({
    queryKey: ["newsletter-automation-stats"],
    queryFn: async () => {
      const [subsRes, sendsRes] = await Promise.all([
        supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("newsletter_sends").select("id, sent_at").like("template_name", "sports_weekly_%").order("sent_at", { ascending: false }).limit(1),
      ]);
      return {
        subscribers: subsRes.count ?? 0,
        lastSent: sendsRes.data?.[0]?.sent_at
          ? new Date(sendsRes.data[0].sent_at).toLocaleDateString()
          : "Never",
        totalIssues: sendsRes.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch program stats
  const { data: programStats, refetch: refetchPrograms } = useQuery({
    queryKey: ["automation-program-stats"],
    queryFn: async () => {
      const [totalRes, seoRes] = await Promise.all([
        supabase.from("training_programs").select("id", { count: "exact", head: true }),
        supabase.from("seo_landing_pages" as any).select("id", { count: "exact", head: true }),
      ]);
      return {
        totalPrograms: totalRes.count ?? 0,
        seoPages: seoRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  // Fetch web design lead stats
  const { data: leadStats } = useQuery({
    queryKey: ["automation-lead-stats"],
    queryFn: async () => {
      const [totalRes, autoRes] = await Promise.all([
        supabase.from("web_design_leads" as any).select("id", { count: "exact", head: true }),
        supabase.from("web_design_leads" as any).select("id", { count: "exact", head: true }).ilike("description", "%auto_prospected%"),
      ]);
      return {
        total: totalRes.count ?? 0,
        autoProspected: autoRes.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const runNewsletter = async (dryRun = false) => {
    if (dryRun) setNewsletterDryRunning(true);
    else setNewsletterRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke("sports-newsletter-weekly", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (dryRun) {
        setLastDryRun({ subject: data.subject, wordCount: data.body?.split(" ").length || 0 });
        toast.success(`Dry run OK — "${data.subject}" (${data.body?.split(" ").length} words)`);
      } else {
        toast.success(`Newsletter sent to ${data.sent} subscribers! Issue #${data.issue}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Newsletter failed");
    } finally {
      setNewsletterRunning(false);
      setNewsletterDryRunning(false);
    }
  };

  const runProductGeneration = async () => {
    setProductsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-generate-products", {
        body: { count: 3 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generated: string[] = data.generated || [];
      toast.success(`Generated ${generated.length} programs: ${generated.join(", ")}`);
      refetchPrograms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Product generation failed");
    } finally {
      setProductsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Automation Hub</h2>
          <p className="text-xs text-muted-foreground">All revenue automations in one place — monitor, trigger, and track</p>
        </div>
        <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30">5 Machines Running</Badge>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Mail, label: "Newsletter Subscribers", value: newsletterStats?.subscribers ?? "—", color: "text-blue-400" },
          { icon: TrendingUp, label: "Auto-Prospected Leads", value: leadStats?.autoProspected ?? "—", color: "text-orange-400" },
          { icon: Package, label: "Programs in Store", value: programStats?.totalPrograms ?? "—", color: "text-purple-400" },
          { icon: BarChart3, label: "SEO Pages Live", value: programStats?.seoPages ?? "—", color: "text-green-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon size={16} className={s.color} />
              <div>
                <div className="text-xl font-black">{s.value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Automation Cards */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Newsletter */}
        <AutomationCard
          icon={Mail}
          title="The M² Brief — Weekly Newsletter"
          description="Auto-generates and sends a sports performance newsletter every Friday"
          status={newsletterRunning || newsletterDryRunning ? "running" : "idle"}
          badge="Weekly"
          stats={[
            { label: "Subscribers", value: newsletterStats?.subscribers ?? "—" },
            { label: "Last Sent", value: newsletterStats?.lastSent ?? "—" },
            { label: "Issues Out", value: newsletterStats?.totalIssues ?? "—" },
          ]}
          actions={[
            { label: newsletterRunning ? "Sending..." : "Send Now", onClick: () => runNewsletter(false), loading: newsletterRunning, variant: "default" },
            { label: newsletterDryRunning ? "Generating..." : "Preview", onClick: () => runNewsletter(true), loading: newsletterDryRunning, variant: "outline" },
          ]}
        />

        {/* Product Generator */}
        <AutomationCard
          icon={Package}
          title="Digital Product Machine"
          description="Auto-generates niche training programs + SEO pages for each"
          status={productsRunning ? "running" : "idle"}
          badge="15 Catalog Items"
          stats={[
            { label: "Programs", value: programStats?.totalPrograms ?? "—" },
            { label: "SEO Pages", value: programStats?.seoPages ?? "—" },
            { label: "Remaining", value: Math.max(0, 15 - (programStats?.totalPrograms ?? 0)) },
          ]}
          actions={[
            { label: productsRunning ? "Generating..." : "Generate 3 Programs", onClick: runProductGeneration, loading: productsRunning, variant: "default" },
          ]}
        />

        {/* Prospector (summary card) */}
        <AutomationCard
          icon={Zap}
          title="Lead Prospector"
          description="Finds local businesses without good websites and queues outreach"
          status="idle"
          badge="95% Automated"
          stats={[
            { label: "Total Leads", value: leadStats?.total ?? "—" },
            { label: "Auto-Found", value: leadStats?.autoProspected ?? "—" },
            { label: "Industries", value: "18" },
          ]}
          actions={[
            {
              label: "Open Prospector",
              onClick: () => {
                // Scroll to prospector tab — parent component handles tab switching
                const event = new CustomEvent("switch-webdesign-tab", { detail: "prospector" });
                window.dispatchEvent(event);
              },
              variant: "outline",
            },
          ]}
        />

        {/* SEO Machine */}
        <AutomationCard
          icon={BarChart3}
          title="SEO Content Machine"
          description="Auto-generates local SEO landing pages for keyword targeting"
          status="idle"
          badge="Bulk Generation"
          stats={[
            { label: "Pages Live", value: programStats?.seoPages ?? "—" },
            { label: "Auto-Generated", value: programStats?.seoPages ?? "—" },
            { label: "Monthly Goal", value: "10" },
          ]}
          actions={[
            {
              label: "Open SEO Engine",
              onClick: () => {
                // Navigate to growth tab
                const event = new CustomEvent("navigate-admin", { detail: "growth" });
                window.dispatchEvent(event);
              },
              variant: "outline",
            },
          ]}
        />
      </div>

      {/* Schedule Reference */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock size={12} className="text-primary" /> Recommended Automation Schedule
          </h3>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              { freq: "Daily", machine: "Lead Prospector", action: "Run 1 industry per day across Metro Detroit cities", done: false },
              { freq: "Daily", machine: "Web Design Drip", action: "Process drip queue — sends next email in sequence for due leads", done: false },
              { freq: "Friday", machine: "M² Brief Newsletter", action: "Auto-generate + send to all newsletter subscribers", done: false },
              { freq: "Monthly", machine: "Digital Product Machine", action: "Generate 3 new niche programs + SEO pages", done: false },
              { freq: "Weekly", machine: "SEO Engine", action: "Generate 5–10 new local SEO pages", done: false },
            ].map(s => (
              <div key={s.action} className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 px-1.5">{s.freq}</Badge>
                <div>
                  <div className="font-medium text-foreground">{s.machine}</div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">{s.action}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 flex items-center gap-1.5">
            <CheckCircle size={10} className="text-primary" />
            To fully automate, configure these as pg_cron jobs in your Supabase dashboard or use the Supabase Edge Function scheduler.
          </p>
        </CardContent>
      </Card>

      {/* Last Newsletter Dry Run */}
      {lastDryRun && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={13} className="text-primary" />
              <span className="text-xs font-bold">Last Dry Run Preview</span>
            </div>
            <p className="text-xs text-muted-foreground">Subject: <span className="text-foreground font-medium">{lastDryRun.subject}</span></p>
            <p className="text-xs text-muted-foreground mt-1">~{lastDryRun.wordCount} words generated. Review in Compose tab before sending live.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
