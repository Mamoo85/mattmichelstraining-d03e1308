import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Eye, Send, Users, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";

const SUBJECT_VARIANTS = [
  "Nothing to lose. 47 local leads waiting in your free trial.",
  "Free trial — no credit card. Real leads in your ZIP this week.",
  "I built you a free dashboard. It already has leads.",
  "You have leads waiting. Trial is free. No card needed.",
];

const VERTICALS = [
  { slug: "roofing", label: "Roofing Radar" },
  { slug: "hvac", label: "HVAC Radar" },
  { slug: "plumbing", label: "Plumbing Radar" },
  { slug: "electrical", label: "Electrical Radar" },
  { slug: "pest_control", label: "Pest Control Radar" },
  { slug: "gutters", label: "Gutters Radar" },
  { slug: "exterior", label: "Exterior Radar" },
  { slug: "tree", label: "Tree Service Radar" },
  { slug: "restoration", label: "Restoration Radar" },
  { slug: "demo_junk", label: "Demo & Junk Radar" },
  { slug: "foundation", label: "Foundation Radar" },
];

interface Recipient {
  email: string;
  business_name?: string | null;
  trade?: string | null;
  city?: string | null;
  state?: string | null;
  last_sent_at?: string | null;
  source: string;
}

function buildEmailHtml(opts: {
  businessName: string;
  trade: string;
  city: string;
  state: string;
  trialUrl: string;
}) {
  const verticalLabel = VERTICALS.find((v) => v.slug === opts.trade)?.label ?? "Trade Radar";
  return `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#0a1628 0%,#0d1d33 100%);padding:32px 28px;text-align:center;">
    <div style="display:inline-block;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.4);color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;margin-bottom:16px;">FREE TRIAL — NO CREDIT CARD</div>
    <h1 style="color:#ffffff;font-size:26px;font-weight:900;margin:0 0 10px;line-height:1.2;">${verticalLabel}: Your Free Dashboard Is Ready</h1>
    <p style="color:#94a3b8;font-size:15px;margin:0;line-height:1.5;">${opts.city ? `Local ${opts.city} leads ` : "Local leads "}— claim before they go to a competitor.</p>
  </div>

  <div style="padding:28px 28px 8px;">
    <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 16px;">Hey${opts.businessName ? ` ${opts.businessName}` : ""},</p>
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">I emailed you a couple weeks ago about Detroit Web Agency's lead radar. <strong>I built you a free trial dashboard.</strong> It's already got real, scored leads in your service area — owner names, addresses, suggested call openers, the works.</p>
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;"><strong style="color:#0f172a;">Nothing to install. No credit card. No catch.</strong> Click the link, see your leads, work them or don't.</p>
  </div>

  <!-- Sample lead preview card -->
  <div style="margin:0 28px 24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fafbfc;">
    <div style="height:4px;background:#ef4444;"></div>
    <div style="padding:16px;">
      <div style="display:inline-block;background:rgba(0,212,255,0.10);border:1px solid rgba(0,212,255,0.30);color:#0891b2;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:6px;margin-bottom:10px;">📋 Sample Lead — Score 9/10 URGENT</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:2px;">2847 Sample Street</div>
      <div style="font-size:12px;color:#64748b;font-family:monospace;margin-bottom:12px;">${opts.city || "Your City"}, ${opts.state || "MI"}</div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#0891b2;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">What We Found</div>
        <div style="font-size:13px;color:#334155;line-height:1.5;">Permit pulled 4 days ago, $48k contractor cost. Pre-1990 home. Likely needs full ${opts.trade || "trade"} system upgrade.</div>
      </div>
      <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.20);border-radius:8px;padding:10px;">
        <div style="font-size:10px;font-weight:700;color:#0891b2;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Suggested Opener</div>
        <div style="font-size:13px;color:#334155;font-style:italic;">"Saw the permit go through last week — congrats on the project. Quick question on the timeline…"</div>
      </div>
    </div>
  </div>

  <div style="padding:0 28px 24px;text-align:center;">
    <a href="${opts.trialUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-size:16px;font-weight:800;text-decoration:none;padding:16px 32px;border-radius:10px;letter-spacing:0.3px;">Open My Free Dashboard →</a>
    <p style="color:#94a3b8;font-size:12px;margin:12px 0 0;">No credit card. No commitment. Cancel with one click.</p>
  </div>

  <div style="border-top:1px solid #e2e8f0;padding:20px 28px;background:#fafbfc;">
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Reply to this email or text me directly: <a href="tel:+13139921219" style="color:#0891b2;font-weight:700;text-decoration:none;">(313) 992-1219</a></p>
    <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin:0;">— Matt at Detroit Web Agency · <a href="https://detroitwebagent.com" style="color:#0891b2;text-decoration:none;">detroitwebagent.com</a></p>
  </div>
</div>
</body></html>`;
}

