import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Wand2, Mail, Target, X, CheckCircle2, Send, Sparkles, AlertCircle } from "lucide-react";

const METRO_DETROIT_AGENCIES = [
  { name: "Aerotek", contact: "Director of Recruiting", vertical: "industrial", note: "Largest skilled trades staffing in MI", domain: "aerotek.com", role_hint: "director" },
  { name: "Kelly Industrial", contact: "VP of Recruiting", vertical: "industrial", note: "Manufacturing + skilled trades focus", domain: "kellyservices.com", role_hint: "vp" },
  { name: "Express Employment Pros — Troy", contact: "Branch Manager", vertical: "industrial", note: "High-volume CNC/machinist placements", domain: "expresspros.com", role_hint: "branch" },
  { name: "Manpower Detroit", contact: "Director of Operations", vertical: "industrial", note: "Industrial + healthcare verticals", domain: "manpower.com", role_hint: "director" },
  { name: "PrideStaff Detroit", contact: "Strategic Partner", vertical: "industrial", note: "Mid-market skilled trades", domain: "pridestaff.com", role_hint: "branch" },
  { name: "Maxim Healthcare Staffing", contact: "Director of Recruiting", vertical: "healthcare", note: "RN/CNA/LPN focus, Metro Detroit", domain: "maximhealthcare.com", role_hint: "director" },
  { name: "Cross Country Healthcare", contact: "Regional Director", vertical: "healthcare", note: "Travel + perm placements MI", domain: "crosscountry.com", role_hint: "director" },
  { name: "Favorite Healthcare Staffing", contact: "Branch Director", vertical: "healthcare", note: "LTC + skilled nursing focus", domain: "favoritestaffing.com", role_hint: "branch" },
];

interface DraftPayload {
  subject: string;
  html_body: string;
  plain_body: string;
  cta_label: string;
}

interface ContactEnrichment {
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_full_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  email_status: string | null;
  source: string | null;
  domain: string | null;
}

