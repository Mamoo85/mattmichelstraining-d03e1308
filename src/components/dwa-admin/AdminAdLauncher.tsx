// AdminAdLauncher — review pending ad drafts and one-click launch to Meta.
// If META secrets aren't configured, "Launch" returns paste-ready creative
// for manual entry into Ads Manager.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Draft = {
  id: string;
  business_name: string;
  trade: string;
  city: string;
  state: string | null;
  meta_headline: string | null;
  meta_primary_text: string | null;
  meta_description: string | null;
  meta_image_prompt: string | null;
  meta_targeting: any;
  meta_daily_budget_cents: number;
  meta_status: string;
  meta_campaign_id: string | null;
  google_headlines: string[] | null;
  google_descriptions: string[] | null;
  google_keywords: string[] | null;
  landing_url: string | null;
  status: string;
  created_at: string;
};

export default function AdminAdLauncher() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "launched" | "all">("pending");

  async function load() {
    setLoading(true);
    const q = supabase.from("ad_launch_drafts" as any).select("*").order("created_at", { ascending: false }).limit(50);
    const { data, error } = await q;
    if (error) {
      toast.error(`Load failed: ${error.message}`);
      setLoading(false);
      return;
    }
    setDrafts((data || []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = drafts.filter((d) =>
    filter === "all" ? true : filter === "pending" ? d.status === "pending_review" : d.status === "launched"
  );

  async function launch(draft: Draft) {
    if (!confirm(`Launch ad campaign for ${draft.business_name}?\n\nIf Meta API is configured, campaign will be created in PAUSED state. Otherwise you'll get paste-ready copy.`)) return;
    setLaunching(draft.id);
    try {
      const { data, error } = await supabase.functions.invoke("launch-meta-ad", {
        body: { draft_id: draft.id },
      });
      if (error) throw error;
      if (data?.mode === "manual") {
        toast.success("Paste-ready! Meta API not configured — review the creative.");
      } else {
        toast.success(`Campaign created: ${data?.campaign_id} (PAUSED — activate in Ads Manager)`);
      }
      load();
    } catch (e: any) {
      toast.error(`Launch failed: ${e.message || e}`);
    } finally {
      setLaunching(null);
    }
  }

  async function dismiss(draft: Draft) {
    if (!confirm(`Dismiss this ad draft? It won't be deleted, just hidden.`)) return;
    await supabase.from("ad_launch_drafts" as any).update({ status: "dismissed", reviewed_at: new Date().toISOString() }).eq("id", draft.id);
    load();
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#00d4ff]">🚀 Ad Launcher</h1>
          <p className="text-sm text-white/60">Auto-drafted ad campaigns ready for one-click launch</p>
        </div>
        <div className="flex gap-2">
          {(["pending", "launched", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-semibold ${filter === f ? "bg-[#00d4ff] text-[#0a1628]" : "bg-white/5 text-white/70 border border-white/10"}`}
            >
              {f}
            </button>
          ))}
          <button onClick={load} className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 text-white/70 border border-white/10">↻</button>
        </div>
      </div>

      {loading && <div className="text-white/40 text-sm">Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-white/40 text-sm p-8 text-center border border-white/10 rounded">
          No {filter === "all" ? "" : filter} ad drafts. Drafts are created automatically when a contractor pays for the lead subscription.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((d) => {
          const isOpen = expanded === d.id;
          return (
            <div key={d.id} className="border border-white/10 rounded bg-[#0d1f3c]">
              <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white">{d.business_name}</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    {d.trade.charAt(0).toUpperCase() + d.trade.slice(1)} · {d.city}, {d.state || "MI"} · ${(d.meta_daily_budget_cents / 100).toFixed(0)}/day
                  </div>
                  <div className="text-[11px] text-white/40 mt-1">
                    {new Date(d.created_at).toLocaleString()} · {d.status}
                    {d.meta_status === "launched" && d.meta_campaign_id && ` · Meta: ${d.meta_campaign_id}`}
                    {d.meta_status === "manual" && ` · Manual paste`}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setExpanded(isOpen ? null : d.id)} className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 border border-white/10">
                    {isOpen ? "Hide" : "Preview"}
                  </button>
                  {d.status === "pending_review" && (
                    <>
                      <button onClick={() => launch(d)} disabled={launching === d.id} className="px-3 py-1.5 rounded text-xs font-bold bg-[#00d4ff] text-[#0a1628] disabled:opacity-40">
                        {launching === d.id ? "Launching…" : "🚀 Launch"}
                      </button>
                      <button onClick={() => dismiss(d)} className="px-3 py-1.5 rounded text-xs font-semibold bg-white/5 border border-white/10 text-white/60">
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-white/10 p-4 space-y-4 text-xs">
                  {/* Meta */}
                  <div>
                    <div className="font-bold text-[#00d4ff] mb-2">📘 Meta (Facebook + Instagram)</div>
                    <div className="space-y-2">
                      <Field label="Headline" value={d.meta_headline} onCopy={copy} />
                      <Field label="Primary text" value={d.meta_primary_text} onCopy={copy} multiline />
                      <Field label="Description" value={d.meta_description} onCopy={copy} />
                      <Field label="Image prompt (paste into AI image gen)" value={d.meta_image_prompt} onCopy={copy} multiline />
                      <Field label="Landing URL" value={d.landing_url} onCopy={copy} />
                      <div className="bg-black/30 p-2 rounded">
                        <div className="text-white/50 mb-1">Targeting</div>
                        <pre className="text-white/80 whitespace-pre-wrap">{JSON.stringify(d.meta_targeting, null, 2)}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Google */}
                  <div>
                    <div className="font-bold text-[#00d4ff] mb-2">🔍 Google Ads (paste into Ads Manager)</div>
                    <div className="space-y-2">
                      {d.google_headlines && (
                        <div>
                          <div className="text-white/50 mb-1">Headlines</div>
                          {d.google_headlines.map((h, i) => (
                            <div key={i} className="flex justify-between gap-2 bg-black/30 p-2 rounded mb-1">
                              <span className="text-white/80">{h}</span>
                              <button onClick={() => copy(h, `Headline ${i+1}`)} className="text-[#00d4ff] text-[10px]">copy</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {d.google_descriptions && (
                        <div>
                          <div className="text-white/50 mb-1">Descriptions</div>
                          {d.google_descriptions.map((h, i) => (
                            <div key={i} className="flex justify-between gap-2 bg-black/30 p-2 rounded mb-1">
                              <span className="text-white/80">{h}</span>
                              <button onClick={() => copy(h, `Desc ${i+1}`)} className="text-[#00d4ff] text-[10px]">copy</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {d.google_keywords && (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-white/50">Keywords ({d.google_keywords.length})</span>
                            <button onClick={() => copy(d.google_keywords!.join("\n"), "All keywords")} className="text-[#00d4ff] text-[10px]">copy all</button>
                          </div>
                          <div className="bg-black/30 p-2 rounded text-white/70">{d.google_keywords.join(", ")}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 border border-[#00d4ff]/20 rounded bg-[#00d4ff]/5 text-xs text-white/70">
        <div className="font-bold text-[#00d4ff] mb-1">⚙️ Phase 2 — Auto-launch on Meta</div>
        <p>To enable one-click auto-launch (instead of paste-ready copy), add these secrets to Lovable Cloud:</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li><code>META_AD_ACCESS_TOKEN</code> — System User token from Business Manager</li>
          <li><code>META_AD_ACCOUNT_ID</code> — your ad account ID (format: <code>act_123456789</code>)</li>
          <li><code>META_PAGE_ID</code> — already set</li>
        </ul>
        <p className="mt-1">Once added, "🚀 Launch" creates a PAUSED campaign in Ads Manager so you review before activating.</p>
      </div>
    </div>
  );
}

function Field({ label, value, onCopy, multiline }: { label: string; value: string | null; onCopy: (t: string, l: string) => void; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className="bg-black/30 p-2 rounded">
      <div className="flex justify-between items-start mb-1">
        <span className="text-white/50 text-[10px] uppercase tracking-wider">{label}</span>
        <button onClick={() => onCopy(value, label)} className="text-[#00d4ff] text-[10px] shrink-0 ml-2">copy</button>
      </div>
      <div className={`text-white/90 ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>{value}</div>
    </div>
  );
}
