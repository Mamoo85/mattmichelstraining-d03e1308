import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, Mail, Phone, AlertTriangle, CheckCircle, Clock,
  DollarSign, BarChart3, Zap, Target, Users, MessageSquare,
  RefreshCw, Loader2, Star, Plus, Calendar, Eye,
  ArrowUpRight, Flame, Trophy,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineStageCount { stage: string; count: number; value: number }
interface EmailStats { total_sent: number; sent_this_week: number; replied: number; reply_rate: number }
interface StaleLeadRow { id: string; business_name: string; pipeline_stage: string; email: string | null; last_drip_at: string | null; created_at: string; industry: string | null; days_stale: number }
interface ActivityRow { id: string; lead_id: string; type: string; content: string | null; metadata: Record<string, any>; created_at: string; business_name?: string }
interface IndustryRow { industry: string; count: number; with_email: number; booked: number }

// ── Stage config ───────────────────────────────────────────────────────────────

const STAGES = [
  { key: "new_lead",        label: "New Leads",  color: "#3b82f6", icon: "🎯" },
  { key: "website_audited", label: "Audited",    color: "#f59e0b", icon: "🔍" },
  { key: "outreach_sent",   label: "Outreach",   color: "#a855f7", icon: "✉️" },
  { key: "call_booked",     label: "Booked",     color: "#10b981", icon: "📞" },
];

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  email_sent:     { icon: Mail,          color: "#3b82f6", label: "Email Sent" },
  reply_received: { icon: MessageSquare, color: "#10b981", label: "Replied" },
  call_logged:    { icon: Phone,         color: "#f59e0b", label: "Call" },
  note:           { icon: MessageSquare, color: "#6b7280", label: "Note" },
  meeting_booked: { icon: Calendar,      color: "#e8621a", label: "Meeting" },
  stage_changed:  { icon: Zap,           color: "#a855f7", label: "Stage" },
  audited:        { icon: Target,        color: "#06b6d4", label: "Audited" },
  researched:     { icon: Eye,           color: "#06b6d4", label: "Visitor ID" },
  deal_won:       { icon: Trophy,        color: "#10b981", label: "Won 🎉" },
  deal_lost:      { icon: AlertTriangle, color: "#ef4444", label: "Lost" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Big Stat Card ──────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border p-5 relative overflow-hidden"
    style={{ background: `${color}0d`, borderColor: `${color}30` }}>
    {/* Glow */}
    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: color }} />
    <div className="flex items-start justify-between mb-3 relative">
      <div className="p-2 rounded-xl" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
          <ArrowUpRight size={12} />{trend}
        </div>
      )}
    </div>
    <div className="relative">
      <div className="text-3xl font-black text-white tracking-tight">{value}</div>
      <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
      {sub && <div className="text-xs text-white/35 mt-0.5">{sub}</div>}
    </div>
  </motion.div>
);

// ── Pipeline Bar ───────────────────────────────────────────────────────────────