export default function TrialReactivationCampaign() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState("hvac");
  const [subjectIdx, setSubjectIdx] = useState(0);
  const [previewName, setPreviewName] = useState("Smith Plumbing");
  const [previewCity, setPreviewCity] = useState("Detroit");
  const [previewState, setPreviewState] = useState("MI");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const threeWeeksAgo = new Date(Date.now() - 21 * 86_400_000).toISOString();
      try {
        // Pull from outreach_leads (cold email recipients) + techalert_prospects
        const [olRes, taRes] = await Promise.all([
          supabase
            .from("outreach_leads" as any)
            .select("owner_email,business_name,trade,city,state,sent_at")
            .gte("sent_at", threeWeeksAgo)
            .not("owner_email", "is", null)
            .limit(500),
          supabase
            .from("techalert_prospects" as any)
            .select("owner_email,company_name,trade,city,state,emailed_at")
            .gte("emailed_at", threeWeeksAgo)
            .not("owner_email", "is", null)
            .limit(500),
        ]);

        const map = new Map<string, Recipient>();
        ((olRes.data ?? []) as any[]).forEach((r) => {
          if (!r.owner_email) return;
          map.set(r.owner_email.toLowerCase(), {
            email: r.owner_email,
            business_name: r.business_name,
            trade: r.trade,
            city: r.city,
            state: r.state,
            last_sent_at: r.sent_at,
            source: "outreach_leads",
          });
        });
        ((taRes.data ?? []) as any[]).forEach((r) => {
          if (!r.owner_email) return;
          const k = r.owner_email.toLowerCase();
          if (!map.has(k)) {
            map.set(k, {
              email: r.owner_email,
              business_name: r.company_name,
              trade: r.trade,
              city: r.city,
              state: r.state,
              last_sent_at: r.emailed_at,
              source: "techalert_prospects",
            });
          }
        });
        setRecipients(Array.from(map.values()));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load recipients");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const trialUrl = `https://detroitwebagent.com/start-trial?product=${selectedTrade}_radar`;
  const previewHtml = useMemo(
    () =>
      buildEmailHtml({
        businessName: previewName,
        trade: selectedTrade,
        city: previewCity,
        state: previewState,
        trialUrl,
      }),
    [previewName, selectedTrade, previewCity, previewState, trialUrl]
  );

  const filtered = useMemo(
    () => recipients.filter((r) => !selectedTrade || !r.trade || r.trade.toLowerCase().includes(selectedTrade.replace("_", " ")) || r.trade.toLowerCase() === selectedTrade),
    [recipients, selectedTrade]
  );

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.email)));
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    if (!confirm(`Send reactivation email to ${selected.size} recipient(s)? Each will go through suppression + frequency cap checks.`)) return;
    setSending(true);
    setSentCount(0);
    let ok = 0;
    let blocked = 0;
    for (const email of Array.from(selected)) {
      const r = recipients.find((x) => x.email === email);
      if (!r) continue;
      try {
        const { error } = await supabase.functions.invoke("trial-reactivation-send", {
          body: {
            email: r.email,
            business_name: r.business_name ?? "",
            trade: selectedTrade,
            city: r.city ?? "",
            state: r.state ?? "MI",
            subject: SUBJECT_VARIANTS[subjectIdx],
            trial_url: trialUrl,
          },
        });
        if (error) blocked++;
        else ok++;
      } catch {
        blocked++;
      }
      setSentCount((c) => c + 1);
    }
    setSending(false);
    toast.success(`Sent ${ok}, blocked/failed ${blocked}`);
    setSelected(new Set());
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead title="Trial Reactivation Campaign | DWA Admin" description="Re-email cold leads with new free trial offer" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#00d4ff]" />
          <h1 className="text-2xl sm:text-3xl font-black">Trial Reactivation Campaign</h1>
        </div>
        <p className="text-white/60 text-sm">Re-email everyone we cold-emailed in the last 3 weeks with the new free-trial-first offer. Every send goes through suppression list, frequency caps, and bounce/reply exclusion.</p>

        <Card className="bg-amber-500/5 border-amber-500/30 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            <strong>Manual approval required.</strong> Selecting + clicking Send invokes <code className="text-xs bg-black/40 px-1 rounded">trial-reactivation-send</code>, which checks suppression/blocklist before each send. No bulk blast — one-by-one with auditing.
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT: Controls + Recipients */}
          <div className="space-y-5">
            <Card className="bg-[#0d1d33] border-white/10 p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#00d4ff]">Campaign Setup</h2>

              <div>
                <Label className="text-[11px] uppercase tracking-widest text-white/60">Trade Vertical</Label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="mt-1 w-full bg-[#0a1628] border border-white/10 text-white rounded-md px-3 py-2 text-sm"
                >
                  {VERTICALS.map((v) => (
                    <option key={v.slug} value={v.slug}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-widest text-white/60">Subject Line</Label>
                <div className="space-y-2 mt-1">
                  {SUBJECT_VARIANTS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSubjectIdx(i)}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition ${
                        subjectIdx === i ? "border-[#00d4ff] bg-[#00d4ff]/10 text-white" : "border-white/10 bg-[#0a1628] text-white/70 hover:border-white/30"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-widest text-white/60">Preview: Business</Label>
                  <Input value={previewName} onChange={(e) => setPreviewName(e.target.value)} className="bg-[#0a1628] border-white/10 mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-widest text-white/60">Preview: City</Label>
                  <Input value={previewCity} onChange={(e) => setPreviewCity(e.target.value)} className="bg-[#0a1628] border-white/10 mt-1" />
                </div>
              </div>
            </Card>

            <Card className="bg-[#0d1d33] border-white/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[#00d4ff] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Recipients (last 3 weeks)
                </h2>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span>{filtered.length} eligible</span>
                  <span>·</span>
                  <span className="text-[#00d4ff] font-bold">{selected.size} selected</span>
                </div>
              </div>
              {loading ? (
                <div className="text-white/50 text-sm py-8 text-center">Loading recipients…</div>
              ) : filtered.length === 0 ? (
                <div className="text-white/50 text-sm py-8 text-center">No recipients found in the last 21 days.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={toggleAll} className="text-xs text-[#00d4ff] hover:underline">
                      {selected.size === filtered.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-white/10 rounded-md divide-y divide-white/5">
                    {filtered.map((r) => (
                      <label key={r.email} className="flex items-center gap-3 px-3 py-2 hover:bg-white/3 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(r.email)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.email);
                            else next.delete(r.email);
                            setSelected(next);
                          }}
                          className="accent-[#00d4ff]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-white truncate">{r.business_name ?? r.email}</div>
                          <div className="text-[11px] text-white/40 font-mono truncate">{r.email} · {r.city ?? "—"}, {r.state ?? "—"} · {r.trade ?? "—"}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <Button
                onClick={handleSend}
                disabled={sending || selected.size === 0}
                className="w-full mt-4 bg-[#00d4ff] hover:bg-[#00bde8] text-[#0a1628] font-bold"
              >
                {sending ? (
                  <>Sending {sentCount}/{selected.size}…</>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to {selected.size} recipient{selected.size === 1 ? "" : "s"}
                  </>
                )}
              </Button>
              <p className="text-[10px] text-white/40 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Every send checks suppression + 7-day frequency cap before delivery.
              </p>
            </Card>
          </div>

          {/* RIGHT: Visual Preview */}
          <div className="space-y-3">
            <Card className="bg-[#0d1d33] border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[#00d4ff] flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Visual Preview
                </h2>
                <span className="text-[10px] text-white/40 font-mono">renders in recipient inbox</span>
              </div>
              <div className="border border-white/10 rounded-md overflow-hidden bg-white">
                <div className="bg-[#1a2942] text-white/80 px-4 py-2 text-xs flex items-center gap-2 border-b border-white/10">
                  <Mail className="w-3.5 h-3.5 text-[#00d4ff]" />
                  <span className="font-mono">From:</span>
                  <span className="text-white">matt@detroitwebagent.com</span>
                </div>
                <div className="bg-[#1a2942] text-white/80 px-4 py-2 text-xs border-b border-white/10">
                  <span className="font-mono text-white/50 mr-2">Subject:</span>
                  <span className="text-white font-semibold">{SUBJECT_VARIANTS[subjectIdx]}</span>
                </div>
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  className="w-full h-[700px] bg-white"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