export default function AdminAgencyOutreach() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCands, setLoadingCands] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftPayload>>({});
  const [enrichments, setEnrichments] = useState<Record<string, ContactEnrichment>>({});
  const [pickedFor, setPickedFor] = useState<Record<string, string | null>>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<Record<string, "html" | "plain">>({});

  useEffect(() => {
    loadCandidates();
    loadEnrichments();
  }, []);

  const loadCandidates = async () => {
    setLoadingCands(true);
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("hire_alert_candidates")
      .select("id, name, full_name, trade, city, metro, score, current_title, qualifications_summary, created_at")
      .eq("is_company_name", false)
      .eq("do_not_contact", false)
      .gte("created_at", since)
      .order("score", { ascending: false })
      .limit(200);
    setCandidates(data || []);
    setLoadingCands(false);
  };

  const loadEnrichments = async () => {
    const { data } = await supabase
      .from("agency_contact_enrichments" as any)
      .select("*")
      .in("agency_name", METRO_DETROIT_AGENCIES.map(a => a.name));
    if (data) {
      const map: Record<string, ContactEnrichment> = {};
      for (const r of data as any[]) map[r.agency_name] = r;
      setEnrichments(map);
    }
  };

  const HC_TRADES = new Set(["nursing", "home_health"]);
  const IND_TRADES = new Set(["boiler", "hvac", "electrical", "plumbing"]);
  const HC_RX = /\b(rn|lpn|cna|nurse|nursing|aide|home\s*health|caregiver|medical|clinical|therapist|hha)\b/;
  const IND_RX = /\b(boiler|hvac|electric|plumb|stationary\s+engineer|machinist|welder|fitter|pipefitter|fabricat|cnc|millwright)\b/;

  const matchingCandidatesFor = (vertical: "industrial" | "healthcare") =>
    candidates.filter(c => {
      const title = `${c.current_title || ""} ${c.trade || ""}`.toLowerCase();
      const trade = (c.trade || "").toLowerCase();
      if (vertical === "healthcare") return HC_TRADES.has(trade) || HC_RX.test(title);
      return IND_TRADES.has(trade) || IND_RX.test(title);
    });

  const enrichContact = async (agency: typeof METRO_DETROIT_AGENCIES[0], force = false) => {
    setEnriching(agency.name);
    try {
      const { data, error } = await supabase.functions.invoke("agency-contact-enrich", {
        body: { agency_name: agency.name, role_hint: agency.role_hint, domain: agency.domain, force },
      });
      if (error) throw error;
      if (!data?.contact?.contact_email) {
        toast.error(`No contact found for ${agency.name}. Try again or draft anyway.`);
        return;
      }
      setEnrichments(e => ({ ...e, [agency.name]: data.contact }));
      const tag = data.cached ? "cached" : data.contact.source;
      toast.success(`Found: ${data.contact.contact_full_name || data.contact.contact_email} (${tag})`);
    } catch (e: any) {
      toast.error(e?.message || "Enrichment failed");
    } finally {
      setEnriching(null);
    }
  };

  const draftEmail = async (agency: typeof METRO_DETROIT_AGENCIES[0]) => {
    setDrafting(agency.name);
    try {
      const pickedId = pickedFor[agency.name];
      const matchPool = matchingCandidatesFor(agency.vertical as any);
      const cherryPicked = pickedId ? matchPool.filter(c => c.id === pickedId) : [];
      const restMatches = matchPool.filter(c => c.id !== pickedId).slice(0, 2);
      const finalList = [...cherryPicked, ...restMatches].slice(0, 3);

      const matchingCands = finalList.map(c => ({
        name: c.full_name || c.name,
        licensed_role: c.current_title || c.trade,
        county: c.city || c.metro,
        signal_strength: c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate",
      }));

      const enrich = enrichments[agency.name];

      const { data, error } = await supabase.functions.invoke("agency-outreach-draft", {
        body: {
          agency_name: agency.name,
          contact_name: agency.contact,
          contact_first_name: enrich?.contact_first_name || null,
          contact_last_name: enrich?.contact_last_name || null,
          contact_title: enrich?.contact_title || null,
          vertical: agency.vertical,
          recent_candidates: matchingCands,
          cherry_picked: !!pickedId,
        },
      });
      if (error) throw error;
      if (!data?.html_body) throw new Error("Draft missing HTML body");
      setDrafts(d => ({ ...d, [agency.name]: { subject: data.subject, html_body: data.html_body, plain_body: data.plain_body, cta_label: data.cta_label } }));
      setPreviewMode(p => ({ ...p, [agency.name]: "html" }));
      toast.success(pickedId ? "Cherry-picked draft ready" : "Draft ready");
    } catch (e: any) {
      toast.error(e?.message || "Draft failed");
    } finally {
      setDrafting(null);
    }
  };

  const sendViaGmail = async (agency: typeof METRO_DETROIT_AGENCIES[0]) => {
    const enrich = enrichments[agency.name];
    const draft = drafts[agency.name];
    if (!enrich?.contact_email) { toast.error("Enrich the contact first"); return; }
    if (!draft) { toast.error("Draft the email first"); return; }
    if (!confirm(`Send this email to ${enrich.contact_email} from matt@detroitwebagent.com via Gmail?`)) return;

    setSending(agency.name);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-send-outreach", {
        body: {
          to: enrich.contact_email,
          to_name: enrich.contact_full_name,
          subject: draft.subject,
          html_body: draft.html_body,
          plain_body: draft.plain_body,
          agency_name: agency.name,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Send failed");
      toast.success(`✓ Sent to ${enrich.contact_email}`);
    } catch (e: any) {
      toast.error(e?.message || "Gmail send failed");
    } finally {
      setSending(null);
    }
  };

  const copyHtml = (agencyName: string) => {
    const d = drafts[agencyName];
    if (!d) return;
    navigator.clipboard.writeText(d.html_body);
    toast.success("HTML copied");
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-bold text-lg mb-2">🎯 Trojan Horse Outreach v2 (Enrich → Opus → Gmail)</h3>
        <p className="text-slate-400 text-sm mb-3">
          1) Cherry-pick a proof candidate · 2) Enrich the agency to find the decision-maker's email · 3) Draft with Opus · 4) One-click send from <code className="text-[#00d4ff]">matt@detroitwebagent.com</code> via Gmail. <strong className="text-amber-300">Manual confirm before every send.</strong>
        </p>
        <p className="text-slate-500 text-xs">
          Last 7d: {loadingCands ? "loading..." : `${candidates.length} candidates available for matching`}
        </p>
      </div>

      <div className="grid gap-4">
        {METRO_DETROIT_AGENCIES.map(agency => {
          const enrich = enrichments[agency.name];
          const draft = drafts[agency.name];
          const mode = previewMode[agency.name] || "html";
          const emailStatusColor = enrich?.email_status === "verified" ? "text-emerald-300" : enrich?.email_status === "guessed" ? "text-amber-300" : "text-slate-400";

          return (
            <div key={agency.name} className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-bold">{agency.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${agency.vertical === "healthcare" ? "bg-pink-500/20 text-pink-300" : "bg-[#00d4ff]/20 text-[#00d4ff]"}`}>
                      {agency.vertical}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{agency.contact} · {agency.note}</p>

                  {/* Status chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {pickedFor[agency.name] && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        ✓ Cherry-picked
                      </span>
                    )}
                    {enrich?.contact_email ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded bg-[#0a1628] border border-white/10 ${emailStatusColor}`}>
                        ✓ {enrich.contact_full_name || "(no name)"} · {enrich.contact_email} · {enrich.source} · {enrich.email_status}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/30 text-slate-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Not enriched
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => setShowPicker(showPicker === agency.name ? null : agency.name)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                        pickedFor[agency.name]
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                          : "bg-[#0a1628] border-white/10 text-slate-400 hover:border-amber-500/40 hover:text-amber-300"
                      }`}
                    >
                      <Target className="w-3 h-3" />
                      {pickedFor[agency.name] ? "Picked ✓" : "Cherry-Pick"}
                    </button>
                    <button
                      onClick={() => enrichContact(agency, !!enrich)}
                      disabled={enriching === agency.name}
                      className="px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-colors text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {enriching === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {enrich ? "Re-enrich" : "Enrich Contact"}
                    </button>
                    <button
                      onClick={() => draftEmail(agency)}
                      disabled={drafting === agency.name}
                      className="px-3 py-1.5 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {drafting === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      Draft with Opus
                    </button>
                  </div>
                </div>
              </div>

              {/* Cherry-pick selector */}
              {showPicker === agency.name && (
                <div className="mt-3 bg-[#0a1628] border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-amber-300 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <Target className="w-3 h-3" /> Cherry-Pick Proof Candidate
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">Pick the strongest match — the first impression decides.</p>
                    </div>
                    <button onClick={() => setShowPicker(null)} className="text-slate-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {matchingCandidatesFor(agency.vertical as any).length === 0 && (
                      <p className="text-slate-500 text-xs text-center py-4">No matching candidates in last 7 days.</p>
                    )}
                    {matchingCandidatesFor(agency.vertical as any).map(c => {
                      const isPicked = pickedFor[agency.name] === c.id;
                      const tier = c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate";
                      const tierColor = c.score >= 8 ? "text-emerald-300" : c.score >= 6 ? "text-[#00d4ff]" : "text-slate-400";
                      return (
                        <button
                          key={c.id}
                          onClick={() => setPickedFor(p => ({ ...p, [agency.name]: isPicked ? null : c.id }))}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${isPicked ? "bg-amber-500/10 border-amber-500/40" : "bg-[#0f1f35] border-white/5 hover:border-amber-500/30"}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold truncate">{c.full_name || c.name || "(unnamed)"}</div>
                            <div className="text-slate-500 text-[11px] truncate">{c.current_title || c.trade || "—"} · {c.city || c.metro || "—"}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`text-[10px] uppercase tracking-wider font-bold ${tierColor}`}>{tier}</span>
                            {isPicked && <CheckCircle2 className="w-4 h-4 text-amber-300" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Draft preview */}
              {draft && (
                <div className="mt-4 bg-[#0a1628] border border-white/10 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Subject</div>
                      <div className="text-white text-sm truncate">{draft.subject}</div>
                    </div>
                    <div className="flex gap-1 bg-[#0f1f35] rounded-lg p-0.5">
                      <button
                        onClick={() => setPreviewMode(p => ({ ...p, [agency.name]: "html" }))}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold ${mode === "html" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-slate-500"}`}
                      >HTML</button>
                      <button
                        onClick={() => setPreviewMode(p => ({ ...p, [agency.name]: "plain" }))}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold ${mode === "plain" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-slate-500"}`}
                      >Plain</button>
                    </div>
                  </div>

                  {mode === "html" ? (
                    <iframe
                      title={`preview-${agency.name}`}
                      srcDoc={draft.html_body}
                      sandbox="allow-same-origin"
                      className="w-full bg-white border-0"
                      style={{ height: 540 }}
                    />
                  ) : (
                    <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed p-4 max-h-[540px] overflow-y-auto">{draft.plain_body}</pre>
                  )}

                  <div className="px-4 py-3 border-t border-white/10 flex gap-2 flex-wrap">
                    <button
                      onClick={() => sendViaGmail(agency)}
                      disabled={!enrich?.contact_email || sending === agency.name}
                      className="px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00b8e0]"
                      title={!enrich?.contact_email ? "Enrich the contact first" : "Send from matt@detroitwebagent.com"}
                    >
                      {sending === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send via Gmail
                    </button>
                    <button onClick={() => copyHtml(agency.name)} className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00d4ff]/40">
                      <Copy className="w-3 h-3" /> Copy HTML
                    </button>
                    <a
                      href={`mailto:${enrich?.contact_email || ""}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.plain_body)}`}
                      className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00d4ff]/40"
                    >
                      <Mail className="w-3 h-3" /> Open in mail
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