const PipelineBar = ({ stage, count, total, value }: { stage: typeof STAGES[0]; count: number; total: number; value: number }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-white/80">
          <span>{stage.icon}</span>
          {stage.label}
        </span>
        <div className="flex items-center gap-3">
          {value > 0 && <span className="text-white/30 text-[10px]">${value.toLocaleString()}</span>}
          <span className="font-bold" style={{ color: stage.color }}>{count} · {pct}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${stage.color}99, ${stage.color})`, boxShadow: `0 0 8px ${stage.color}60` }}
        />
      </div>
    </div>
  );
};

// ── Log Activity Modal ─────────────────────────────────────────────────────────

function LogActivityModal({ leadId, leadName, onLogged, onClose }: {
  leadId: string; leadName: string; onLogged: () => void; onClose: () => void;
}) {
  const [type, setType] = useState("call_logged");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await (supabase as any).from("lead_activities").insert({
        lead_id: leadId, lead_table: "prospect_pipeline", type,
        content: content.trim() || null, metadata: { business_name: leadName },
      });
      await (supabase as any).from("prospect_pipeline")
        .update({ last_activity_at: new Date().toISOString() }).eq("id", leadId);
      toast.success("Activity logged");
      onLogged();
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-bold mb-3">Log: <span className="text-orange-400">{leadName}</span></p>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white mb-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-white/10">
            <SelectItem value="call_logged" className="text-white">📞 Call Logged</SelectItem>
            <SelectItem value="meeting_booked" className="text-white">📅 Meeting Booked</SelectItem>
            <SelectItem value="reply_received" className="text-white">💬 Reply Received</SelectItem>
            <SelectItem value="note" className="text-white">📝 Note</SelectItem>
            <SelectItem value="deal_won" className="text-white">✅ Deal Won</SelectItem>
            <SelectItem value="deal_lost" className="text-white">❌ Deal Lost</SelectItem>
          </SelectContent>
        </Select>
        <Textarea placeholder="Notes... (optional)" value={content} onChange={e => setContent(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm min-h-[70px] mb-3" />
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600 flex-1">
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
            Log Activity
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/15 text-white/60">Cancel</Button>
        </div>
      </div>
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
  const [logModal, setLogModal] = useState<{ id: string; name: string } | null>(null);
  const [totalPipelineValue, setTotalPipelineValue] = useState(0);
  const [wonDeals, setWonDeals] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [
        { data: pipelineData },
        { data: emailData },
        { data: staleData },
        { data: hotData },
        { data: activityData },
        { data: industryRaw },
        { count: wonCount },
      ] = await Promise.all([
        (supabase as any).from("prospect_pipeline").select("pipeline_stage, deal_value, lead_score").neq("pipeline_stage", "archived"),
        (supabase as any).from("prospect_email_log").select("sent_at, replied_at").order("sent_at", { ascending: false }).limit(2000),
        (supabase as any).from("prospect_pipeline").select("id, business_name, pipeline_stage, email, last_drip_at, created_at, industry, last_activity_at").eq("pipeline_stage", "outreach_sent").order("last_drip_at", { ascending: true }).limit(20),
        (supabase as any).from("prospect_pipeline").select("id, business_name, lead_score, industry, city, email, pipeline_stage").gte("lead_score", 8).in("pipeline_stage", ["new_lead", "website_audited"]).order("lead_score", { ascending: false }).limit(10),
        (supabase as any).from("lead_activities").select("*").order("created_at", { ascending: false }).limit(30),
        (supabase as any).from("prospect_pipeline").select("industry, email, pipeline_stage").neq("pipeline_stage", "archived"),
        (supabase as any).from("lead_activities").select("id", { count: "exact", head: true }).eq("type", "deal_won"),
      ]);

      // Pipeline
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

      // Email
      if (emailData) {
        const total = emailData.length;
        const thisWeek = emailData.filter((e: any) => e.sent_at >= weekAgo).length;
        const replied = emailData.filter((e: any) => !!e.replied_at).length;
        setEmailStats({ total_sent: total, sent_this_week: thisWeek, replied, reply_rate: total > 0 ? Math.round((replied / total) * 100) : 0 });
      }

      // Stale
      if (staleData) {
        setStaleLeads(
          staleData.map((l: any) => ({ ...l, days_stale: daysSince(l.last_activity_at || l.last_drip_at) }))
            .filter((l: StaleLeadRow) => l.days_stale >= 7)
            .sort((a: StaleLeadRow, b: StaleLeadRow) => b.days_stale - a.days_stale)
        );
      }

      setHotLeads(hotData || []);

      // Activities with names
      if (activityData) {
        const leadIds = [...new Set(activityData.map((a: any) => a.lead_id))];
        const { data: leadNames } = await (supabase as any).from("prospect_pipeline").select("id, business_name").in("id", leadIds);
        const nameMap = Object.fromEntries((leadNames || []).map((l: any) => [l.id, l.business_name]));
        setRecentActivity(activityData.map((a: any) => ({ ...a, business_name: nameMap[a.lead_id] || a.metadata?.business_name || "Unknown" })));
      }

      // Industry
      if (industryRaw) {
        const byInd: Record<string, { count: number; with_email: number; booked: number }> = {};
        for (const row of industryRaw) {
          const ind = row.industry || "Unknown";
          if (!byInd[ind]) byInd[ind] = { count: 0, with_email: 0, booked: 0 };
          byInd[ind].count++;
          if (row.email) byInd[ind].with_email++;
          if (row.pipeline_stage === "call_booked") byInd[ind].booked++;
        }
        setIndustryData(Object.entries(byInd).map(([industry, v]) => ({ industry, ...v })).sort((a, b) => b.count - a.count).slice(0, 10));
      }

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
  const maxIndustryCount = Math.max(...industryData.map(r => r.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 p-1">
      {logModal && (
        <LogActivityModal leadId={logModal.id} leadName={logModal.name}
          onLogged={() => { setLogModal(null); load(); }} onClose={() => setLogModal(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <BarChart3 size={20} className="text-orange-400" />
            CRM Intelligence
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Pipeline command center — live data, zero lag</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}
          className="border-white/15 text-white/60 hover:text-white hover:border-white/30">
          <RefreshCw size={13} className="mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Active Leads"     value={totalLeads}                                          color="#3b82f6" sub="in pipeline" />
        <StatCard icon={DollarSign}  label="Pipeline Value"   value={`$${totalPipelineValue.toLocaleString()}`}           color="#10b981" sub="estimated revenue" />
        <StatCard icon={CheckCircle} label="Booked"           value={`${bookedCount}`}                                    color="#10b981" sub={`${conversionRate}% conversion`} trend={`${conversionRate}%`} />
        <StatCard icon={TrendingUp}  label="Reply Rate"       value={`${emailStats.reply_rate}%`}                         color="#e8621a" sub={`${emailStats.replied}/${emailStats.total_sent} emails`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Mail}          label="Sent This Week" value={emailStats.sent_this_week} color="#a855f7" sub="cold outreach" />
        <StatCard icon={AlertTriangle} label="Stale Leads"    value={staleLeads.length}          color="#f59e0b" sub="7+ days quiet" />
        <StatCard icon={Trophy}        label="Deals Won"      value={wonDeals}                   color="#10b981" sub="all time" />
      </div>

      {/* Pipeline Funnel */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={15} className="text-orange-400" />
          <span className="text-white font-bold">Pipeline Funnel</span>
          <span className="text-white/30 text-xs ml-auto">{totalLeads} total leads</span>
        </div>
        <div className="space-y-4">
          {STAGES.map((stage) => {
            const sc = stageCounts.find(s => s.stage === stage.key);
            return <PipelineBar key={stage.key} stage={stage} count={sc?.count || 0} total={totalLeads} value={sc?.value || 0} />;
          })}
        </div>
      </div>

      {/* Hot Leads + Stale Leads */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Hot Leads */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={15} className="text-orange-400" />
            <span className="text-white font-bold">Hot Leads</span>
            <Badge className="ml-auto text-[9px] bg-orange-500/15 text-orange-400 border-orange-500/25">Score ≥ 8</Badge>
          </div>
          {hotLeads.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No hot leads — keep prospecting</p>
          ) : (
            <div className="space-y-2">
              {hotLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-semibold truncate">{lead.business_name}</p>
                    <p className="text-white/40 text-[10px]">{lead.industry} · {lead.city}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {lead.email && <Mail size={10} className="text-emerald-400" />}
                    <span className="text-emerald-400 text-xs font-black">{lead.lead_score}/10</span>
                    <button
                      onClick={() => setLogModal({ id: lead.id, name: lead.business_name })}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors font-semibold">
                      + Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stale Leads */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/4 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-amber-400" />
            <span className="text-white font-bold">Needs Attention</span>
            <Badge className="ml-auto text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/25">Gone quiet</Badge>
          </div>
          {staleLeads.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">All outreach is fresh ✓</p>
          ) : (
            <div className="space-y-2">
              {staleLeads.slice(0, 8).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-semibold truncate">{lead.business_name}</p>
                    <p className="text-white/40 text-[10px]">{lead.industry}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                      {lead.days_stale}d
                    </span>
                    <button
                      onClick={() => setLogModal({ id: lead.id, name: lead.business_name })}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors font-semibold">
                      + Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed + Industry */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={15} className="text-blue-400" />
            <span className="text-white font-bold">Activity Feed</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No activities logged yet</p>
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-0 max-h-80 overflow-y-auto">
                {recentActivity.map((a, i) => {
                  const meta = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS["note"];
                  const Icon = meta.icon;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`flex items-start gap-3 py-2.5 ${i < recentActivity.length - 1 ? "border-b border-white/5" : ""}`}>
                      <div className="mt-0.5 shrink-0 p-1.5 rounded-lg" style={{ background: `${meta.color}18` }}>
                        <Icon size={11} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white text-xs font-semibold truncate">{a.business_name}</span>
                          <span className="text-[10px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        {a.content && <p className="text-white/40 text-[10px] mt-0.5 leading-snug line-clamp-2">{a.content}</p>}
                      </div>
                      <span className="text-white/25 text-[10px] shrink-0">{timeAgo(a.created_at)}</span>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Industry Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={15} className="text-purple-400" />
            <span className="text-white font-bold">Industry Breakdown</span>
          </div>
          {industryData.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {industryData.map((row) => {
                const barPct = Math.round((row.count / maxIndustryCount) * 100);
                const bookRate = row.count > 0 ? Math.round((row.booked / row.count) * 100) : 0;
                return (
                  <div key={row.industry}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/80 font-medium truncate">{row.industry}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-white/40">{row.count} leads</span>
                        {row.booked > 0 && (
                          <span className="text-emerald-400 font-bold">{bookRate}% booked</span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500/60 to-purple-400 transition-all"
                        style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* vs eWay-CRM */}
      <div className="rounded-2xl border border-orange-500/20 p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #e8621a08 0%, #a855f708 100%)" }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(#e8621a, transparent)" }} />
        <p className="text-white font-black mb-4 text-sm flex items-center gap-2">
          <Star size={14} className="text-orange-400" />
          Why This Destroys eWay-CRM
        </p>
        <div className="grid sm:grid-cols-3 gap-4 relative">
          {[
            { emoji: "🎯", label: "AI Lead Scoring", desc: "Every lead scored 1–10 automatically. eWay-CRM doesn't score — you manually evaluate every single one." },
            { emoji: "📧", label: "Waterfall Email Finding", desc: "Hunter → Apollo → Lusha finds emails automatically. eWay stores what you manually type. Big difference." },
            { emoji: "👁", label: "Visitor Intelligence", desc: "See who visits your site before they call. eWay-CRM is blind to anonymous traffic. We identify companies by IP." },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/8 bg-white/3 p-4">
              <div className="text-2xl mb-2">{item.emoji}</div>
              <p className="text-white font-bold text-xs mb-1">{item.label}</p>
              <p className="text-white/45 text-[11px] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
