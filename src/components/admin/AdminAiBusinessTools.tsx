import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Loader2, X, Instagram, Quote, BookOpen, Mail, Layout,
  HelpCircle, TrendingDown, DollarSign, BarChart3, Search,
  Copy, Save,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type ToolKey =
  | null
  | "social_post"
  | "testimonial"
  | "blog_seo"
  | "email_subjects"
  | "landing_copy"
  | "faq"
  | "churn_predict"
  | "pricing_optimizer"
  | "revenue_forecast"
  | "competitor_monitor";

const MARKETING_TOOLS = [
  { key: "social_post" as const, label: "Social Media Post Generator", desc: "Create Instagram/Facebook captions with hashtags and CTAs from any topic or client win.", icon: Instagram, color: "text-pink-500", badge: "Marketing AI", fn: "ai-marketing-tools" },
  { key: "testimonial" as const, label: "AI Testimonial Writer", desc: "Draft realistic testimonials from athlete progress data — flagged for approval before use.", icon: Quote, color: "text-amber-500", badge: "Marketing AI", fn: "ai-marketing-tools" },
  { key: "blog_seo" as const, label: "SEO Blog Writer", desc: "Generate SEO-optimized articles targeting youth sports keywords for the Learn Hub.", icon: BookOpen, color: "text-emerald-500", badge: "Content AI", fn: "ai-marketing-tools" },
  { key: "email_subjects" as const, label: "Email Subject Lines", desc: "Generate 5 A/B-testable subject line variants with style labels and open-rate predictions.", icon: Mail, color: "text-blue-500", badge: "Marketing AI", fn: "ai-marketing-tools" },
  { key: "landing_copy" as const, label: "Landing Page Copy", desc: "Generate hero headlines, value props, and CTAs tailored to parents, athletes, or coaches.", icon: Layout, color: "text-violet-500", badge: "Content AI", fn: "ai-marketing-tools" },
  { key: "faq" as const, label: "FAQ Generator", desc: "Auto-generate FAQ content from common objections and support patterns.", icon: HelpCircle, color: "text-cyan-500", badge: "Content AI", fn: "ai-marketing-tools" },
];

const BUSINESS_TOOLS = [
  { key: "churn_predict" as const, label: "Churn Predictor", desc: "Analyzes subscriber activity to flag HIGH/MEDIUM/LOW churn risk with re-engagement actions.", icon: TrendingDown, color: "text-red-500", badge: "Analytics AI", fn: "ai-business-intelligence" },
  { key: "pricing_optimizer" as const, label: "Pricing Optimizer", desc: "Analyze tier distribution and suggest optimal pricing, bundles, and anchoring strategies.", icon: DollarSign, color: "text-green-500", badge: "Analytics AI", fn: "ai-business-intelligence" },
  { key: "revenue_forecast" as const, label: "Revenue Forecaster", desc: "Project MRR, churn, and LTV for 3/6/12 months based on historical trends.", icon: BarChart3, color: "text-indigo-500", badge: "Analytics AI", fn: "ai-business-intelligence" },
  { key: "competitor_monitor" as const, label: "Competitor Monitor", desc: "Scrape a competitor's site and get AI analysis of their pricing, positioning, and gaps.", icon: Search, color: "text-orange-500", badge: "Intel AI", fn: "ai-business-intelligence" },
];

const ALL_TOOLS = [...MARKETING_TOOLS, ...BUSINESS_TOOLS];

