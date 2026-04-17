import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Trophy, MessageSquare, Calendar, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  contractorId?: string;
  contractorEmail?: string;
}

const COUNTIES = ["Wayne", "Oakland", "Macomb", "Washtenaw", "Genesee"];
const TRADES = ["hvac", "roofing", "plumbing", "electrical"];

/**
 * Batch 4 LR-16/18/19/20 — Territory lock, win/loss, auto-response, annual tier.
 */
export const LeadRadarBatch4 = ({ contractorId, contractorEmail }: Props) => {
  const [county, setCounty] = useState("Wayne");
  const [trade, setTrade] = useState("hvac");
  const [locking, setLocking] = useState(false);

  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [revenue, setRevenue] = useState("");

  const [templates, setTemplates] = useState<any[]>([]);
  const [tplBody, setTplBody] = useState("");

  useEffect(() => {
    if (contractorId) {
      void loadOutcomes();
      void loadTemplates();
    }
  }, [contractorId]);

  const loadOutcomes = async () => {
    const { data } = await supabase
      .from("radar_lead_outcomes" as any)
      .select("*")
      .eq("contractor_id", contractorId)
      .order("logged_at", { ascending: false })
      .limit(10);
    setOutcomes((data as any) || []);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("radar_auto_response_templates" as any)
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("active", true);
    setTemplates((data as any) || []);
  };

  const lockTerritory = async () => {
    if (!contractorId) { toast.error("Sign up first"); return; }
    setLocking(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-radar-territory-lock", {
        body: { contractor_id: contractorId, contractor_email: contractorEmail, county, trade },
      });
      if (error) throw error;
      if ((data as any)?.url) window.location.href = (data as any).url;
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLocking(false);
    }
  };

  const logOutcome = async (outcome: "won" | "lost") => {
    if (!contractorId) return;
    const { error } = await supabase.from("radar_lead_outcomes" as any).insert({
      contractor_id: contractorId,
      outcome,
      revenue_usd: outcome === "won" ? Number(revenue) || null : null,
      notes: outcomeNote || null,
    });
    if (error) { toast.error("Failed"); return; }
    setOutcomeNote(""); setRevenue("");
    toast.success(outcome === "won" ? "Win logged 🎉" : "Loss logged");
    await loadOutcomes();
  };

  const saveTemplate = async () => {
    if (!contractorId || !tplBody.trim()) return;
    const { error } = await supabase.from("radar_auto_response_templates" as any).insert({
      contractor_id: contractorId,
      template_body: tplBody.trim(),
    });
    if (error) { toast.error("Failed"); return; }
    setTplBody("");
    await loadTemplates();
    toast.success("Template saved");
  };

  const wonCount = outcomes.filter((o) => o.outcome === "won").length;
  const lostCount = outcomes.filter((o) => o.outcome === "lost").length;
  const winRate = outcomes.length ? Math.round((wonCount / outcomes.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Territory Lock */}
      <Card className="p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Exclusive Territory Lock — $499/mo</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Lock a county+trade combo. Every qualifying lead in this zone routes only to you.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select className="bg-muted/40 border border-border rounded px-2 py-1.5 text-sm" value={county} onChange={(e) => setCounty(e.target.value)}>
            {COUNTIES.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
          <select className="bg-muted/40 border border-border rounded px-2 py-1.5 text-sm capitalize" value={trade} onChange={(e) => setTrade(e.target.value)}>
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Button onClick={lockTerritory} disabled={locking || !contractorId} className="w-full bg-amber-500 hover:bg-amber-600 text-black">
          {locking ? "..." : `Lock ${county} · ${trade}`}
        </Button>
      </Card>

      {/* Win/Loss Tracker */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Win/Loss Tracker</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="p-2 rounded bg-emerald-500/10"><div className="text-xl font-bold text-emerald-400">{wonCount}</div><div className="text-[10px] text-muted-foreground uppercase">Won</div></div>
          <div className="p-2 rounded bg-red-500/10"><div className="text-xl font-bold text-red-400">{lostCount}</div><div className="text-[10px] text-muted-foreground uppercase">Lost</div></div>
          <div className="p-2 rounded bg-primary/10"><div className="text-xl font-bold text-primary">{winRate}%</div><div className="text-[10px] text-muted-foreground uppercase">Win Rate</div></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input placeholder="Revenue if won ($)" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          <Input placeholder="Notes (optional)" value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="default" onClick={() => logOutcome("won")} className="bg-emerald-600 hover:bg-emerald-700">Log Win</Button>
          <Button size="sm" variant="outline" onClick={() => logOutcome("lost")}>Log Loss</Button>
        </div>
      </Card>

      {/* Auto-Response Templates */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Auto-Response SMS Templates</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Saved on lead claim — saves 30s per lead.</p>
        <Textarea
          placeholder="Hi! This is Mike from Detroit HVAC. Got your request — can I swing by tomorrow at 10am for a free estimate?"
          value={tplBody}
          onChange={(e) => setTplBody(e.target.value)}
          rows={3}
          className="mb-2 text-sm"
        />
        <Button size="sm" onClick={saveTemplate} disabled={!contractorId} className="mb-3">
          <Plus className="h-3 w-3 mr-1" /> Save Template
        </Button>
        {templates.length > 0 && (
          <div className="space-y-1.5">
            {templates.map((t) => (
              <div key={t.id} className="text-xs p-2 rounded bg-muted/20">
                {t.template_body}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Annual Tier */}
      <Card className="p-5 bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-primary" />
          <Badge variant="default">Best Value</Badge>
        </div>
        <h3 className="text-base font-bold mb-1">Annual Tier — Pay 10, Get 12</h3>
        <p className="text-xs text-muted-foreground mb-3">$3,990/yr (vs $4,788 monthly). Locks in renewal pricing forever.</p>
        <Button size="sm" variant="default" disabled={!contractorId}>Upgrade to annual</Button>
      </Card>
    </div>
  );
};
