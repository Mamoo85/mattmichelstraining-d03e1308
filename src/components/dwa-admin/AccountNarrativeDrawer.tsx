import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountKey: string | null;
  companyName: string | null;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-account-narrative`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AccountNarrativeDrawer({ open, onOpenChange, accountKey, companyName }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cached, setCached] = useState<{ pitch_angle?: string | null; recommended_products?: string[] | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stream = async (force: boolean) => {
    if (!accountKey) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContent("");
    setErr(null);
    setCached(null);
    setLoading(true);

    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ account_key: accountKey, force }),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`${resp.status}: ${text.slice(0, 200)}`);
      }

      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        setContent(j.narrative_md || "");
        setCached({ pitch_angle: j.pitch_angle, recommended_products: j.recommended_products });
        setLoading(false);
        return;
      }

      // SSE streaming — handle both Anthropic and OpenAI-compatible shapes
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let streamDone = false;
      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(data);
            const oai = parsed.choices?.[0]?.delta?.content;
            if (oai) acc += oai;
            const anth = parsed.delta?.text;
            if (anth) acc += anth;
            setContent(acc);
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setErr(e.message || "stream failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && accountKey) void stream(false);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountKey]);

  // Strip the trailer for cleaner display
  const display = content.replace(/PITCH_ANGLE:[\s\S]*$/i, "").trim();
  const pitchMatch = content.match(/PITCH_ANGLE:\s*([^|\n]+)/i);
  const prodMatch = content.match(/PRODUCTS:\s*([^\n]+)/i);
  const pitch = cached?.pitch_angle || pitchMatch?.[1]?.trim();
  const products = cached?.recommended_products || prodMatch?.[1]?.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-[#0a1628] border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00d4ff]" />
                {companyName || "Account narrative"}
              </SheetTitle>
              <SheetDescription className="text-white/50">
                Claude-generated WHY-now briefing. Cached 24h. Click refresh for a fresh take.
              </SheetDescription>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => stream(true)} disabled={loading} className="text-white hover:bg-white/10">
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="text-white hover:bg-white/10">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 text-sm">
              <div className="font-bold text-rose-300 mb-1">Generation failed</div>
              <div className="text-xs">{err}</div>
            </div>
          )}

          {pitch && (
            <div className="rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#00d4ff] font-mono">Pitch angle</div>
              <div className="text-sm font-bold text-white mt-0.5">{pitch}</div>
              {products && products.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {products.map((p) => (
                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">{p}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {display ? (
            <div className="prose prose-invert prose-sm max-w-none text-white/85 whitespace-pre-wrap leading-relaxed">
              {display}
              {loading && <span className="inline-block w-2 h-4 bg-[#00d4ff] animate-pulse ml-1 align-middle" />}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" />
              Streaming Claude analysis…
            </div>
          ) : !err && (
            <div className="text-white/40 text-sm text-center py-6">Select an account to begin.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