const AdminAiBusinessTools = () => {
  const [activeTool, setActiveTool] = useState<ToolKey>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const qc = useQueryClient();

  const close = () => { setActiveTool(null); setResult(""); };

  const runTool = async (fnName: string, tool: string, context: Record<string, any>) => {
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { tool, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.result || "No result returned.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const saveToDrafts = async (title: string, draftType: string) => {
    if (!result) return;
    try {
      const { error } = await supabase.from("marketing_drafts").insert({
        title,
        body: result,
        draft_type: draftType,
        status: "pending",
        generated_by: "ai",
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["marketing-drafts"] });
      toast.success("Saved to Marketing Drafts for review");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  };

  const toolMeta = activeTool ? ALL_TOOLS.find((t) => t.key === activeTool) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-foreground tracking-display uppercase">AI Business & Marketing Tools</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Generate marketing content, analyze business metrics, and monitor competitors — all drafts go to your approval queue.
        </p>
      </div>

      {!activeTool && (
        <>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Marketing & Content</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MARKETING_TOOLS.map((tool) => <ToolCard key={tool.key} tool={tool} onClick={() => setActiveTool(tool.key)} />)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Business Intelligence</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BUSINESS_TOOLS.map((tool) => <ToolCard key={tool.key} tool={tool} onClick={() => setActiveTool(tool.key)} />)}
            </div>
          </div>
        </>
      )}

      {activeTool && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={close} className="text-xs gap-1"><X size={14} /> Back</Button>
            <Badge className="text-[10px] uppercase tracking-widest">{toolMeta?.label}</Badge>
          </div>

          <ToolForm tool={activeTool} loading={loading} onRun={(ctx) => runTool(toolMeta!.fn, activeTool, ctx)} />

          {result && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToClipboard} className="text-xs gap-1">
                  <Copy size={12} /> Copy
                </Button>
                <Button size="sm" variant="default" onClick={() => saveToDrafts(`${toolMeta?.label} Draft`, activeTool)} className="text-xs gap-1">
                  <Save size={12} /> Save to Drafts
                </Button>
              </div>
              <Card>
                <CardContent className="pt-4 prose prose-sm max-w-none dark:prose-invert text-xs">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function ToolCard({ tool, onClick }: { tool: typeof ALL_TOOLS[0]; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-all group" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Icon size={20} className={tool.color} />
          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">{tool.badge}</Badge>
        </div>
        <CardTitle className="text-xs font-bold mt-2 group-hover:text-primary transition-colors">{tool.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{tool.desc}</p>
      </CardContent>
    </Card>
  );
}

function ToolForm({ tool, loading, onRun }: { tool: ToolKey; loading: boolean; onRun: (ctx: Record<string, any>) => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setFields((prev) => ({ ...prev, [k]: v }));

  const submit = () => onRun(fields);

  switch (tool) {
    case "social_post":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Topic</Label><Input value={fields.topic || ""} onChange={(e) => set("topic", e.target.value)} placeholder="e.g., Client PR, new program launch" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Platform</Label>
              <Select value={fields.platform || "Instagram"} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Instagram">Instagram</SelectItem><SelectItem value="Facebook">Facebook</SelectItem><SelectItem value="Both">Both</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] text-muted-foreground">Audience</Label><Input value={fields.audience || ""} onChange={(e) => set("audience", e.target.value)} placeholder="e.g., parents of youth athletes" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Tone</Label>
              <Select value={fields.tone || "motivational"} onValueChange={(v) => set("tone", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="motivational">Motivational</SelectItem><SelectItem value="educational">Educational</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="community">Community</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <Textarea value={fields.includeStats || ""} onChange={(e) => set("includeStats", e.target.value)} placeholder="Optional: stats, PRs, or specific results to mention" className="text-xs" rows={2} />
          <RunButton loading={loading} onClick={submit} label="Generate Post" />
        </div>
      );

    case "testimonial":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Athlete Name</Label><Input value={fields.athleteName || ""} onChange={(e) => set("athleteName", e.target.value)} placeholder="First name" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Sport</Label><Input value={fields.sport || ""} onChange={(e) => set("sport", e.target.value)} placeholder="e.g., Baseball" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Improvements</Label><Input value={fields.improvements || ""} onChange={(e) => set("improvements", e.target.value)} placeholder="e.g., +30lb squat, better mobility" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Training Duration</Label><Input value={fields.duration || ""} onChange={(e) => set("duration", e.target.value)} placeholder="e.g., 6 months" className="text-xs" /></div>
          </div>
          <Input value={fields.prs || ""} onChange={(e) => set("prs", e.target.value)} placeholder="Optional: specific PRs" className="text-xs" />
          <RunButton loading={loading} onClick={submit} label="Draft Testimonial" />
        </div>
      );

    case "blog_seo":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Article Topic</Label><Input value={fields.topic || ""} onChange={(e) => set("topic", e.target.value)} placeholder="e.g., Why youth athletes need strength training" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Primary Keyword</Label><Input value={fields.keyword || ""} onChange={(e) => set("keyword", e.target.value)} placeholder="e.g., youth strength training" className="text-xs" /></div>
            <div className="sm:col-span-2"><Label className="text-[10px] text-muted-foreground">Audience</Label><Input value={fields.audience || ""} onChange={(e) => set("audience", e.target.value)} placeholder="e.g., parents and high school coaches" className="text-xs" /></div>
          </div>
          <Textarea value={fields.outline || ""} onChange={(e) => set("outline", e.target.value)} placeholder="Optional: outline or key points to cover" className="text-xs" rows={3} />
          <RunButton loading={loading} onClick={submit} label="Generate Article" />
        </div>
      );

    case "email_subjects":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Email Topic</Label><Input value={fields.topic || ""} onChange={(e) => set("topic", e.target.value)} placeholder="e.g., Summer training camp" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select value={fields.emailType || "promotional"} onValueChange={(v) => set("emailType", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="promotional">Promotional</SelectItem><SelectItem value="newsletter">Newsletter</SelectItem><SelectItem value="re-engagement">Re-engagement</SelectItem><SelectItem value="announcement">Announcement</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] text-muted-foreground">Urgency</Label>
              <Select value={fields.urgency || "medium"} onValueChange={(v) => set("urgency", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <RunButton loading={loading} onClick={submit} label="Generate Subject Lines" />
        </div>
      );

    case "landing_copy":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Page / Feature</Label><Input value={fields.page || ""} onChange={(e) => set("page", e.target.value)} placeholder="e.g., Summer camp signup" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Target Audience</Label><Input value={fields.audience || ""} onChange={(e) => set("audience", e.target.value)} placeholder="e.g., parents of athletes ages 10-18" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Key Offer</Label><Input value={fields.offer || ""} onChange={(e) => set("offer", e.target.value)} placeholder="e.g., 14-day free trial" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Differentiator</Label><Input value={fields.differentiator || ""} onChange={(e) => set("differentiator", e.target.value)} placeholder="e.g., 20+ years, zero injuries" className="text-xs" /></div>
          </div>
          <RunButton loading={loading} onClick={submit} label="Generate Copy" />
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Page Context</Label><Input value={fields.page || ""} onChange={(e) => set("page", e.target.value)} placeholder="e.g., pricing page, homepage" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Key Objections</Label><Input value={fields.objections || ""} onChange={(e) => set("objections", e.target.value)} placeholder="e.g., price, time, results" className="text-xs" /></div>
          </div>
          <Textarea value={fields.existingFaqs || ""} onChange={(e) => set("existingFaqs", e.target.value)} placeholder="Optional: paste existing FAQs to avoid duplicates" className="text-xs" rows={2} />
          <RunButton loading={loading} onClick={submit} label="Generate FAQs" />
        </div>
      );

    case "churn_predict":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">This tool analyzes your paying subscribers' activity over the last 30 days to flag churn risk. No inputs needed — it pulls data automatically.</p>
          <RunButton loading={loading} onClick={() => onRun({})} label="Run Churn Analysis" />
        </div>
      );

    case "pricing_optimizer":
      return (
        <div className="space-y-3">
          <Textarea value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional context: goals, constraints, upcoming changes..." className="text-xs" rows={2} />
          <RunButton loading={loading} onClick={submit} label="Analyze Pricing" />
        </div>
      );

    case "revenue_forecast":
      return (
        <div className="space-y-3">
          <Textarea value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional: planned campaigns, seasonal notes, growth targets..." className="text-xs" rows={2} />
          <RunButton loading={loading} onClick={submit} label="Generate Forecast" />
        </div>
      );

    case "competitor_monitor":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Competitor URL</Label><Input value={fields.competitorUrl || ""} onChange={(e) => set("competitorUrl", e.target.value)} placeholder="https://competitor-gym.com" className="text-xs" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Competitor Name</Label><Input value={fields.competitorName || ""} onChange={(e) => set("competitorName", e.target.value)} placeholder="e.g., XYZ Athletics" className="text-xs" /></div>
          </div>
          <Textarea value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional: specific aspects to compare (pricing, programs, tech)" className="text-xs" rows={2} />
          <RunButton loading={loading} onClick={submit} label="Analyze Competitor" />
        </div>
      );

    default:
      return null;
  }
}

function RunButton({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return (
    <Button size="sm" onClick={onClick} disabled={loading} className="text-xs gap-1">
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {loading ? "Generating…" : label}
    </Button>
  );
}

export default AdminAiBusinessTools;
