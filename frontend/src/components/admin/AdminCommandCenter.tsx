/**
 * AdminCommandCenter — the admin home dashboard.
 * Shows MRR, active clients, pending actions, pipeline, and system health at a glance.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Users, AlertCircle, TrendingUp,
  CheckCircle, Clock, Mail, Wifi, Phone, ArrowRight,
  Loader2, Activity,
} from "lucide-react";

interface Props {
  onNavigate: (toolKey: string) => void;
}

export default function AdminCommandCenter({ onNavigate }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-command-center"],
    staleTime: 30000,
    refetchInterval: 30000,
    queryFn: async () => {
      const [
        subsRes, fulfillmentRes, outreachRes,
        emailOkRes, emailFailRes, supportRes,
      ] = await Promise.all([
        // Active subscriptions with MRR
        (supabase as any)
          .from("service_subscriptions")
          .select("id, service_type, monthly_price, status, fulfillment_stage")
          .eq("status", "active"),
        // Pending fulfillment items
        (supabase as any)
          .from("service_subscriptions")
          .select("id, service_type, fulfillment_stage, started_at, client_id")
          .not("fulfillment_stage", "ilike", "%Active%")
          .order("started_at", { ascending: false })
          .limit(10),
        // Outreach pipeline
        (supabase as any)
          .from("outreach_leads")
          .select("id, status"),
        // Email health (last 24h)
        supabase.from("email_send_log")
          .select("*", { count: "exact", head: true })
          .eq("status", "sent")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        supabase.from("email_send_log")
          .select("*", { count: "exact", head: true })
          .or("status.eq.dlq,status.eq.failed")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        // Open support tickets
        supabase.from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
      ]);

      // MRR calculation
      const activeSubs = subsRes.data || [];
      const mrr = activeSubs.reduce((sum: number, s: any) => sum + (s.monthly_price || 0), 0);
      const mrrDollars = Math.round(mrr / 100);

      // Client count by service type
      const serviceCount: Record<string, number> = {};
      activeSubs.forEach((s: any) => {
        serviceCount[s.service_type] = (serviceCount[s.service_type] || 0) + 1;
      });
      const totalClients = activeSubs.length;

      // Fulfillment pending
      const pendingFulfillment = fulfillmentRes.data || [];
      const actionRequired = pendingFulfillment.filter(
        (p: any) => (p.fulfillment_stage || "").includes("New Lead") || (p.fulfillment_stage || "").includes("Action Required")
      ).length;

      // Pipeline stats
      const leads = outreachRes.data || [];
      const pipelineStats = {
        total: leads.length,
        new: leads.filter((l: any) => l.status === "new" || l.status === "New").length,
        contacted: leads.filter((l: any) => l.status === "contacted" || l.status === "Contacted" || l.status === "emailed").length,
        replied: leads.filter((l: any) => l.status === "replied" || l.status === "Responded").length,
        won: leads.filter((l: any) => l.status === "won" || l.status === "Won" || l.status === "converted").length,
      };

      // System health
      const emailsSent = emailOkRes.count ?? 0;
      const emailsFailed = emailFailRes.count ?? 0;
      const emailHealthy = emailsFailed === 0 || (emailsSent > 0 && emailsFailed / emailsSent < 0.1);

      return {
        mrrDollars,
        totalClients,
        serviceCount,
        actionRequired,
        pendingFulfillment: pendingFulfillment.length,
        pipelineStats,
        emailsSent,
        emailsFailed,
        emailHealthy,
        supportOpen: supportRes.count ?? 0,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="text-primary animate-spin" />
      </div>
    );
  }

  // Top services by client count
  const topServices = Object.entries(data.serviceCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ── ROW 1: Key Metrics ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* MRR */}
        <Card
          className="border-green-500/20 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition"
          onClick={() => onNavigate("revenue")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-green-400" />
              <span className="text-[9px] text-green-400/70 uppercase tracking-widest font-bold">Monthly Revenue</span>
            </div>
            <p className="text-2xl font-black text-green-400">
              ${data.mrrDollars.toLocaleString()}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">MRR from active subscriptions</p>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card
          className="border-blue-500/20 bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 transition"
          onClick={() => onNavigate("ops")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-blue-400" />
              <span className="text-[9px] text-blue-400/70 uppercase tracking-widest font-bold">Active Clients</span>
            </div>
            <p className="text-2xl font-black text-blue-400">{data.totalClients}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">across {Object.keys(data.serviceCount).length} products</p>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 2: Action Required + Pipeline ───────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pending Actions */}
        <Card
          className={`cursor-pointer transition ${
            data.actionRequired > 0
              ? "border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10"
              : "border-border/30 bg-card/50 hover:bg-muted/10"
          }`}
          onClick={() => onNavigate("fulfillment")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {data.actionRequired > 0 ? (
                <AlertCircle size={14} className="text-orange-400" />
              ) : (
                <CheckCircle size={14} className="text-green-400" />
              )}
              <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Actions</span>
            </div>
            <p className={`text-2xl font-black ${data.actionRequired > 0 ? "text-orange-400" : "text-green-400"}`}>
              {data.actionRequired}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {data.actionRequired > 0
                ? "new purchases need onboarding"
                : "all caught up"}
            </p>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card
          className="border-purple-500/20 bg-purple-500/5 cursor-pointer hover:bg-purple-500/10 transition"
          onClick={() => onNavigate("prospector")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-purple-400" />
              <span className="text-[9px] text-purple-400/70 uppercase tracking-widest font-bold">Pipeline</span>
            </div>
            <p className="text-2xl font-black text-purple-400">{data.pipelineStats.total}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-[8px] text-muted-foreground">{data.pipelineStats.contacted} contacted</span>
              <span className="text-[8px] text-green-400">{data.pipelineStats.replied} replied</span>
              <span className="text-[8px] text-primary">{data.pipelineStats.won} won</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 3: Top Services ─────────────────────────────── */}
      {topServices.length > 0 && (
        <Card className="border-border/30 bg-card/50">
          <CardContent className="p-3">
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              Active Services
            </p>
            <div className="space-y-1.5">
              {topServices.map(([service, count]) => {
                const label = service.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const pct = data.totalClients > 0 ? Math.round((count / data.totalClients) * 100) : 0;
                return (
                  <div key={service} className="flex items-center gap-2">
                    <span className="text-[10px] text-foreground flex-1 truncate">{label}</span>
                    <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-foreground w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ROW 4: System Health ─────────────────────────────── */}
      <Card className="border-border/30 bg-card/50">
        <CardContent className="p-3">
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
            System Health
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* Email */}
            <button
              onClick={() => onNavigate("email-log")}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition"
            >
              <div className={`w-2 h-2 rounded-full ${data.emailHealthy ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              <div className="text-left">
                <p className="text-[10px] font-bold text-foreground">Email</p>
                <p className="text-[8px] text-muted-foreground">
                  {data.emailsSent} sent / {data.emailsFailed} fail
                </p>
              </div>
            </button>

            {/* Support */}
            <button
              onClick={() => onNavigate("support")}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition"
            >
              <div className={`w-2 h-2 rounded-full ${data.supportOpen === 0 ? "bg-green-500" : "bg-yellow-500"}`} />
              <div className="text-left">
                <p className="text-[10px] font-bold text-foreground">Support</p>
                <p className="text-[8px] text-muted-foreground">
                  {data.supportOpen} open
                </p>
              </div>
            </button>

            {/* Fulfillment */}
            <button
              onClick={() => onNavigate("fulfillment")}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition"
            >
              <div className={`w-2 h-2 rounded-full ${data.pendingFulfillment === 0 ? "bg-green-500" : "bg-orange-500"}`} />
              <div className="text-left">
                <p className="text-[10px] font-bold text-foreground">Onboard</p>
                <p className="text-[8px] text-muted-foreground">
                  {data.pendingFulfillment} pending
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Links ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Fulfillment", key: "fulfillment", icon: Activity, color: "#f97316" },
          { label: "Health", key: "health", icon: CheckCircle, color: "#22c55e" },
          { label: "Prospector", key: "prospector", icon: TrendingUp, color: "#a855f7" },
        ].map((q) => (
          <button
            key={q.key}
            onClick={() => onNavigate(q.key)}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/30 bg-card/50 hover:bg-muted/20 transition text-left"
          >
            <q.icon size={13} style={{ color: q.color }} />
            <span className="text-[10px] font-bold text-foreground">{q.label}</span>
            <ArrowRight size={9} className="text-muted-foreground ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}
