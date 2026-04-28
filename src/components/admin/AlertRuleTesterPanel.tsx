import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TestTube, Loader2 } from "lucide-react";

type Rule = "spend_anomaly" | "quiet_hours" | "dlq_aging" | "walker_budget";

export default function AlertRuleTesterPanel() {
  const [rule, setRule] = useState<Rule>("spend_anomaly");
  const [todaySpend, setTodaySpend] = useState("100");
  const [avg, setAvg] = useState("40");
  const [severity, setSeverity] = useState<"warn" | "crit">("warn");
  const [etTime, setEtTime] = useState("");
  const [enteredAt, setEnteredAt] = useState("");
  const [reason, setReason] = useState("no_email_found");
  const [dailySpend, setDailySpend] = useState("55");
  const [budget, setBudget] = useState("50");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    let input: Record<string, unknown> = {};
    if (rule === "spend_anomaly") input = { todaySpend: Number(todaySpend), rollingAvg7d: Number(avg) };
    if (rule === "quiet_hours") input = { severity, etTimeIso: etTime || undefined };
    if (rule === "dlq_aging") input = { enteredAt, reason };
    if (rule === "walker_budget") input = { dailySpend: Number(dailySpend), dailyBudgetUsd: Number(budget) };

    const { data, error } = await supabase.functions.invoke("alert-rule-tester", {
      body: { rule, input },
    });
    setResult(error ? { error: error.message } : data);
    setRunning(false);
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TestTube className="w-5 h-5" />
        <h3 className="font-semibold">Alert Rule Tester</h3>
        <span className="text-xs text-muted-foreground">Dry-run; no logs written</span>
      </div>

      <div>
        <Label>Rule</Label>
        <select
          value={rule}
          onChange={(e) => setRule(e.target.value as Rule)}
          className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="spend_anomaly">Spend anomaly (today vs 7d avg)</option>
          <option value="quiet_hours">Quiet hours (9pm–7am ET)</option>
          <option value="dlq_aging">DLQ aging (7d → suppress)</option>
          <option value="walker_budget">Walker budget cap</option>
        </select>
      </div>

      {rule === "spend_anomaly" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Today's spend ($)</Label>
            <Input value={todaySpend} onChange={(e) => setTodaySpend(e.target.value)} />
          </div>
          <div>
            <Label>7-day rolling avg ($)</Label>
            <Input value={avg} onChange={(e) => setAvg(e.target.value)} />
          </div>
        </div>
      )}
      {rule === "quiet_hours" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Severity</Label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="warn">warn</option>
              <option value="crit">crit</option>
            </select>
          </div>
          <div>
            <Label>ET time (ISO, optional)</Label>
            <Input placeholder="2026-04-28T22:30:00-04:00" value={etTime} onChange={(e) => setEtTime(e.target.value)} />
          </div>
        </div>
      )}
      {rule === "dlq_aging" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Entered DLQ at (ISO)</Label>
            <Input placeholder="2026-04-15T10:00:00Z" value={enteredAt} onChange={(e) => setEnteredAt(e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      )}
      {rule === "walker_budget" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Daily spend ($)</Label>
            <Input value={dailySpend} onChange={(e) => setDailySpend(e.target.value)} />
          </div>
          <div>
            <Label>Daily budget ($)</Label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        </div>
      )}

      <Button onClick={run} disabled={running}>
        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Simulate
      </Button>

      {result && (
        <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-72">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </Card>
  );
}
