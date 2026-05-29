import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, X, Play, CheckCircle, Eye, TrendingUp, Search,
  Target, Megaphone, Shield, ArrowLeft, Star, Copy, Save,
} from "lucide-react";

type Report = {
  id: string;
  report_week: string;
  raw_analytics: Record<string, any>;
  ai_analysis: Record<string, any>;
  summary_text: string;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reviewed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  actioned: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-amber-500/20 text-amber-600",
  low: "bg-muted text-muted-foreground",
};

const AdminCmoReports = () => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["cmo-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_marketing_reports")
        .select("*")
        .order("report_week", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Report[];
    },
  });

  const runReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-cmo-report");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("CMO report generated successfully");
      qc.invalidateQueries({ queryKey: ["cmo-reports"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("ai_marketing_reports")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    toast.success(`Report marked as ${status}`);
    qc.invalidateQueries({ queryKey: ["cmo-reports"] });
    if (selectedReport?.id === id) {
      setSelectedReport({ ...selectedReport, status });
    }
  };

  const saveToDrafts = async (title: string, body: string) => {
    const { error } = await supabase.from("marketing_drafts").insert({
      title,
      body,
      draft_type: "cmo_insight",
      status: "pending",
      generated_by: "ai",
    });
    if (error) {
      toast.error("Failed to save");
      return;
    }
    toast.success("Saved to Marketing Drafts");
  };

  if (selectedReport) {
    return <ReportDetail report={selectedReport} onBack={() => setSelectedReport(null)} onUpdateStatus={updateStatus} onSaveToDrafts={saveToDrafts} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-display uppercase">CMO Intelligence Reports</h2>
          <p className="text-xs text-muted-foreground mt-1">Weekly AI-powered marketing strategy and business intelligence</p>
        </div>
        <Button size="sm" onClick={runReport} disabled={generating} className="text-xs gap-1.5">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {generating ? "Generating…" : "Run Report Now"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No reports yet. Click "Run Report Now" to generate your first CMO briefing.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => setSelectedReport(r)}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-foreground">
                      Week of {new Date(r.report_week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">{r.summary_text?.slice(0, 100)}…</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.ai_analysis?.growth_score && (
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <Star size={12} className="text-amber-500" />
                      {r.ai_analysis.growth_score}/10
                    </div>
                  )}
                  <Badge variant="outline" className={`text-[9px] uppercase tracking-widest ${STATUS_COLORS[r.status] || ""}`}>
                    {r.status}
                  </Badge>
                  <Eye size={14} className="text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function ReportDetail({
  report,
  onBack,
  onUpdateStatus,
  onSaveToDrafts,
}: {
  report: Report;
  onBack: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onSaveToDrafts: (title: string, body: string) => void;
}) {
  const a = report.ai_analysis || {};
  const raw = report.raw_analytics || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs gap-1"><ArrowLeft size={14} /> Back</Button>
          <Badge variant="outline" className={`text-[9px] uppercase tracking-widest ${STATUS_COLORS[report.status] || ""}`}>{report.status}</Badge>
        </div>
        <div className="flex gap-1.5">
          {report.status === "new" && (
            <Button size="sm" variant="outline" onClick={() => onUpdateStatus(report.id, "reviewed")} className="text-xs gap-1">
              <CheckCircle size={12} /> Mark Reviewed
            </Button>
          )}
          {report.status === "reviewed" && (
            <Button size="sm" variant="default" onClick={() => onUpdateStatus(report.id, "actioned")} className="text-xs gap-1">
              <CheckCircle size={12} /> Mark Actioned
            </Button>
          )}
        </div>
      </div>

      <div className="text-center py-3">
        <h3 className="text-sm font-bold text-foreground">
          CMO Report — Week of {new Date(report.report_week + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </h3>
        {a.growth_score && (
          <div className="flex items-center justify-center gap-1 mt-1 text-xs">
            <Star size={14} className="text-amber-500" />
            <span className="font-bold text-foreground">Growth Score: {a.growth_score}/10</span>
          </div>
        )}
      </div>

      {/* Executive Summary */}
      {a.executive_summary && (
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-foreground leading-relaxed">{a.executive_summary}</p>
            {a.top_priority && (
              <p className="text-[10px] text-primary font-bold mt-2">🎯 Top Priority: {a.top_priority}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business Metrics Snapshot */}
      {raw.business_metrics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5"><TrendingUp size={14} /> Business Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricBox label="Total Users" value={raw.business_metrics.total_users} />
              <MetricBox label="Paying" value={raw.business_metrics.paying_subscribers} />
              <MetricBox label="MRR" value={`$${raw.business_metrics.current_mrr}`} />
              <MetricBox label="New Signups (7d)" value={raw.business_metrics.new_signups_7d} />
              <MetricBox label="Active (7d)" value={raw.business_metrics.active_users_7d} />
              <MetricBox label="Newsletter Subs" value={raw.business_metrics.newsletter_subscribers} />
              <MetricBox label="Logs (30d)" value={raw.engagement?.progress_logs_30d} />
              <MetricBox label="Workouts (30d)" value={raw.engagement?.workout_logs_30d} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel Bottlenecks */}
      {a.funnel_bottlenecks?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5"><Shield size={14} className="text-destructive" /> Funnel Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {a.funnel_bottlenecks.map((b: any, i: number) => (
              <div key={i} className="border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{b.stage}</span>
                  <Badge variant="outline" className={`text-[9px] ${IMPACT_COLORS[b.impact] || ""}`}>{b.impact}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{b.issue}</p>
                <p className="text-[10px] text-primary">💡 {b.fix}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SEO Opportunities */}
      {a.seo_opportunities?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5"><Search size={14} className="text-emerald-500" /> SEO Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {a.seo_opportunities.map((s: any, i: number) => (
              <div key={i} className="border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">"{s.keyword}"</span>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[9px]">{s.content_type}</Badge>
                    <Badge variant="outline" className={`text-[9px] ${IMPACT_COLORS[s.priority] || ""}`}>{s.priority}</Badge>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{s.rationale}</p>
                <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 gap-1"
                  onClick={() => onSaveToDrafts(`SEO: ${s.keyword}`, `Keyword: ${s.keyword}\nType: ${s.content_type}\nRationale: ${s.rationale}`)}>
                  <Save size={10} /> Save to Drafts
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ad Campaign Ideas */}
      {a.ad_campaign_ideas?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5"><Megaphone size={14} className="text-violet-500" /> Ad Campaign Ideas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.ad_campaign_ideas.map((ad: any, i: number) => (
              <div key={i} className="border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[9px]">{ad.platform}</Badge>
                  <span className="text-[9px] text-muted-foreground">Budget: {ad.budget_suggestion}</span>
                </div>
                <p className="text-xs font-bold text-foreground">"{ad.headline}"</p>
                <p className="text-[10px] text-muted-foreground">{ad.body}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">Target: {ad.target_demo}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 gap-1"
                      onClick={() => { navigator.clipboard.writeText(`${ad.headline}\n\n${ad.body}`); toast.success("Copied!"); }}>
                      <Copy size={10} /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 gap-1"
                      onClick={() => onSaveToDrafts(`Ad: ${ad.headline}`, `Platform: ${ad.platform}\nHeadline: ${ad.headline}\nBody: ${ad.body}\nTarget: ${ad.target_demo}\nBudget: ${ad.budget_suggestion}`)}>
                      <Save size={10} /> Save
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Retention Actions */}
      {a.retention_actions?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5"><Target size={14} className="text-amber-500" /> Retention Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {a.retention_actions.map((r: any, i: number) => (
              <div key={i} className="border border-border p-3 flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-foreground">{r.segment}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.action}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${IMPACT_COLORS[r.urgency] || ""}`}>{r.urgency}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-muted/50 border border-border p-2 text-center">
      <p className="text-sm font-bold text-foreground">{value ?? "—"}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{label}</p>
    </div>
  );
}

export default AdminCmoReports;
