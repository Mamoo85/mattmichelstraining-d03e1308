// Channel 9 — Reddit/Facebook value-drop post generator.
// Zero code automation. Matt copies the post + the redacted screenshot list and posts manually.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Copy, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_count: number;
  hiring_roles: string[];
  confidence: number;
}

const COMMUNITIES = [
  { name: "r/Detroit", url: "https://www.reddit.com/r/Detroit/submit" },
  { name: "r/smallbusiness", url: "https://www.reddit.com/r/smallbusiness/submit" },
  { name: "MI HVAC Contractors (FB)", url: "https://www.facebook.com/groups/" },
  { name: "Detroit Manufacturing Network (LinkedIn)", url: "https://www.linkedin.com/groups/" },
];

function redact(name: string): string {
  // "Acme Steel" → "A**** S****"
  return name.split(/\s+/).map(w => w[0] + "*".repeat(Math.max(2, w.length - 1))).join(" ");
}

export default function AdminCommunityDrop() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("industry_pulse_signals")
      .select("id,company_name,location,industry,hiring_count,hiring_roles,confidence")
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .limit(5);
    setSignals(data || []);
    setLoading(false);
  }

  const post = useMemo(() => {
    if (signals.length === 0) return "";
    const lines = signals.map(s =>
      `• ${redact(s.company_name)} (${s.location || "MI"}) — hiring ${s.hiring_count} ${s.hiring_roles[0] || "tradespeople"}`
    ).join("\n");
    return `I built a tool that watches 16 public data sources for Metro Detroit manufacturers about to hire — usually means they're about to spend on equipment, consumables, or services.

Found ${signals.length} more this week:
${lines}

Posting 5 free intelligence dossiers as samples this week (full company names + decision-makers + predicted spend). DM me if you want one — first 5 only.

— Matt | Detroit Web Agency | Grosse Pointe`;
  }, [signals]);

  function copyPost() {
    navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Post copied");
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#00d4ff]" /> Community Value Drop
        </h2>
        <p className="text-white/40 text-xs mt-1">Plain-text post for Reddit / FB groups · names redacted · DMs become Track A buyers</p>
      </div>

      <Card className="bg-[#0f1f35] border-white/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">This week's redacted preview ({signals.length})</p>
            <Button size="sm" onClick={load} className="bg-white/5 text-white/40 border border-white/10 text-xs">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          {signals.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
              <span className="text-white/70 font-mono">{redact(s.company_name)}</span>
              <span className="text-white/40">{s.location || "MI"} · {s.hiring_count}× {s.hiring_roles[0]}</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">{s.confidence}/10</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-[#0f1f35] border-white/10">
        <CardContent className="p-4 space-y-3">
          <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">Post copy (paste as-is)</p>
          <pre className="bg-black/30 border border-white/5 rounded p-3 text-white/80 text-xs leading-relaxed whitespace-pre-wrap font-sans">{post}</pre>
          <Button onClick={copyPost} className="bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40 w-full">
            {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied!" : "Copy Post"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#0f1f35] border-white/10">
        <CardContent className="p-4 space-y-2">
          <p className="text-white/60 text-xs uppercase tracking-wide font-semibold">Where to post</p>
          {COMMUNITIES.map(c => (
            <a key={c.name} href={c.url} target="_blank" rel="noreferrer" className="flex items-center justify-between py-2 px-3 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <span className="text-white/80 text-sm">{c.name}</span>
              <span className="text-[#00d4ff] text-xs">Open →</span>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
