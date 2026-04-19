import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Activity, CheckCircle2, XCircle, Clock } from "lucide-react";

interface AgentDef {
  key: string;
  label: string;
  description: string;
  group: "lead_gen" | "intel" | "outreach" | "marketing" | "research";
}

const AGENTS: AgentDef[] = [
  // Lead gen
  { key: "tom",                   label: "Tom — Web Design Hunter",  description: "Find 10 fresh web design prospects + draft outreach.", group: "lead_gen" },
  { key: "vera",                  label: "Vera — Lead Qualifier",    description: "Score today's new leads 1–10.",                     group: "lead_gen" },
  { key: "contractor_prospector", label: "Contractor Prospector",     description: "Scrape HVAC/plumbing/roof/electrical and pitch dead-lead service.", group: "lead_gen" },
  { key: "techalert_prospect_hunter", label: "TechAlert Prospect Hunter", description: "Find HVAC/boiler shops actively hiring on Indeed/ZipRecruiter — perfect TechAlert prospects.", group: "lead_gen" },
  // Intel
  { key: "hire_scanner",          label: "TechAlert Scanner",         description: "Scan Michigan licenses + job boards for available trades.", group: "intel" },
  { key: "industrial_intel",      label: "Industrial Growth Intel",   description: "Detroit manufacturer expansion / hiring signals.",  group: "intel" },
  { key: "medicare_intel",        label: "Medicare Staffing Intel",   description: "1–2 star nursing homes for TechAlert pitch.",       group: "intel" },
  // Outreach
  { key: "dead_lead_drip",        label: "Run Dead-Lead Drip Now",    description: "Send next scheduled SMS for every active campaign.", group: "outreach" },
  { key: "dwa_operator",          label: "DWA Operator",              description: "Auto-tune zero-reply campaigns, generate A/B copy.", group: "outreach" },
  { key: "dwa_closer",            label: "DWA Closer",                description: "Warm-prospect bundle pitch (queues to ghost-delay).", group: "outreach" },
  // Marketing
  { key: "oz",                    label: "Oz — Growth & Ops",         description: "Scan portfolio for ops/growth issues.",             group: "marketing" },
  { key: "scarlett",              label: "Scarlett — Creative",       description: "Generate fresh ad creative drafts.",                group: "marketing" },
  { key: "selma",                 label: "Selma — Head of Marketing", description: "Weekly marketing strategy review.",                 group: "marketing" },
  // Research
  { key: "dol_labor_stats",       label: "DOL Labor Stats",           description: "Pull Detroit-MSA wage + shortage signals from Dept. of Labor (powers TechAlert pitches).", group: "research" },
];

const GROUP_LABELS: Record<AgentDef["group"], string> = {
  lead_gen: "Lead Generation",
  intel: "Market Intelligence",
  outreach: "Outreach",
  marketing: "Marketing",
  research: "Government Data",
};

export default function AgentToolkit() {
  const [running, setRunning] = useState<Set<string>>(new Set());

  const { data: recent, refetch } = useQuery({
    queryKey: ["agent_run_log_recent"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("agent_run_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const run = async (def: AgentDef) => {
    setRunning((s) => new Set(s).add(def.key));
    const t = toast.loading(`Running ${def.label}…`);
    try {
      const { data, error } = await supabase.functions.invoke("run-agent", {
        body: { agent: def.key, payload: {} },
      });
      if (error) throw error;
      const skipped = data?.raw?.status === "skipped" || data?.status === "skipped";
      if (skipped) {
        toast.info(`${def.label}: already ran today`, {
          id: t,
          description: data?.raw?.reason || data?.reason || "Try again tomorrow",
        });
      } else if (data?.ok) {
        toast.success(
          data.result_count != null
            ? `${def.label}: ${data.result_count} results`
            : `${def.label}: complete`,
          { id: t, description: data.result_summary?.slice(0, 100) }
        );
      } else {
        toast.error(`${def.label} failed`, { id: t, description: data?.result_summary || data?.error });
      }
    } catch (e) {
      toast.error(`${def.label} failed`, { id: t, description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning((s) => { const n = new Set(s); n.delete(def.key); return n; });
      refetch();
    }
  };

  const grouped = AGENTS.reduce<Record<string, AgentDef[]>>((acc, a) => {
    (acc[a.group] = acc[a.group] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-foreground mb-1">🤖 Agent Toolkit</h2>
        <p className="text-sm text-muted-foreground">
          One-click access to your autonomous agents. Every run is logged below.
        </p>
      </div>

      {Object.entries(grouped).map(([group, agents]) => (
        <div key={group} className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {GROUP_LABELS[group as AgentDef["group"]]}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => {
              const isRunning = running.has(a.key);
              return (
                <Card key={a.key} className="p-4 flex flex-col gap-3 bg-card/50 border-border/60">
                  <div>
                    <p className="font-bold text-sm text-foreground">{a.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.description}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => run(a)}
                    disabled={isRunning}
                    className="w-full"
                  >
                    {isRunning ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Play size={14} className="mr-1.5" />}
                    {isRunning ? "Running…" : "Run Now"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity size={12} /> Recent Runs
        </h3>
        <Card className="divide-y divide-border/40">
          {!recent?.length && (
            <div className="p-6 text-center text-sm text-muted-foreground">No agent runs yet — click any button above.</div>
          )}
          {recent?.map((r: any) => {
            const StatusIcon = r.status === "succeeded" ? CheckCircle2 : r.status === "failed" ? XCircle : Clock;
            const color = r.status === "succeeded" ? "text-emerald-500" : r.status === "failed" ? "text-red-500" : "text-amber-500";
            return (
              <div key={r.id} className="p-3 flex items-center gap-3 text-sm">
                <StatusIcon size={14} className={color} />
                <span className="font-mono text-xs text-foreground/80 truncate flex-1">{r.agent_name}</span>
                {r.result_count != null && <Badge variant="outline" className="text-xs">{r.result_count} results</Badge>}
                {r.duration_ms != null && <span className="text-xs text-muted-foreground">{(r.duration_ms / 1000).toFixed(1)}s</span>}
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
