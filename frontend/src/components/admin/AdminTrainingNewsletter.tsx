import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Eye, Zap, Bot, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface NewsletterContent {
  subject: string;
  preview_text: string;
  headline: string;
  opening: string;
  body: string;
  truth_of_the_month: string;
  cta_text: string;
  next_month_tease: string;
}

interface ProviderResult {
  content?: NewsletterContent;
  html?: string;
  error?: string;
}

function getSafeNewsletterText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^(undefined|null)$/i.test(trimmed)) return undefined;
  return trimmed;
}

const TOPICS = [
  "progressive overload — the only thing that actually works",
  "core stability vs mirror muscles — why Instagram is lying to you",
  "the main lifts and why nothing else matters as much",
  "sleep: the free performance drug everyone ignores",
  "why most people are doing too much (and destroying themselves)",
  "why most people are doing too little",
  "the squat — most important movement you're probably doing wrong",
  "foam rolling — the power of 10 minutes you're skipping",
  "the hinge — deadlifts, RDLs, and why your back pain starts here",
  "training for high schoolers — what matters, what doesn't",
];

function ContentCard({
  label,
  icon,
  color,
  result,
  loading,
  onPreview,
  onSend,
  previewing,
  sending,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  result: ProviderResult | null;
  loading: boolean;
  onPreview: () => void;
  onSend: () => void;
  previewing: boolean;
  sending: boolean;
}) {
  const [showHtml, setShowHtml] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 border border-slate-700 rounded-lg p-6 bg-slate-900 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin mx-auto text-slate-400" size={28} />
          <p className="text-slate-400 text-sm">Generating with {label}…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 border border-slate-700 rounded-lg p-6 bg-slate-900 flex items-center justify-center min-h-[300px]">
        <p className="text-slate-500 text-sm text-center">Generate content to see {label} output</p>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex-1 border border-red-900 rounded-lg p-6 bg-slate-900 min-h-[300px]">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="font-bold text-white">{label}</span>
          <Badge variant="destructive" className="text-xs">Error</Badge>
        </div>
        <p className="text-red-400 text-sm font-mono">{result.error}</p>
      </div>
    );
  }

  const c = result.content!;
  const subject = getSafeNewsletterText(c.subject) || "Draft subject unavailable";
  const previewText = getSafeNewsletterText(c.preview_text) || "Preview text unavailable";
  const headline = getSafeNewsletterText(c.headline) || "Headline unavailable";
  const opening = getSafeNewsletterText(c.opening) || "Opening unavailable";
  const body = getSafeNewsletterText(c.body) || "Content unavailable.";
  const truthOfTheMonth = getSafeNewsletterText(c.truth_of_the_month) || "Truth of the month unavailable.";
  const ctaText = getSafeNewsletterText(c.cta_text) || "Book a Session";
  const nextMonthTease = getSafeNewsletterText(c.next_month_tease) || "Next month we talk about foam rolling.";

  return (
    <div className="flex-1 border border-slate-700 rounded-lg overflow-hidden bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-white text-sm">{label}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHtml(!showHtml)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors"
          >
            {showHtml ? "Content" : "Preview HTML"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
        {showHtml && result.html ? (
          <iframe
            srcDoc={result.html}
            className="w-full h-[500px] border border-slate-700 rounded bg-white"
            title={`${label} preview`}
          />
        ) : (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-white font-semibold">{subject}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Preview Text</p>
              <p className="text-slate-300">{previewText}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Headline</p>
              <p className="text-white font-bold text-base">{headline}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Opening</p>
              <p className="text-slate-300 italic">{opening}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Body</p>
              <p className="text-slate-300 whitespace-pre-wrap">{body}</p>
            </div>
            <div className="bg-slate-800 rounded p-3">
              <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">Truth of the Month</p>
              <p className="text-white font-semibold">{truthOfTheMonth}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">CTA</p>
              <p className="text-slate-300">{ctaText}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Next Month Tease</p>
              <p className="text-slate-300 italic">{nextMonthTease}</p>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-700 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPreview}
          disabled={previewing || sending}
          className="flex-1 border-slate-600 text-slate-300 hover:text-white"
        >
          {previewing ? <Loader2 size={13} className="animate-spin mr-1" /> : <Eye size={13} className="mr-1" />}
          Send Preview to Matt
        </Button>
        <Button
          size="sm"
          onClick={onSend}
          disabled={previewing || sending}
          className="flex-1"
          style={{ background: color }}
        >
          {sending ? <Loader2 size={13} className="animate-spin mr-1" /> : <Send size={13} className="mr-1" />}
          Send to List
        </Button>
      </div>
    </div>
  );
}

export default function AdminTrainingNewsletter() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [customContent, setCustomContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [anthropicResult, setAnthropicResult] = useState<ProviderResult | null>(null);
  const [lovableResult, setLovableResult] = useState<ProviderResult | null>(null);
  const [anthropicPreviewing, setAnthropicPreviewing] = useState(false);
  const [lovablePreviewing, setLovablePreviewing] = useState(false);
  const [anthropicSending, setAnthropicSending] = useState(false);
  const [lovableSending, setLovableSending] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setAnthropicResult(null);
    setLovableResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("training-newsletter-send", {
        body: {
          compare: true,
          topic: topic || undefined,
          custom_content: customContent || undefined,
        },
      });
      if (error) throw error;
      setAnthropicResult(data?.anthropic || { error: "No result" });
      setLovableResult(data?.lovable || { error: "No result" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(provider: "anthropic" | "lovable") {
    const setter = provider === "anthropic" ? setAnthropicPreviewing : setLovablePreviewing;
    setter(true);
    try {
      const { error } = await supabase.functions.invoke("training-newsletter-send", {
        body: {
          provider,
          preview_only: true,
          topic: topic || undefined,
          custom_content: customContent || undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Preview sent", description: `Check matt@mattmichelstraining.com for the ${provider} version.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Preview failed", description: msg, variant: "destructive" });
    } finally {
      setter(false);
    }
  }

  async function handleSend(provider: "anthropic" | "lovable") {
    const setter = provider === "anthropic" ? setAnthropicSending : setLovableSending;
    const fallbackSubject = getSafeNewsletterText(
      provider === "anthropic"
        ? anthropicResult?.content?.subject
        : lovableResult?.content?.subject
    );

    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-newsletter-send", {
        body: {
          provider,
          topic: topic || undefined,
          custom_content: customContent || undefined,
        },
      });
      if (error) throw error;
      toast({
        title: `Sent via ${provider}`,
        description: `Delivered to ${data?.sent || 0} subscribers. Subject: "${getSafeNewsletterText(data?.subject) || fallbackSubject || "Draft saved"}"`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    } finally {
      setter(false);
    }
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Training Newsletter</h2>
        <p className="text-slate-400 text-sm mt-1">
          Monthly newsletter for gym clients — high schoolers, college athletes, moms, dads. Compare Claude vs Gemini side-by-side.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Topic (leave blank for auto based on month)
          </label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-orange-500"
          >
            <option value="">Auto (based on current month)</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Matt's Draft (optional — paste raw content to have AI enhance in Matt's voice)
          </label>
          <Textarea
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="Paste Matt's raw notes or draft here. Both AIs will enhance it while keeping his voice 100%..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[120px] text-sm"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full font-bold text-sm uppercase tracking-wider"
          style={{ background: "#e8621a" }}
        >
          {loading ? (
            <><Loader2 size={15} className="animate-spin mr-2" /> Generating Both Versions…</>
          ) : (
            <><RefreshCw size={15} className="mr-2" /> Generate — GPT-5 vs Gemini</>
          )}
        </Button>
      </div>

      {/* Side-by-side comparison */}
      <div className="flex gap-4 flex-col lg:flex-row">
        <ContentCard
          label="GPT-5 Mini (OpenAI)"
          icon={<Bot size={15} className="text-orange-400" />}
          color="#e8621a"
          result={anthropicResult}
          loading={loading && !anthropicResult}
          onPreview={() => handlePreview("anthropic")}
          onSend={() => handleSend("anthropic")}
          previewing={anthropicPreviewing}
          sending={anthropicSending}
        />
        <ContentCard
          label="Gemini (Lovable)"
          icon={<Zap size={15} className="text-blue-400" />}
          color="#3b82f6"
          result={lovableResult}
          loading={loading && !lovableResult}
          onPreview={() => handlePreview("lovable")}
          onSend={() => handleSend("lovable")}
          previewing={lovablePreviewing}
          sending={lovableSending}
        />
      </div>

      {/* This month's content prompt */}
      {!anthropicResult && !loading && (
        <div className="bg-slate-900 border border-orange-900 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={15} className="text-orange-400" />
            <span className="text-sm font-semibold text-orange-300">Matt's Draft — This Month</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Paste this in the draft field above to generate this month's newsletter in both AI voices:
          </p>
          <button
            onClick={() => setCustomContent(`I'm not training professional athletes. I'm training high school, college, moms, and dads. I'm trying to enhance their knowledge through raw truth and reality.

Nobody is perfect, that's OK. But there's some things you should know.

Instagram is fake. You need core stability, not mirror muscles. Stick with the basics and just use progressive overload — it works 100% of the time.

Exercise is the health hack. 100% best thing you can do for your body, actually tied with sleep, but only if you do it right. And I have yet to meet a single person that didn't have a professional guiding them that was doing it right. I'm sure there are some, but most are doing too much or not nearly enough. They're choosing the wrong exercises, but to me that only matters if they don't do the main ones. If you do the main ones it really doesn't matter what else you do — they won't ruin you enough to be a net negative.

But if you only do curls or bench? Better than nothing I guess, but really stupid. You'll look and feel dumb in 20 years. Your knees will hurt, your back will ache, your shoulders will be wrecked. All that time wasted.

Next month we talk about the power of foam rolling.`)}
            className="mt-3 text-xs text-orange-400 hover:text-orange-300 border border-orange-900 hover:border-orange-700 px-3 py-2 rounded transition-colors"
          >
            Load This Month's Draft →
          </button>
        </div>
      )}
    </div>
  );
}
