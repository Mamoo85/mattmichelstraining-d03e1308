// Growth Signal Outreach — replaces the old AdminLinkedInBlitz.
// Pick the play (Supply Radar / Talent Radar / FieldDesk), and every signal
// card rebuilds itself with the right audience, the right LinkedIn search,
// and a hand-written DM that actually fits the product being sold.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Linkedin, Copy, RefreshCw, Loader2, ExternalLink, CheckCircle2, Target, ChevronDown, ChevronUp } from "lucide-react";
import {
  OUTREACH_TEMPLATES,
  PLAY_META,
  templatesForPlay,
  audienceForPlay,
  type Play,
  type Template,
  type TemplateCtx,
} from "@/lib/outreachTemplates";
import { distributorsFor, predictedCommodities, predictedSpend, type Distributor } from "@/lib/metroDistributors";

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
}

const PLAYS: Play[] = ["supply_radar", "talent_radar", "fielddesk"];

export default function AdminGrowthSignalOutreach() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [play, setPlay] = useState<Play>("supply_radar");
  const [toneIdx, setToneIdx] = useState(0); // 0/1/2 — direct/curious/value
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verticalFilter, setVerticalFilter] = useState<string>("All");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set()); // signalId+play
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { fetchSignals(); fetchSentLog(); }, []);
  useEffect(() => { fetchSentLog(); }, [play]);

  async function fetchSignals() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("industry_pulse_signals")
      .select("id,company_name,location,industry,hiring_roles,hiring_count,predicted_needs,confidence")
      .gte("confidence", 6)
      .order("confidence",  { ascending: false })
      .order("detected_at", { ascending: false })
      .order("id",          { ascending: true })
      .limit(40);
    setSignals(data || []);
    setLoading(false);
  }

  async function fetchSentLog() {
    const { data } = await (supabase as any)
      .from("outreach_signal_log")
      .select("signal_id, play")
      .eq("play", play)
      .gte("sent_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const set = new Set<string>();
    (data || []).forEach((r: any) => set.add(`${r.signal_id}:${r.play}`));
    setSentIds(set);
  }

  const verticals = useMemo(() => {
    const set = new Set<string>(["All"]);
    signals.forEach((s) => s.industry && set.add(s.industry));
    return Array.from(set);
  }, [signals]);

  const filtered = useMemo(() => {
    const base = verticalFilter === "All" ? signals : signals.filter((s) => s.industry === verticalFilter);
    // sort already-sent to the bottom
    return [...base].sort((a, b) => {
      const aSent = sentIds.has(`${a.id}:${play}`) ? 1 : 0;
      const bSent = sentIds.has(`${b.id}:${play}`) ? 1 : 0;
      return aSent - bSent;
    });
  }, [signals, verticalFilter, sentIds, play]);

  const playTemplates = useMemo(() => templatesForPlay(play), [play]);
  const activeTemplate: Template = playTemplates[Math.min(toneIdx, playTemplates.length - 1)];

  function buildCtx(s: Signal): TemplateCtx {
    const topRole = s.hiring_roles?.[0] || "tech";
    const trade = s.industry || "Trade";
    return {
      recipientFirstName: "[Name]",
      signalCompany: s.company_name,
      signalCity: s.location || "Metro Detroit",
      trade,
      permits: Math.max(1, s.hiring_count), // permits not separately stored — use hire count as proxy if needed
      hires: s.hiring_count,
      topRole,
      predictedCommodities: s.predicted_needs?.length ? s.predicted_needs : predictedCommodities(trade),
      predictedSpend: predictedSpend(s.hiring_count, s.hiring_count),
    };
  }

  async function copyDM(s: Signal) {
    const dm = activeTemplate.build(buildCtx(s));
    await navigator.clipboard.writeText(dm);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("DM copied — paste into LinkedIn");
  }

  async function markSent(s: Signal, target?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("outreach_signal_log").insert({
      signal_id: s.id,
      play,
      audience: audienceForPlay(play),
      target_company: target || s.company_name,
      admin_id: user?.id,
    });
    if (error) {
      toast.error("Couldn't mark sent");
      return;
    }
    const next = new Set(sentIds);
    next.add(`${s.id}:${play}`);
    setSentIds(next);
    toast.success("Marked as sent");
  }

  function toggleExpanded(id: string) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  function linkedinSearch(s: Signal): { label: string; url: string }[] {
    if (play === "supply_radar") {
      // we surface distributors directly in the card — this fallback search is broader
      return [{
        label: "Search Detroit supply houses",
        url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent("Detroit HVAC supply sales manager")}`,
      }];
    }
    if (play === "talent_radar") {
      return [{
        label: `Find ${s.company_name} owner`,
        url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${s.company_name}" (owner OR president OR "general manager")`)}`,
      }];
    }
    return [{
      label: `Find ${s.company_name} owner`,
      url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${s.company_name}" (owner OR president OR "general manager")`)}`,
    }];
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-[#00d4ff]" /> Growth Signal Outreach
          </h2>
          <p className="text-white/40 text-xs mt-1">
            Pick what you're selling — the message and target rewire to match.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { fetchSignals(); fetchSentLog(); }}
          disabled={loading}
          className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 shrink-0"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {/* PLAY SELECTOR */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Step 1 — what are you selling today?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PLAYS.map((p) => {
            const meta = PLAY_META[p];
            const active = play === p;
            return (
              <button
                key={p}
                onClick={() => { setPlay(p); setToneIdx(0); }}
                className={`text-left rounded-lg border p-3 transition ${active ? "bg-[#00d4ff]/15 border-[#00d4ff]/60 ring-1 ring-[#00d4ff]/40" : "bg-[#0f1f35] border-white/10 hover:border-white/30"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold text-sm ${active ? "text-[#00d4ff]" : "text-white"}`}>
                    {meta.emoji} {meta.label}
                  </span>
                  <span className={`text-[10px] ${active ? "text-[#00d4ff]" : "text-white/50"}`}>{meta.price}</span>
                </div>
                <p className="text-white/50 text-[11px] mt-1 leading-snug">{meta.targetLine}</p>
              </button>
            );
          })}
        </div>
        <p className="text-white/40 text-[11px] mt-2 italic">{PLAY_META[play].description}</p>
      </div>

      {/* TONE + VERTICAL */}
      <Card className="bg-[#0f1f35] border-white/10">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-xs">Tone:</span>
            {playTemplates.map((t, i) => (
              <Button
                key={t.id}
                size="sm"
                onClick={() => setToneIdx(i)}
                className={toneIdx === i ? "bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/40 text-xs">Vertical:</span>
            {verticals.map((v) => (
              <Button
                key={v}
                size="sm"
                onClick={() => setVerticalFilter(v)}
                className={verticalFilter === v ? "bg-white/10 text-white text-xs" : "bg-white/5 text-white/40 border border-white/10 text-xs"}
              >
                {v}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0f1f35] border-white/10">
          <CardContent className="py-10 text-center text-white/40 text-sm">No high-confidence signals match.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              ctx={buildCtx(s)}
              play={play}
              template={activeTemplate}
              sent={sentIds.has(`${s.id}:${play}`)}
              expanded={expanded.has(s.id)}
              copied={copiedId === s.id}
              linkedinSearches={linkedinSearch(s)}
              onCopy={() => copyDM(s)}
              onMarkSent={(target) => markSent(s, target)}
              onToggleExpanded={() => toggleExpanded(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SignalCardProps {
  signal: Signal;
  ctx: TemplateCtx;
  play: Play;
  template: Template;
  sent: boolean;
  expanded: boolean;
  copied: boolean;
  linkedinSearches: { label: string; url: string }[];
  onCopy: () => void;
  onMarkSent: (target?: string) => void;
  onToggleExpanded: () => void;
}

function SignalCard({ signal: s, ctx, play, template, sent, expanded, copied, linkedinSearches, onCopy, onMarkSent, onToggleExpanded }: SignalCardProps) {
  const distributors: Distributor[] = play === "supply_radar" ? distributorsFor(s.location, s.industry) : [];

  return (
    <Card className={`bg-[#0f1f35] border-white/10 transition ${sent ? "opacity-50" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header — reshapes per play */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold text-sm">🎯 {s.company_name}</p>
              {sent && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">SENT</Badge>}
            </div>
            <p className="text-white/40 text-xs mt-0.5">
              {s.location || "MI"} · {s.industry || "Trade"} · {s.hiring_count}× {(s.hiring_roles || []).slice(0, 2).join(", ") || "openings"}
            </p>
            {play === "supply_radar" && (
              <p className="text-[#00d4ff] text-xs mt-2 leading-snug">
                💰 Predicted spend: <span className="text-white">{ctx.predictedSpend}</span>
                <br />
                <span className="text-white/60">{ctx.predictedCommodities.slice(0, 3).join(" · ")}</span>
              </p>
            )}
            {play === "talent_radar" && (
              <p className="text-amber-400 text-xs mt-2 leading-snug">
                ⏱ Hiring pain: licensed {ctx.topRole}s take 60+ days to fill in MI
              </p>
            )}
            {play === "fielddesk" && (
              <p className="text-[#00d4ff] text-xs mt-2 leading-snug">
                📈 Growth: {s.hiring_count} new roles + active permit pipeline = ops bottleneck incoming
              </p>
            )}
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">{s.confidence}/10</Badge>
        </div>

        {/* WHO TO DM section */}
        {play === "supply_radar" && distributors.length > 0 && (
          <div className="border-t border-white/5 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Who to DM (sales mgr / branch mgr):</p>
            <div className="space-y-1">
              {distributors.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/70 truncate">• {d.name} <span className="text-white/30">({d.city})</span></span>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={d.linkedinSearchUrl} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:underline flex items-center gap-1 text-[11px]">
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                    <button onClick={() => onMarkSent(d.name)} className="text-white/30 hover:text-emerald-400 text-[11px]">mark sent</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DM PREVIEW */}
        <div>
          <button onClick={onToggleExpanded} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 mb-1.5">
            DM ({template.label}) {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="bg-black/30 border border-white/5 rounded p-3 text-white/80 text-xs leading-relaxed whitespace-pre-wrap font-sans">
              {template.build(ctx)}
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={onCopy} className="bg-[#0a66c2]/20 text-[#0a66c2] border border-[#0a66c2]/40 hover:bg-[#0a66c2]/30">
            {copied ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied!" : "Copy DM"}
          </Button>
          {linkedinSearches.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#0a66c2] hover:underline flex items-center gap-1"
            >
              <Linkedin className="h-3 w-3" /> {l.label} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
          {!sent && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkSent()}
              className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark sent
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
