import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Target, Users, FileText, Send, AlertTriangle, CheckCircle2, Flame, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Pane = "targeting" | "contacts" | "drafts" | "send";

interface Buyer {
  buyer_id: string;
  company_name: string;
  city: string | null;
  vertical: string | null;
  bis: number;
  breakdown?: Record<string, number>;
  miles?: number;
}

interface Contact {
  id: string;
  buyer_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  email_verified: boolean;
  email_source: string | null;
  email_confidence: number;
  selected: boolean;
}

interface Draft {
  contact_id: string;
  recipient_email: string;
  recipient_name: string | null;
  buyer_company: string;
  subject: string;
  body: string;
  spam_score?: number;
  blocked?: string[];
  warnings?: string[];
  loading?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signalId: string | null;
  signalCompanyName?: string;
}

const TONE_OPTIONS = ["professional", "direct", "curious"] as const;

export default function ColdEmailEngineDialog({ open, onOpenChange, signalId, signalCompanyName }: Props) {
  const [pane, setPane] = useState<Pane>("targeting");
  const [topN, setTopN] = useState(10);
  const [maxMiles, setMaxMiles] = useState(60);
  const [vertical, setVertical] = useState<string>("");
  const [tone, setTone] = useState<typeof TONE_OPTIONS[number]>("professional");

  const [ranking, setRanking] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [enriching, setEnriching] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);

  // reset on close / signal change
  useEffect(() => {
    if (!open) {
      setPane("targeting");
      setBuyers([]); setContacts([]); setDrafts([]);
    }
  }, [open, signalId]);

  const rankBuyers = useCallback(async () => {
    if (!signalId) return;
    setRanking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cold-email-rank-buyers", {
        body: { signal_id: signalId, top_n: topN, max_miles: maxMiles, vertical: vertical || undefined },
      });
      if (error) throw new Error(error.message);
      const list: Buyer[] = (data?.buyers || []).map((b: any) => ({
        buyer_id: b.buyer_id, company_name: b.company_name,
        city: b.city, vertical: b.vertical,
        bis: b.bis ?? b.score ?? 0,
        breakdown: b.breakdown, miles: b.miles,
      }));
      setBuyers(list);
      if (list.length === 0) toast.warning("No matching buyers — widen radius or change vertical");
      else { setPane("contacts"); toast.success(`Ranked ${list.length} buyers`); }
    } catch (e: any) {
      toast.error(`Ranking failed: ${e.message}`);
    } finally { setRanking(false); }
  }, [signalId, topN, maxMiles, vertical]);

  const enrichOne = useCallback(async (b: Buyer) => {
    setEnriching(prev => new Set(prev).add(b.buyer_id));
    try {
      const { data, error } = await supabase.functions.invoke("buyer-contact-enrich", {
        body: { buyer_id: b.buyer_id, max_contacts: 3 },
      });
      if (error) throw new Error(error.message);
      const newContacts: Contact[] = (data?.contacts || []).map((c: any) => ({
        id: c.id, buyer_id: b.buyer_id,
        full_name: c.full_name, title: c.title,
        email: c.email, email_verified: !!c.email_verified,
        email_source: c.email_source, email_confidence: c.email_confidence ?? 0,
        selected: !!c.email,
      }));
      setContacts(prev => [...prev.filter(x => x.buyer_id !== b.buyer_id), ...newContacts]);
      if (newContacts.length === 0) toast.message(`No contacts found for ${b.company_name}`);
    } catch (e: any) {
      toast.error(`Enrich ${b.company_name}: ${e.message}`);
    } finally {
      setEnriching(prev => { const n = new Set(prev); n.delete(b.buyer_id); return n; });
    }
  }, []);

  const enrichAll = useCallback(async () => {
    // Parallelize in chunks of 4 to respect API budgets
    const chunks: Buyer[][] = [];
    for (let i = 0; i < buyers.length; i += 4) chunks.push(buyers.slice(i, i + 4));
    for (const chunk of chunks) await Promise.all(chunk.map(enrichOne));
    toast.success("Contact enrichment complete");
  }, [buyers, enrichOne]);

  const generateDrafts = useCallback(async () => {
    if (!signalId) return;
    const selected = contacts.filter(c => c.selected && c.email);
    if (selected.length === 0) { toast.error("Select contacts with emails first"); return; }

    const initial: Draft[] = selected.map(c => {
      const b = buyers.find(x => x.buyer_id === c.buyer_id);
      return {
        contact_id: c.id, recipient_email: c.email!, recipient_name: c.full_name,
        buyer_company: b?.company_name || "Branch", subject: "", body: "", loading: true,
      };
    });
    setDrafts(initial);
    setPane("drafts");

    // Pick arms once via bandit
    let arms: any = null;
    try {
      const r = await supabase.functions.invoke("cold-email-bandit-pick", { body: { vertical: "default", n: 1 } });
      arms = (r.data as any)?.picks?.[0];
    } catch { /* fallback below */ }
    if (!arms) arms = { subject: "name_drop_signal", opener: "direct", cta: "free_dossier" };

    // Generate in parallel chunks of 3
    const updated: Draft[] = [...initial];
    const chunks: number[][] = [];
    for (let i = 0; i < selected.length; i += 3) chunks.push([...Array(Math.min(3, selected.length - i))].map((_, k) => i + k));

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (idx) => {
        const c = selected[idx];
        try {
          const [genRes, qgRes] = await Promise.all([
            supabase.functions.invoke("cold-email-generate-row", {
              body: { signal_id: signalId, buyer_id: c.buyer_id, contact_id: c.id, arms, tone },
            }),
            supabase.functions.invoke("cold-email-quality-gate", {
              body: { recipient_email: c.email, subject: "preview check", body: "preview body for gate", signal_id: signalId, contact_id: c.id },
            }),
          ]);
          const g: any = genRes.data || {};
          const q: any = qgRes.data || {};
          updated[idx] = {
            ...updated[idx],
            subject: g.subject || "(generation failed)",
            body: g.body || "",
            spam_score: q.spam_score,
            blocked: q.allow ? [] : (q.reasons || []),
            warnings: q.warnings || [],
            loading: false,
          };
          setDrafts([...updated]);
        } catch (e: any) {
          updated[idx] = { ...updated[idx], subject: "(error)", body: e.message, loading: false };
          setDrafts([...updated]);
        }
      }));
    }
    toast.success(`${selected.length} drafts ready — review before sending`);
  }, [signalId, contacts, buyers, tone]);

  const sendBatch = useCallback(async () => {
    if (!signalId) return;
    const sendable = drafts.filter(d => !d.blocked || d.blocked.length === 0);
    if (sendable.length === 0) { toast.error("All drafts blocked by quality gate"); return; }
    setSending(true);
    try {
      const sends = sendable.map(d => {
        const c = contacts.find(x => x.id === d.contact_id);
        return {
          buyer_id: c?.buyer_id, contact_id: d.contact_id,
          recipient_email: d.recipient_email, recipient_name: d.recipient_name,
        };
      });
      const { data, error } = await supabase.functions.invoke("cold-email-bulk-queue", {
        body: { signal_id: signalId, sends, delay_minutes: 10, tone },
      });
      if (error) throw new Error(error.message);
      const queued = data?.queued ?? 0;
      const skipped = data?.skipped ?? 0;
      toast.success(`Queued ${queued} (${skipped} skipped). 10-min ghost-delay — text Matt to cancel.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Send failed: ${e.message}`);
    } finally { setSending(false); }
  }, [signalId, drafts, contacts, tone, onOpenChange]);

  const selectedCount = contacts.filter(c => c.selected && c.email).length;
  const sendableCount = drafts.filter(d => !d.blocked || d.blocked.length === 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Flame className="w-5 h-5 text-orange-500" />
            Cold-Email Engine v3 · Demand Heat Sniper
            {signalCompanyName && <span className="text-sm font-normal text-zinc-400 ml-2">→ {signalCompanyName}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Pane tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800 -mx-6 px-6 pb-0">
          {(["targeting", "contacts", "drafts", "send"] as Pane[]).map((p, i) => {
            const active = pane === p;
            const icons = [Target, Users, FileText, Send];
            const Icon = icons[i];
            return (
              <button key={p} onClick={() => setPane(p)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  active ? "border-cyan-400 text-cyan-300" : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {i + 1}. {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 py-4">
          {pane === "targeting" && (
            <div className="space-y-4 max-w-xl">
              <p className="text-sm text-zinc-400">
                Score every buyer in your network on the 7-component Buyer Intent Score (BIS) for this signal.
                Geo, vertical fit, recency, deliverability, seniority, spend window, past lift.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400">
                  Top N buyers
                  <Input type="number" min={1} max={50} value={topN} onChange={e => setTopN(Number(e.target.value))} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
                </label>
                <label className="text-xs text-zinc-400">
                  Max distance (miles)
                  <Input type="number" min={5} max={500} value={maxMiles} onChange={e => setMaxMiles(Number(e.target.value))} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
                </label>
                <label className="text-xs text-zinc-400 col-span-2">
                  Force vertical (optional)
                  <Input placeholder="hvac · electrical · plumbing · welding_cnc · building_materials" value={vertical} onChange={e => setVertical(e.target.value)} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
                </label>
              </div>
              <Button onClick={rankBuyers} disabled={ranking || !signalId} className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold">
                {ranking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                Rank buyers
              </Button>
            </div>
          )}

          {pane === "contacts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{buyers.length} buyers · {contacts.length} contacts loaded · {selectedCount} selected</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={enrichAll} disabled={buyers.length === 0 || enriching.size > 0} className="border-zinc-700 text-zinc-300">
                    {enriching.size > 0 ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Users className="w-3 h-3 mr-1" />}
                    Enrich all ({buyers.length})
                  </Button>
                  <Button size="sm" onClick={generateDrafts} disabled={selectedCount === 0} className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950">
                    Generate drafts ({selectedCount})
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {buyers.map(b => {
                  const buyerContacts = contacts.filter(c => c.buyer_id === b.buyer_id);
                  const isEnriching = enriching.has(b.buyer_id);
                  return (
                    <div key={b.buyer_id} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{b.company_name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {b.city || "—"} · {b.vertical || "—"} {b.miles != null && `· ${b.miles.toFixed(1)} mi`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${b.bis >= 70 ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : b.bis >= 50 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-zinc-700/40 text-zinc-300 border-zinc-600"}`}>
                            BIS {Math.round(b.bis)}
                          </Badge>
                          {buyerContacts.length === 0 && (
                            <Button size="sm" variant="outline" onClick={() => enrichOne(b)} disabled={isEnriching} className="border-zinc-700 h-7 text-xs">
                              {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Enrich"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {buyerContacts.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-zinc-800 space-y-1.5">
                          {buyerContacts.map(c => (
                            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-800/50 -mx-1 px-1 py-1 rounded">
                              <input type="checkbox" checked={c.selected} disabled={!c.email}
                                onChange={e => setContacts(prev => prev.map(x => x.id === c.id ? { ...x, selected: e.target.checked } : x))}
                                className="accent-cyan-500" />
                              <span className="text-zinc-200">{c.full_name}</span>
                              <span className="text-zinc-500">{c.title || ""}</span>
                              <span className="ml-auto flex items-center gap-2">
                                {c.email ? (
                                  <span className="text-zinc-400">{c.email}</span>
                                ) : (
                                  <span className="text-red-400/70">no email</span>
                                )}
                                {c.email_verified && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                                <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-500">
                                  {c.email_source || "?"} · {c.email_confidence}%
                                </Badge>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pane === "drafts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{drafts.length} drafts · {sendableCount} pass quality gate · tone: {tone}</p>
                <div className="flex gap-2 items-center">
                  <select value={tone} onChange={e => setTone(e.target.value as any)} className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1">
                    {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button size="sm" variant="outline" onClick={generateDrafts} className="border-zinc-700 text-zinc-300">Regenerate</Button>
                  <Button size="sm" onClick={() => setPane("send")} disabled={sendableCount === 0} className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950">
                    Review send →
                  </Button>
                </div>
              </div>
              {drafts.map((d, i) => (
                <div key={d.contact_id} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs">
                      <span className="text-white font-medium">{d.recipient_name}</span>
                      <span className="text-zinc-500"> · {d.recipient_email} · {d.buyer_company}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {typeof d.spam_score === "number" && (
                        <Badge className={`text-[10px] ${d.spam_score >= 6 ? "bg-red-500/20 text-red-300 border-red-500/40" : d.spam_score >= 3 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-green-500/20 text-green-300 border-green-500/40"}`}>
                          spam {d.spam_score}
                        </Badge>
                      )}
                      {d.blocked && d.blocked.length > 0 && (
                        <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/40">
                          <AlertTriangle className="w-3 h-3 mr-1" /> blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                  {d.loading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-3 h-3 animate-spin" /> Generating…</div>
                  ) : (
                    <>
                      <Input value={d.subject} onChange={e => setDrafts(prev => prev.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))}
                        className="mb-2 bg-zinc-950 border-zinc-700 text-white text-sm" placeholder="Subject" />
                      <Textarea value={d.body} onChange={e => setDrafts(prev => prev.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                        className="bg-zinc-950 border-zinc-700 text-white text-xs min-h-[140px]" />
                      {d.blocked && d.blocked.length > 0 && (
                        <p className="text-[10px] text-red-400/80 mt-1">Blocked: {d.blocked.join("; ")}</p>
                      )}
                      {d.warnings && d.warnings.length > 0 && (
                        <p className="text-[10px] text-amber-400/80 mt-1">Warnings: {d.warnings.join("; ")}</p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {pane === "send" && (
            <div className="space-y-4 max-w-xl">
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-medium text-sm">
                  <Shield className="w-4 h-4" /> Pre-flight summary
                </div>
                <ul className="text-xs text-zinc-300 space-y-1">
                  <li>• {sendableCount} of {drafts.length} drafts will be queued</li>
                  <li>• Each carries a public dossier-share link with view tracking</li>
                  <li>• 10-minute ghost-delay window — text Matt "STOP-{(signalId || "").slice(0, 8)}" to cancel all</li>
                  <li>• Per-domain throttle: max 2 sends per recipient domain in 24h</li>
                  <li>• Bandit will record outcomes to refine future arm selection</li>
                </ul>
              </div>
              <Button onClick={sendBatch} disabled={sending || sendableCount === 0} className="bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold w-full">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Queue {sendableCount} cold emails
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
