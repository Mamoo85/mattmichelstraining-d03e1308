import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, Mail, Phone, AlertTriangle, CheckCircle, Clock,
  DollarSign, BarChart3, Zap, Target, Users, MessageSquare,
  RefreshCw, Loader2, Star, Plus, Trash2, Calendar,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineStageCount {
  stage: string;
  count: number;
  value: number;
}

interface EmailStats {
  total_sent: number;
  sent_this_week: number;
  replied: number;
  reply_rate: number;
}

interface StaleLeadRow {
  id: string;
  business_name: string;
  pipeline_stage: string;
  email: string | null;
  last_drip_at: string | null;
  created_at: string;
  industry: string | null;
  days_stale: number;
}

interface ActivityRow {
  id: string;
  lead_id: string;
  type: string;
  content: string | null;
  metadata: Record<string, any>;
  created_at: string;
  business_name?: string;
}

interface IndustryRow {
  industry: string;
  count: number;
  with_email: number;
  booked: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  new_lead:        { label: "New Lead",  color: "bg-blue-500/20 text-blue-400" },
  website_audited: { label: "Audited",   color: "bg-amber-500/20 text-amber-400" },
  outreach_sent:   { label: "Outreach",  color: "bg-purple-500/20 text-purple-400" },
  call_booked:     { label: "Booked",    color: "bg-green-500/20 text-green-400" },
  archived:        { label: "Archived",  color: "bg-slate-500/20 text-slate-400" },
};

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  email_sent:      { icon: Mail,          color: "text-blue-400",   label: "Email Sent" },
  reply_received:  { icon: MessageSquare, color: "text-green-400",  label: "Replied" },
  call_logged:     { icon: Phone,         color: "text-amber-400",  label: "Call Logged" },
  note:            { icon: MessageSquare, color: "text-slate-400",  label: "Note" },
  meeting_booked:  { icon: Calendar,      color: "text-primary",    label: "Meeting" },
  stage_changed:   { icon: Zap,           color: "text-purple-400", label: "Stage Changed" },
  audited:         { icon: Target,        color: "text-cyan-400",   label: "Audited" },
  researched:      { icon: Star,          color: "text-cyan-400",   label: "Researched" },
  deal_won:        { icon: CheckCircle,   color: "text-green-400",  label: "Deal Won" },
  deal_lost:       { icon: AlertTriangle, color: "text-red-400",    label: "Deal Lost" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted/40 ${color}`}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-black">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Log Activity Modal ─────────────────────────────────────────────────────────

function LogActivityModal({ leadId, leadName, onLogged }: {
  leadId: string;
  leadName: string;
  onLogged: () => void;
}) {
  const [type, setType] = useState("call_logged");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("lead_activities").insert({
        lead_id: leadId,
        lead_table: "prospect_pipeline",
        type,
        content: content.trim() || null,
        metadata: { business_name: leadName },
      });
      if (error) throw error;
      // Update last_activity_at on the lead
      await (supabase as any).from("prospect_pipeline")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", leadId);
      toast.success("Activity logged");
      setContent("");
      onLogged();
    } catch (e) {
      toast.error("Failed to log activity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border border-border/40 rounded-lg bg-muted/10">
      <p className="text-xs font-semibold text-muted-foreground">Log activity for {leadName}</p>
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="call_logged">📞 Call Logged</SelectItem>
          <SelectItem value="meeting_booked">📅 Meeting Booked</SelectItem>
          <SelectItem value="reply_received">💬 Reply Received</SelectItem>
          <SelectItem value="note">📝 Note</SelectItem>
          <SelectItem value="deal_won">✅ Deal Won</SelectItem>
          <SelectItem value="deal_lost">❌ Deal Lost</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Notes... (optional)"
        value={content}
        onChange={e => setContent(e.target.value)}
        className="text-xs min-h-[60px]"
      />
      <Button size="sm" className="w-full h-7 text-xs" onClick={save} disabled={saving}>
        {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
        Log Activity
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminCRMDashboard() {
  const [loading, setLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<PipelineStageCount[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats>({ total_sent: 0, sent_this_week: 0, replied: 0, reply_rate: 0 });
  const [staleLeads, setStaleLeads] = useState<StaleLeadRow[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);
  const [industryData, setIndustryData] = useState<IndustryRow[]>([]);
  const [logModalLeadId, setLogModalLeadId] = useState<string | null>(null);
  const [logModalLeadName, setLogModalLeadName] = useState("");
  const [totalPipelineValue, setTotalPipelineValue] = useState(0);
  const [wonDeals, setWonDeals] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Pipeline stage counts + values
      const { data: pipelineData } = await (supabase as any)
        .from("prospect_pipeline")
        .select("pipeline_stage, deal_value, lead_score")
        .neq("pipeline_stage", "archived");

      if (pipelineData) {
        const counts: Record<string, { count: number; value: number }> = {};
        let totalVal = 0;
        for (const row of pipelineData) {
          const s = row.pipeline_stage || "new_lead";
          if (!counts[s]) counts[s] = { count: 0, value: 0 };
          counts[s].count++;
          counts[s].value += row.deal_value || 0;
          totalVal += row.deal_value || 0;
        }
        setTotalPipelineValue(totalVal);
        setStageCounts(Object.entries(counts).map(([stage, v]) => ({ stage, ...v })));
      }

      // 2. Email stats
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: emailData } = await (supabase as any)
        .from("prospect_email_log")
        .select("sent_at, replied_at")
        .order("sent_at", { ascending: false })
        .limit(2000);

      if (emailData) {
        const total = emailData.length;
        const thisWeek = emailData.filter((e: any) => e.sent_at >= weekAgo).length;
        const replied = emailData.filter((e: any) => !!e.replied_at).length;
        setEmailStats({
          total_sent: total,
          sent_this_week: thisWeek,
          replied,
          reply_rate: total > 0 ? Math.round((replied / total) * 100) : 0,
        });
      }

      // 3. Stale leads (in outreach_sent with no activity in 7+ days)
      const { data: staleData } = await (supabase as any)
        .from("prospect_pipeline")
        .select("id, business_name, pipeline_stage, email, last_drip_at, created_at, industry, last_activity_at")
        .eq("pipeline_stage", "outreach_sent")
        .order("last_drip_at", { ascending: true })
        .limit(20);

      if (staleData) {
        const stale: StaleLeadRow[] = staleData
          .map((l: any) => ({
            ...l,
            days_stale: daysSince(l.last_activity_at || l.last_drip_at),
          }))
          .filter((l: StaleLeadRow) => l.days_stale >= 7)
          .sort((a: StaleLeadRow, b: StaleLeadRow) => b.days_stale - a.days_stale);
        setStaleLeads(stale);
      }

      // 4. Hot leads (score >= 8, not yet contacted)
      const { data: hotData } = await (supabase as any)
        .from("prospect_pipeline")
        .select("id, business_name, lead_score, industry, city, email, pipeline_stage")
        .gte("lead_score", 8)
        .in("pipeline_stage", ["new_lead", "website_audited"])
        .order("lead_score", { ascending: false })
        .limit(10);
      setHotLeads(hotData || []);

      // 5. Recent activities
      const { data: activityData } = await (supabase as any)
        .from("lead_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (activityData) {
        // Enrich with business names
        const leadIds = [...new Set(activityData.map((a: any) => a.lead_id))];
        const { data: leadNames } = await (supabase as any)
          .from("prospect_pipeline")
          .select("id, business_name")
          .in("id", leadIds);
        const nameMap = Object.fromEntries((leadNames || []).map((l: any) => [l.id, l.business_name]));
        setRecentActivity(activityData.map((a: any) => ({
          ...a,
          business_name: nameMap[a.lead_id] || (a.metadata?.business_name) || "Unknown",
        })));
      }

      // 6. Industry breakdown
      const { data: industryRaw } = await (supabase as any)
        .from("prospect_pipeline")
        .select("industry, email, pipeline_stage")
        .neq("pipeline_stage", "archived");

      if (industryRaw) {
        const byIndustry: Record<string, { count: number; with_email: number; booked: number }> = {};
        for (const row of industryRaw) {
          const ind = row.industry || "Unknown";
          if (!byIndustry[ind]) byIndustry[ind] = { count: 0, with_email: 0, booked: 0 };
          byIndustry[ind].count++;
          if (row.email) byIndustry[ind].with_email++;
          if (row.pipeline_stage === "call_booked") byIndustry[ind].booked++;
        }
        setIndustryData(
          Object.entries(byIndustry)
            .map(([industry, v]) => ({ industry, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        );
      }

      // 7. Won deals count
      const { count: wonCount } = await (supabase as any)
        .from("lead_activities")
        .select("id", { count: "exact", head: true })
        .eq("type", "deal_won");
      setWonDeals(wonCount || 0);

    } catch (e) {
      console.error(e);
      toast.error("Failed to load CRM data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalLeads = stageCounts.reduce((s, c) => s + c.count, 0);
  const bookedCount = stageCounts.find(s => s.stage === "call_booked")?.count || 0;
  const conversionRate = totalLeads > 0 ? Math.round((bookedCount / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">CRM Intelligence</h2>
          <p className="text-xs text-muted-foreground">AI-first pipeline analytics — eWay-CRM can't do this</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Total Leads"       value={totalLeads}         sub="active pipeline" />
        <StatCard icon={DollarSign}  label="Pipeline Value"    value={`$${(totalPipelineValue).toLocaleString()}`} sub="estimated" color="text-green-400" />
        <StatCard icon={CheckCircle} label="Booked"            value={`${bookedCount} (${conversionRate}%)`} sub="conversion rate" color="text-green-400" />
        <StatCard icon={TrendingUp}  label="Reply Rate"        value={`${emailStats.reply_rate}%`} sub={`${emailStats.replied} / ${emailStats.total_sent} emails`} color="text-primary" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard icon={Mail}        label="Sent This Week"    value={emailStats.sent_this_week} sub="cold outreach emails" />
        <StatCard icon={AlertTriangle} label="Stale Leads"     value={staleLeads.length}     sub="7+ days no activity" color="text-amber-400" />
        <StatCard icon={CheckCircle} label="Deals Won"         value={wonDeals}               sub="all time" color="text-green-400" />
      </div>

      {/* Pipeline Funnel */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" /> Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
          ) : stageCounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No pipeline data yet</p>
          ) : (
            ["new_lead", "website_audited", "outreach_sent", "call_booked"].map(stage => {
              const sc = stageCounts.find(s => s.stage === stage);
              const count = sc?.count || 0;
              const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
              const meta = STAGE_LABELS[stage];
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${meta?.color.split(" ")[1] || ""}`}>{meta?.label || stage}</span>
                    <span className="text-muted-foreground">{count} leads · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stage === "call_booked" ? "bg-green-500" :
                        stage === "outreach_sent" ? "bg-purple-500" :
                        stage === "website_audited" ? "bg-amber-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Hot Leads */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap size={14} className="text-primary" /> Hot Leads
              <Badge className="text-[9px] bg-primary/10 text-primary border-0 ml-auto">Score ≥ 8, not contacted</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>
            ) : hotLeads.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No hot leads — prospect more</p>
            ) : (
              <div className="space-y-2">
                {hotLeads.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{lead.business_name}</p>
                      <p className="text-[10px] text-muted-foreground">{lead.industry} · {lead.city}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.email && <Mail size={10} className="text-green-400" />}
                      <span className="text-[10px] font-bold text-green-400">{lead.lead_score}/10</span>
                      <Button
                        variant="ghost" size="sm"
                        className="h-5 text-[9px] px-1.5 text-primary hover:bg-primary/10"
                        onClick={() => { setLogModalLeadId(lead.id); setLogModalLeadName(lead.business_name); }}
                      >
                        + Log
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stale Leads */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={14} className="text-amber-400" /> Needs Attention
              <Badge className="text-[9px] bg-amber-500/10 text-amber-400 border-0 ml-auto">Outreach sent, gone quiet</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>
            ) : staleLeads.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">All outreach is fresh</p>
            ) : (
              <div className="space-y-2">
                {staleLeads.slice(0, 8).map(lead => (
                  <div key={lead.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{lead.business_name}</p>
                      <p className="text-[10px] text-muted-foreground">{lead.industry}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="text-[8px] bg-amber-500/10 text-amber-400 border-0">
                        {lead.days_stale}d stale
                      </Badge>
                      <Button
                        variant="ghost" size="sm"
                        className="h-5 text-[9px] px-1.5 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => { setLogModalLeadId(lead.id); setLogModalLeadName(lead.business_name); }}
                      >
                        + Log
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Activity Panel */}
      {logModalLeadId && (
        <LogActivityModal
          leadId={logModalLeadId}
          leadName={logModalLeadName}
          onLogged={() => { setLogModalLeadId(null); load(); }}
        />
      )}

      {/* Recent Activity Feed */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" /> Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
          ) : recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No activities logged yet — start logging calls and notes</p>
          ) : (
            <div className="space-y-0">
              {recentActivity.map((a, i) => {
                const meta = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS["note"];
                const Icon = meta.icon;
                return (
                  <div key={a.id} className={`flex items-start gap-3 py-2.5 ${i < recentActivity.length - 1 ? "border-b border-border/30" : ""}`}>
                    <div className={`mt-0.5 shrink-0 ${meta.color}`}><Icon size={12} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{a.business_name}</span>
                        <Badge className={`text-[8px] border-0 shrink-0 ${
                          a.type === "deal_won" ? "bg-green-500/20 text-green-400" :
                          a.type === "reply_received" ? "bg-green-500/10 text-green-400" :
                          a.type === "call_logged" ? "bg-amber-500/10 text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>{meta.label}</Badge>
                      </div>
                      {a.content && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{a.content}</p>}
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Industry Breakdown */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target size={14} className="text-primary" /> Industry Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-4 gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground pb-1.5 border-b border-border/30">
                <span>Industry</span><span className="text-right">Leads</span><span className="text-right">W/ Email</span><span className="text-right">Booked</span>
              </div>
              {industryData.map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                  <span className="truncate text-foreground/80">{row.industry}</span>
                  <span className="text-right font-medium">{row.count}</span>
                  <span className={`text-right ${row.with_email > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                    {row.with_email}
                  </span>
                  <span className={`text-right font-bold ${row.booked > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {row.booked}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* eWay-CRM Comparison */}
      <Card className="border-border/40 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-primary mb-3">Why This Beats eWay-CRM</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "AI Lead Scoring", desc: "Scores every lead 1-10 before you touch it. eWay-CRM doesn't score." },
              { label: "Auto Enrichment", desc: "Hunter → Apollo → Lusha waterfall finds emails automatically. eWay just stores what you type." },
              { label: "Cold Email Automation", desc: "AI writes & sends personalized outreach. eWay just logs emails you send manually." },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
