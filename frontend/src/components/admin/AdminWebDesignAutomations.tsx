import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Receipt, BarChart3, Users, RotateCcw,
  Play, Loader2, TrendingUp, Mail, Globe
} from "lucide-react";

interface AutomationStat {
  label: string;
  value: number | string;
}

interface AutomationDef {
  icon: React.ElementType;
  title: string;
  description: string;
  functionName: string | null;
  badge: string;
  stats: AutomationStat[];
}

export default function AdminWebDesignAutomations() {
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-03"

  const { data: counts, refetch } = useQuery({
    queryKey: ["web-design-automation-counts", currentMonth],
    queryFn: async () => {
      const [proposals, invoices, reports, partners, winbacks] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .like("template_name", "proposal_agreement"),
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .like("template_name", `auto_invoice_${currentMonth}-%`),
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .like("template_name", `client_monthly_report_${currentMonth}-%`),
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .like("template_name", "partner_welcome_kit"),
        supabase
          .from("email_send_log")
          .select("id", { count: "exact", head: true })
          .like("template_name", "web_design_winback"),
      ]);

      return {
        proposals: proposals.count ?? 0,
        invoices: invoices.count ?? 0,
        reports: reports.count ?? 0,
        partners: partners.count ?? 0,
        winbacks: winbacks.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const runAutomation = async (functionName: string, label: string) => {
    setRunning((prev) => ({ ...prev, [functionName]: true }));
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${label} completed successfully.`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setRunning((prev) => ({ ...prev, [functionName]: false }));
    }
  };

  const automations: AutomationDef[] = [
    {
      icon: FileText,
      title: "Proposal & Agreement Sender",
      description: "Sends service agreement + proposal emails to qualifying web design leads who have not yet received one.",
      functionName: "auto-proposal-agreement",
      badge: "Lead Nurture",
      stats: [
        { label: "Proposals Sent", value: counts?.proposals ?? "—" },
        { label: "Avg Close Rate", value: "~35%" },
        { label: "Trigger", value: "Manual / Daily" },
      ],
    },
    {
      icon: Receipt,
      title: "Monthly Invoice Runner",
      description: "Sends $49/mo hosting invoices to all active web design clients for the current billing month.",
      functionName: "auto-invoice",
      badge: "Recurring Revenue",
      stats: [
        { label: "Sent This Month", value: counts?.invoices ?? "—" },
        { label: "Rate", value: "$49/mo" },
        { label: "Trigger", value: "Manual / Cron" },
      ],
    },
    {
      icon: BarChart3,
      title: "Monthly Client Report",
      description: "Delivers a personalized monthly performance summary to each web design client — site snapshot, SEO notes, and next steps.",
      functionName: "monthly-client-report",
      badge: "Retention",
      stats: [
        { label: "Reports Sent", value: counts?.reports ?? "—" },
        { label: "Month", value: currentMonth },
        { label: "Trigger", value: "Manual / Cron" },
      ],
    },
    {
      icon: Users,
      title: "Partner Onboarding",
      description: "Sends a welcome kit email to new referral partners. Triggered automatically when a partner signs up via the partner intake form.",
      functionName: null,
      badge: "HTTP-Triggered",
      stats: [
        { label: "Partners Onboarded", value: counts?.partners ?? "—" },
        { label: "Trigger", value: "HTTP POST" },
        { label: "Manual Run", value: "N/A" },
      ],
    },
    {
      icon: RotateCcw,
      title: "Web Design Winback",
      description: "Re-engages lapsed leads and former clients who haven't had activity in 90+ days with a personalized winback email.",
      functionName: "web-design-winback",
      badge: "Winback",
      stats: [
        { label: "Winbacks Sent", value: counts?.winbacks ?? "—" },
        { label: "Target", value: "90-day lapse" },
        { label: "Trigger", value: "Manual / Weekly" },
      ],
    },
  ];

  const summaryStats = [
    { icon: FileText, label: "Proposals", value: counts?.proposals ?? "—", color: "text-blue-400" },
    { icon: Receipt, label: "Invoices", value: counts?.invoices ?? "—", color: "text-green-400" },
    { icon: BarChart3, label: "Reports", value: counts?.reports ?? "—", color: "text-purple-400" },
    { icon: RotateCcw, label: "Winbacks", value: counts?.winbacks ?? "—", color: "text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Web Design Automations</h2>
          <p className="text-xs text-muted-foreground">
            Run and monitor client communication automations for Matt's web design business
          </p>
        </div>
        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
          <Globe size={10} className="mr-1" />
          Web Design
        </Badge>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryStats.map((s) => (
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

      {/* Automation cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {automations.map((automation) => {
          const Icon = automation.icon;
          const isRunning = automation.functionName ? running[automation.functionName] : false;

          return (
            <Card key={automation.title} className="border-border/40 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">{automation.title}</CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {automation.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
                    {automation.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {automation.stats.map((stat) => (
                    <div key={stat.label} className="text-center p-2 bg-muted/30 rounded-lg">
                      <div className="text-base font-black text-foreground">{stat.value}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-widest">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {automation.functionName ? (
                  <Button
                    onClick={() => runAutomation(automation.functionName!, automation.title)}
                    disabled={isRunning}
                    size="sm"
                    className="w-full text-xs font-bold"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={11} className="animate-spin mr-1" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play size={11} className="mr-1" />
                        Run Now
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold opacity-50 cursor-not-allowed"
                  >
                    <Mail size={11} className="mr-1" />
                    Auto-triggered via HTTP
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info box */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp size={12} className="text-primary" /> Recommended Schedule
          </h3>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              { freq: "1st of Month", task: "Auto Invoice", detail: "Bill all active hosting clients" },
              { freq: "3rd of Month", task: "Monthly Report", detail: "Send performance summaries" },
              { freq: "As Needed", task: "Proposals", detail: "Run when new leads qualify" },
              { freq: "Weekly", task: "Winback", detail: "Re-engage 90-day lapsed leads" },
            ].map((row) => (
              <div key={row.task} className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 px-1.5">
                  {row.freq}
                </Badge>
                <div>
                  <div className="font-medium text-foreground">{row.task}</div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">{row.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
