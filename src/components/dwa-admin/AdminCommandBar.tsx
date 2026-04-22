import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/browserStorage";

type Draft = { to_email?: string; to_phone?: string; to_name?: string; subject?: string; body: string; _skip?: boolean };
type StepLog = { step: number; tool: string; ok: boolean; count?: number; error?: string; preview?: any[] };
type RunResult = {
  ok?: boolean;
  log_id?: string;
  reasoning?: string;
  output_format?: string;
  steps?: StepLog[];
  data_rows?: any[];
  drafts?: Draft[] | null;
  partial?: boolean;
  cost_usd?: number;
  aborted?: boolean;
  reason?: string;
  error?: string;
};

const RECENT_KEY = "dwa_admin_command_recent_v1";
const QUICK_PROMPTS = [
  "How many electrician leads do we have, broken down by city",
  "Top 10 Demand Radar signals this week",
  "Match 5 plumbing leads to 10 buyers and draft bulk emails",
  "Find 5 nursing homes with low staffing and draft Talent Radar pitches",
  "Find 5 HVAC shops 3-15 techs and draft FieldDesk pitches",
  "Who texted us in the last 7 days that I never replied to",
];

export default function AdminCommandBar() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState({ reasoning: false, data: false, drafts: true });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [queuing, setQueuing] = useState(false);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = safeLocalStorage.getItem(RECENT_KEY);
    if (raw) try { setRecent(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 120);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (result?.drafts && Array.isArray(result.drafts)) {
      setDrafts(result.drafts.map((d) => ({ ...d, _skip: false })));
      setOpen({ reasoning: false, data: false, drafts: true });
    } else if (result) {
      setDrafts([]);
      setOpen({ reasoning: !!result.reasoning, data: !!result.data_rows?.length, drafts: false });
    }
  }, [result]);

  const pushRecent = (p: string) => {
    const next = [p, ...recent.filter((r) => r !== p)].slice(0, 10);
    setRecent(next);
    safeLocalStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const run = async (text?: string) => {
    const q = (text ?? prompt).trim();
    if (!q || running) return;
    setRunning(true);
    setResult(null);
    setQueueMsg(null);
    pushRecent(q);
    try {
      const { data, error } = await supabase.functions.invoke("admin-command", {
        body: { action: "run", prompt: q },
      });
      if (error) setResult({ error: error.message });
      else setResult(data as RunResult);
    } catch (e: any) {
      setResult({ error: e?.message || "Request failed" });
    } finally {
      setRunning(false);
    }
  };

  const queue = async (selectedOnly: boolean) => {
    const toQueue = drafts
      .filter((d, i) => !d._skip && (!selectedOnly || (d as any)._sel))
      .filter((d) => !!d.to_email && !!d.body)
      .map(({ _skip, ...rest }) => rest);
    if (toQueue.length === 0) {
      setQueueMsg("No emails to queue (skipped or no email address).");
      return;
    }
    setQueuing(true);
    setQueueMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-command", {
        body: { action: "queue", queue_drafts: toQueue, log_id: result?.log_id },
      });
      if (error) setQueueMsg(`❌ ${error.message}`);
      else if ((data as any)?.ok) setQueueMsg(`✅ Queued ${(data as any).queued} drafts to approval (10-min delay).`);
      else setQueueMsg(`❌ ${(data as any)?.error || "Queue failed"}`);
    } catch (e: any) {
      setQueueMsg(`❌ ${e?.message || "Queue failed"}`);
    } finally {
      setQueuing(false);
    }
  };

  const copyAll = () => {
    const text = drafts
      .filter((d) => !d._skip)
      .map((d, i) => `--- ${i + 1}. To: ${d.to_email || d.to_phone || "—"} ${d.to_name ? `(${d.to_name})` : ""}\nSubject: ${d.subject || ""}\n\n${d.body}\n`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => setQueueMsg("📋 Copied all drafts."));
  };

  const updateDraft = (i: number, patch: Partial<Draft>) => {
    setDrafts((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  // ───────── render ─────────
  return (
    <div className="mb-6">
      {/* Sticky bar */}
      <div className={`sticky top-14 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-[#0a1628]/95 backdrop-blur border-b border-[#00d4ff]/20 ${collapsed ? "shadow-[0_4px_16px_rgba(0,212,255,0.08)]" : ""}`}>
        {collapsed ? (
          <button
            onClick={() => { setCollapsed(false); setTimeout(() => taRef.current?.focus(), 50); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="w-full flex items-center gap-2 text-left text-sm text-white/70 hover:text-white min-h-[44px] px-3 rounded-lg bg-white/5 border border-white/10"
          >
            <span className="text-lg">🧠</span>
            <span>Ask the agent…</span>
          </button>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <span className="text-xl mt-2">🧠</span>
              <textarea
                ref={taRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                placeholder="Ask the agent… e.g. ‘Find 10 plumbing leads and draft emails to 10 buyers’"
                rows={2}
                className="flex-1 min-w-0 bg-[#061018] border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#00d4ff]/60"
              />
              <button
                onClick={() => run()}
                disabled={running || !prompt.trim()}
                className="shrink-0 min-h-[44px] px-3 sm:px-4 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? "…" : "Run"}
              </button>
            </div>
            {/* Recent + quick chips */}
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
              {(recent.length ? recent : QUICK_PROMPTS).slice(0, 6).map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setPrompt(p); run(p); }}
                  className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-[#00d4ff]/40 whitespace-nowrap"
                  title={p}
                >
                  {p.length > 38 ? p.slice(0, 36) + "…" : p}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Running progress */}
      {running && (
        <div className="mt-3 rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/5 p-3 text-sm text-[#00d4ff] flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[#00d4ff] rounded-full animate-pulse" />
          🧠 Planning + executing…
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 space-y-2">
          {result.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              ❌ {result.error}
            </div>
          )}
          {result.aborted && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              ⚠️ Aborted: {result.reason}
            </div>
          )}
          {result.partial && !result.error && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              ⚠️ Partial result — one or more steps failed. Output below is what we got.
            </div>
          )}

          {/* Step pills */}
          {result.steps && result.steps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.steps.map((s) => (
                <span
                  key={s.step}
                  className={`text-[11px] px-2 py-1 rounded-full border ${
                    s.ok
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-red-400/30 bg-red-400/10 text-red-300"
                  }`}
                  title={s.error || ""}
                >
                  {s.ok ? "✓" : "✗"} {s.tool}{typeof s.count === "number" ? ` (${s.count})` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Reasoning accordion */}
          {result.reasoning && (
            <Accordion
              title="🧠 Reasoning"
              open={open.reasoning}
              onToggle={() => setOpen((o) => ({ ...o, reasoning: !o.reasoning }))}
            >
              <p className="text-sm text-white/70">{result.reasoning}</p>
            </Accordion>
          )}

          {/* Data accordion */}
          {result.data_rows && result.data_rows.length > 0 && (
            <Accordion
              title={`📊 Data (${result.data_rows.length} rows)`}
              open={open.data}
              onToggle={() => setOpen((o) => ({ ...o, data: !o.data }))}
            >
              <div className="space-y-2">
                {result.data_rows.slice(0, 25).map((row, i) => (
                  <div key={i} className="rounded-md bg-white/5 border border-white/10 p-2.5 text-xs text-white/80">
                    {Object.entries(row).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-white/40 shrink-0 min-w-[80px]">{k}:</span>
                        <span className="break-all">{v == null ? "—" : String(v).slice(0, 200)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {result.data_rows.length > 25 && (
                  <p className="text-xs text-white/40">… and {result.data_rows.length - 25} more</p>
                )}
              </div>
            </Accordion>
          )}

          {/* Drafts accordion */}
          {drafts.length > 0 && (
            <Accordion
              title={`📧 ${drafts.length} drafts ready`}
              open={open.drafts}
              onToggle={() => setOpen((o) => ({ ...o, drafts: !o.drafts }))}
              defaultOpen
            >
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      d._skip ? "border-white/5 bg-white/[0.02] opacity-50" : "border-[#00d4ff]/20 bg-[#00d4ff]/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-white/40">To</div>
                        <div className="text-sm text-white truncate">
                          {d.to_email || d.to_phone || "—"} {d.to_name && <span className="text-white/50">· {d.to_name}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => updateDraft(i, { _skip: !d._skip })}
                        className="shrink-0 text-[11px] px-2 py-1 rounded border border-white/15 text-white/60 hover:text-white min-h-[32px]"
                      >
                        {d._skip ? "Restore" : "Skip"}
                      </button>
                    </div>

                    {editIdx === i ? (
                      <div className="space-y-2">
                        {d.subject !== undefined && (
                          <input
                            value={d.subject || ""}
                            onChange={(e) => updateDraft(i, { subject: e.target.value })}
                            className="w-full bg-[#061018] border border-white/15 rounded px-2 py-1.5 text-sm text-white"
                            placeholder="Subject"
                          />
                        )}
                        <textarea
                          value={d.body}
                          onChange={(e) => updateDraft(i, { body: e.target.value })}
                          rows={6}
                          className="w-full bg-[#061018] border border-white/15 rounded px-2 py-1.5 text-sm text-white resize-y"
                        />
                        <button
                          onClick={() => setEditIdx(null)}
                          className="text-xs px-3 py-1.5 rounded bg-[#00d4ff] text-[#0a1628] font-bold min-h-[36px]"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        {d.subject && <div className="text-sm text-white font-semibold mb-1 break-words">{d.subject}</div>}
                        <div className="text-xs text-white/70 whitespace-pre-wrap break-words line-clamp-6">{d.body}</div>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setEditIdx(i)}
                            className="text-[11px] px-2 py-1 rounded border border-white/15 text-white/70 hover:text-white min-h-[32px]"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(`Subject: ${d.subject || ""}\n\n${d.body}`)}
                            className="text-[11px] px-2 py-1 rounded border border-white/15 text-white/70 hover:text-white min-h-[32px]"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => queue(false)}
                  disabled={queuing}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold disabled:opacity-40"
                >
                  {queuing ? "Queuing…" : `📤 Queue All (${drafts.filter((d) => !d._skip).length})`}
                </button>
                <button
                  onClick={copyAll}
                  className="w-full sm:w-auto min-h-[44px] px-4 rounded-lg border border-white/20 text-sm text-white/80 hover:text-white"
                >
                  📋 Copy All
                </button>
              </div>
              {queueMsg && <div className="mt-2 text-xs text-white/70">{queueMsg}</div>}
            </Accordion>
          )}

          {/* No-draft completion */}
          {!drafts.length && !result.error && !result.aborted && result.steps && result.steps.length > 0 && (
            <div className="text-xs text-white/40">
              ✅ Done in {result.steps.length} step{result.steps.length === 1 ? "" : "s"} · ${result.cost_usd?.toFixed(4) || "0.01"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Accordion({
  title, open, onToggle, children, defaultOpen,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-white/90 min-h-[44px]"
      >
        <span>{title}</span>
        <span className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
