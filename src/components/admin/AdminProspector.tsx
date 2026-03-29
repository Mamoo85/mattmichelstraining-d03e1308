import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Mail, Zap, Users, TrendingUp, Play, RefreshCw, Loader2 } from "lucide-react";

const INDUSTRIES = [
  "plumber", "electrician", "roofer", "HVAC contractor", "auto repair shop",
  "cleaning service", "landscaper", "contractor", "painter", "handyman",
  "dentist", "law firm", "medical clinic", "real estate agent", "salon / barbershop",
  "restaurant", "fitness studio", "accountant",
];

const CITIES = [
  "Detroit MI", "Grosse Pointe MI", "Harper Woods MI", "Eastpointe MI",
  "St. Clair Shores MI", "Warren MI", "Roseville MI", "Sterling Heights MI",
  "Royal Oak MI", "Ferndale MI", "Dearborn MI", "Livonia MI",
];

interface RunResult {
  found: number;
  queued: number;
  skipped: number;
  message: string;
}

interface DripResult {
  sent: number;
  total: number;
  message: string;
}

export default function AdminProspector() {
  const [industry, setIndustry] = useState("plumber");
  const [city, setCity] = useState("Grosse Pointe MI");
  const [limit, setLimit] = useState("10");
  const [running, setRunning] = useState(false);
  const [dripRunning, setDripRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [lastDrip, setLastDrip] = useState<DripResult | null>(null);
  const [runHistory, setRunHistory] = useState<Array<{ industry: string; city: string; result: RunResult; at: string }>>([]);

  const runProspecting = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("prospect-local-businesses", {
        body: { industry, city, limit: parseInt(limit, 10) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result: RunResult = data;
      setLastRun(result);
      setRunHistory(h => [{ industry, city, result, at: new Date().toLocaleTimeString() }, ...h.slice(0, 9)]);
      toast.success(`Prospecting complete: ${result.queued} leads added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prospecting failed");
    } finally {
      setRunning(false);
    }
  };

  const runDrip = async () => {
    setDripRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-design-drip", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result: DripResult = data;
      setLastDrip(result);
      toast.success(`Drip complete: ${result.sent} emails sent`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drip failed");
    } finally {
      setDripRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Automated Lead Prospector</h2>
          <p className="text-xs text-muted-foreground">Find businesses without good websites and auto-queue outreach</p>
        </div>
        <Badge variant="outline" className="text-xs">95% Automated</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Prospecting Controls */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search size={14} className="text-primary" /> Prospect for New Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="text-xs h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => (
                    <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">City / Area</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="text-xs h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Leads to Find</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="text-xs h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["5", "10", "15"].map(l => (
                    <SelectItem key={l} value={l} className="text-xs">{l} leads</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={runProspecting}
              disabled={running}
              className="w-full text-xs font-bold"
              size="sm"
            >
              {running ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Prospecting...</> : <><Play size={12} className="mr-1.5" /> Run Prospecting</>}
            </Button>

            {lastRun && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
                <div className="text-center">
                  <div className="text-lg font-black text-primary">{lastRun.found}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Found</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-green-500">{lastRun.queued}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Added</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-muted-foreground">{lastRun.skipped}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Skipped</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drip Controls */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail size={14} className="text-primary" /> Drip Email Sequence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-xs">The 4-step sequence:</p>
              {[
                { day: "Day 1", label: "\"Your competitors are getting calls you're not\"" },
                { day: "Day 4", label: "\"Quick follow-up + demo link\"" },
                { day: "Day 8", label: "\"I ran a quick check on your online presence\"" },
                { day: "Day 15", label: "\"Last message from me\"" },
              ].map(step => (
                <div key={step.day} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                  <Badge variant="outline" className="text-[9px] shrink-0 px-1.5">{step.day}</Badge>
                  <span className="text-[10px] italic">{step.label}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={runDrip}
              disabled={dripRunning}
              variant="outline"
              className="w-full text-xs font-bold"
              size="sm"
            >
              {dripRunning ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Processing Drip...</> : <><RefreshCw size={12} className="mr-1.5" /> Process Drip Now</>}
            </Button>

            <p className="text-[10px] text-muted-foreground">
              Only emails leads that have an email address and are tagged as auto-prospected. Respects timing — won't double-send.
            </p>

            {lastDrip && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div className="text-center">
                  <div className="text-lg font-black text-primary">{lastDrip.sent}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-muted-foreground">{lastDrip.total}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Eligible</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={12} className="text-primary" /> How the Machine Works
          </h3>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { step: "1", icon: Search, label: "Firecrawl searches Google for businesses without good websites" },
              { step: "2", icon: TrendingUp, label: "AI scores each business's digital gap (0–100)" },
              { step: "3", icon: Users, label: "High-gap leads are added to your CRM with a custom outreach email" },
              { step: "4", icon: Mail, label: "4-step drip sequence runs automatically over 15 days" },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <s.icon size={14} className="text-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run History */}
      {runHistory.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {runHistory.map((run, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <div className="text-xs">
                    <span className="font-medium">{run.industry}</span>
                    <span className="text-muted-foreground"> in {run.city}</span>
                    <span className="text-muted-foreground ml-2 text-[10px]">@ {run.at}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-green-500 font-bold">+{run.result.queued} leads</span>
                    <span className="text-muted-foreground">{run.result.found} found</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
