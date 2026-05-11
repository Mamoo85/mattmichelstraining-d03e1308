import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Wand2, Mail, Target, X, CheckCircle2, Send, Sparkles, AlertCircle } from "lucide-react";
import SendDJConleyProposalCard from "@/components/admin/SendDJConleyProposalCard";

const METRO_DETROIT_AGENCIES = [
  { name: "Qualified Staffing", contact: "Director of Recruiting", vertical: "industrial", note: "Troy, MI · CNC, machinist, light industrial placements since 1993", domain: "qualified-staffing.com", role_hint: "director" },
  { name: "Acro Service Corp", contact: "VP of Technical Staffing", vertical: "industrial", note: "Livonia, MI · Engineering + skilled trades, heavy automotive focus", domain: "acrocorp.com", role_hint: "vp" },
  { name: "Express Employment Pros — Troy", contact: "Branch Manager", vertical: "industrial", note: "Troy, MI franchise · High-volume light industrial + machinist", domain: "expresspros.com", role_hint: "branch" },
  { name: "ASG Renaissance", contact: "Director of Recruiting", vertical: "industrial", note: "Southfield, MI · Engineering + technical, Detroit automotive ecosystem", domain: "asgrenaissance.com", role_hint: "director" },
  { name: "Staffing Solutions Enterprises", contact: "Branch Manager", vertical: "industrial", note: "Auburn Hills, MI · General + light industrial, multi-county MI coverage", domain: "sse.net", role_hint: "branch" },
  { name: "PrideStaff Detroit", contact: "Strategic Partner", vertical: "industrial", note: "Detroit franchise · Mid-market skilled trades + office placements", domain: "pridestaff.com", role_hint: "branch" },
  { name: "Favorite Healthcare Staffing", contact: "Branch Director", vertical: "healthcare", note: "Metro Detroit · LTC + skilled nursing, active Michigan branch", domain: "favoritestaffing.com", role_hint: "branch" },
  { name: "Delta T Group", contact: "Regional Director", vertical: "healthcare", note: "Metro Detroit · Behavioral health + human services staffing, MI region", domain: "deltatgroup.com", role_hint: "director" },
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
  const [hiringDemand, setHiringDemand] = useState<Record<string, any[]>>({ industrial: [], healthcare: [] });
  const [windowUsed, setWindowUsed] = useState<Record<string, string>>({ industrial: "—", healthcare: "—" });
  const [loadingCands, setLoadingCands] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [blasting, setBlasting] = useState<string | null>(null);
  const [blastResults, setBlastResults] = useState<Record<string, { count: number; sentAt: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftPayload>>({});
  const [enrichments, setEnrichments] = useState<Record<string, ContactEnrichment>>({});
  const [pickedFor, setPickedFor] = useState<Record<string, string | null>>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<Record<string, "html" | "plain">>({});

  useEffect(() => {
    loadProspectPool();
    loadEnrichments();
  }, []);

  const loadProspectPool = async () => {
    setLoadingCands(true);
    try {
      const [indRes, hcRes] = await Promise.all([
        supabase.functions.invoke("agency-prospect-pool", { body: { vertical: "industrial" } }),
        supabase.functions.invoke("agency-prospect-pool", { body: { vertical: "healthcare" } }),
      ]);
      const ind = (indRes.data as any) || {};
      const hc = (hcRes.data as any) || {};
      // Merge candidate lists, dedupe by id
      const merged = new Map<string, any>();
      for (const c of (ind.candidates || [])) merged.set(c.id, c);
      for (const c of (hc.candidates || [])) merged.set(c.id, c);
      setCandidates(Array.from(merged.values()));
      setHiringDemand({
        industrial: ind.hiring_demand || [],
        healthcare: hc.hiring_demand || [],
      });
      setWindowUsed({
        industrial: ind.candidate_window || "none",
        healthcare: hc.candidate_window || "none",
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load prospect pool");
    } finally {
      setLoadingCands(false);
    }
  };

  const refreshPool = async () => {
    toast.info("Refreshing proof pool…");
    await loadProspectPool();
    toast.success("Proof pool refreshed");
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
  const HC_RX = /\b(rn|lpn|cna|nurse|nursing|aide|home\s*health|caregiver|medical|clinical|therapist|hha|healthcare|health|patient)\b/i;
  const IND_RX = /\b(boiler|hvac|electric|plumb|stationary\s+engineer|machinist|welder|fitter|pipefitter|fabricat|cnc|millwright|trades|mechanic|technician|maintenance|operator|industrial|skilled)\b/i;

  const matchingCandidatesFor = (vertical: "industrial" | "healthcare") =>
    candidates.filter(c => {
      const text = `${c.current_title || ""} ${c.trade || ""} ${c.license_type || ""} ${c.qualifications_summary || ""} ${c.current_employer || ""}`;
      const trade = (c.trade || "").toLowerCase();
      if (vertical === "healthcare") return HC_TRADES.has(trade) || HC_RX.test(text);
      return IND_TRADES.has(trade) || IND_RX.test(text);
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

  const blastProspects = async (agency: typeof METRO_DETROIT_AGENCIES[0]) => {
    const enrich = enrichments[agency.name];
    if (!enrich?.contact_email) { toast.error("Enrich the contact first to get their email"); return; }
    if (!confirm(`Send 50-prospect teaser to ${enrich.contact_email}?\n\nThis sends immediately from matt@detroitwebagent.com.`)) return;
    setBlasting(agency.name);
    try {
      const { data, error } = await supabase.functions.invoke("agency-prospect-list-blast", {
        body: {
          agency_name: agency.name,
          agency_email: enrich.contact_email,
          agency_contact_name: enrich.contact_full_name || agency.contact,
          agency_contact_title: enrich.contact_title || agency.contact,
          vertical: agency.vertical,
          agency_note: agency.note,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Blast failed");
      setBlastResults(r => ({ ...r, [agency.name]: { count: data.candidate_count, sentAt: new Date().toLocaleTimeString() } }));
      toast.success(`✓ Sent ${data.candidate_count}-candidate teaser to ${enrich.contact_email}`);
    } catch (e: any) {
      toast.error(e?.message || "Blast failed");
    } finally {
      setBlasting(null);
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
      <SendDJConleyProposalCard />
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-lg mb-2">🎯 Trojan Horse Outreach v2 (Enrich → Opus → Gmail)</h3>
            <p className="text-slate-400 text-sm mb-3">
              1) Cherry-pick a proof candidate · 2) Enrich the agency to find the decision-maker's email · 3) Draft with Opus · 4) One-click send from <code className="text-[#00d4ff]">matt@detroitwebagent.com</code> via Gmail. <strong className="text-amber-300">Manual confirm before every send.</strong>
            </p>
            <p className="text-slate-500 text-xs">
              {loadingCands
                ? "loading proof pool..."
                : `${candidates.length} candidates available · industrial window: ${windowUsed.industrial} · healthcare window: ${windowUsed.healthcare} · hiring-demand backup: ${hiringDemand.industrial.length} industrial companies`}
            </p>
          </div>
          <button
            onClick={refreshPool}
            disabled={loadingCands}
            className="px-3 py-1.5 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {loadingCands ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Refresh Proof Pool
          </button>
        </div>
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
                    <button
                      onClick={() => blastProspects(agency)}
                      disabled={blasting === agency.name || !enrich?.contact_email}
                      title={!enrich?.contact_email ? "Enrich contact first" : `Send 50-candidate teaser to ${enrich.contact_email}`}
                      className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 transition-colors text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {blasting === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      {blastResults[agency.name]
                        ? `✓ Sent ${blastResults[agency.name].count} @ ${blastResults[agency.name].sentAt}`
                        : "🚀 Blast 50 Prospects"}
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
                      <div className="space-y-2 py-2">
                        <p className="text-slate-400 text-xs">
                          No matching person-level candidates yet (window tried: {windowUsed[agency.vertical] || "none"}).
                        </p>
                        {(hiringDemand[agency.vertical] || []).length > 0 ? (
                          <>
                            <p className="text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                              Hiring Demand Backup ({hiringDemand[agency.vertical].length} companies actively hiring)
                            </p>
                            <div className="space-y-1">
                              {hiringDemand[agency.vertical].slice(0, 6).map((h: any) => (
                                <div key={h.id} className="bg-[#0f1f35] border border-amber-500/20 rounded px-3 py-2 text-[11px] flex items-center justify-between">
                                  <div className="min-w-0">
                                    <div className="text-white font-semibold truncate">{h.company_name}</div>
                                    <div className="text-slate-500 truncate">{h.role} · {h.city || "Metro Detroit"} · {h.source_label || "—"}</div>
                                  </div>
                                  <span className="text-amber-300 font-bold ml-2">★ {h.score}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-slate-500 text-[10px] italic">
                              Use these as "demand proof" instead of named candidates — Opus will frame them as "{hiringDemand[agency.vertical].length} {agency.vertical} shops actively hiring this week."
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-500 text-[11px] italic">
                            No hiring-demand backup either. Run the TechAlert hunter (Admin → Outreach → Command Center) or wait for tomorrow's 6am ET scan.
                          </p>
                        )}
                      </div>
                    )}
                    {matchingCandidatesFor(agency.vertical as any).map(c => {
                      const isPicked = pickedFor[agency.name] === c.id;
                      const tier = c.score >= 8 ? "exceptional" : c.score >= 6 ? "strong" : "moderate";
                      const tierColor = c.score >= 8 ? "text-emerald-300" : c.score >= 6 ? "text-[#00d4ff]" : "text-slate-400";
                      const candidateHasContact = !!(c.email || c.phone);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setPickedFor(p => ({ ...p, [agency.name]: isPicked ? null : c.id }));
                            // Option A: if candidate has email/phone and agency has no enrichment yet, seed it
                            if (!isPicked && candidateHasContact && !enrichments[agency.name]?.contact_email) {
                              setEnrichments(prev => ({
                                ...prev,
                                [agency.name]: {
                                  contact_first_name: (c.full_name || c.name || "").split(" ")[0] || null,
                                  contact_last_name: (c.full_name || c.name || "").split(" ").slice(1).join(" ") || null,
                                  contact_full_name: c.full_name || c.name || null,
                                  contact_title: c.current_title || c.trade || null,
                                  contact_email: c.email || null,
                                  email_status: c.email ? "candidate_record" : null,
                                  source: "cherry_pick",
                                  domain: agency.domain || null,
                                },
                              }));
                              if (c.email) toast.success(`Using ${c.full_name || c.name}'s contact — click Draft to continue`);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${isPicked ? "bg-amber-500/10 border-amber-500/40" : "bg-[#0f1f35] border-white/5 hover:border-amber-500/30"}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-semibold truncate">{c.full_name || c.name || "(unnamed)"}</div>
                            <div className="text-slate-500 text-[11px] truncate">{c.current_title || c.trade || "—"} · {c.city || c.metro || "—"}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.current_employer && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-300">employer</span>}
                              {c.email && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-300">email</span>}
                              {c.phone && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300">phone</span>}
                              {c.linkedin_url && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00d4ff]/10 text-[#00d4ff]">linkedin</span>}
                              {!c.current_employer && !c.email && !c.phone && !c.linkedin_url && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-700/30 text-slate-500">name only</span>
                              )}
                            </div>
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

                  <div className="px-4 py-3 border-t border-white/10 flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => sendViaGmail(agency)}
                      disabled={!enrich?.contact_email || sending === agency.name}
                      className="px-4 py-2 rounded-lg bg-[#00d4ff] text-[#0a1628] text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00b8e0]"
                      title={!enrich?.contact_email ? "Enrichment didn't return an email — paste one manually below to enable Send" : "Send from matt@detroitwebagent.com"}
                    >
                      {sending === agency.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send via Gmail
                    </button>
                    {!enrich?.contact_email && (
                      <input
                        type="email"
                        placeholder="Add email manually…"
                        defaultValue=""
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (!v) return;
                          setEnrichments((prev) => ({
                            ...prev,
                            [agency.name]: {
                              contact_first_name: prev[agency.name]?.contact_first_name ?? null,
                              contact_last_name: prev[agency.name]?.contact_last_name ?? null,
                              contact_title: prev[agency.name]?.contact_title ?? null,
                              email_status: prev[agency.name]?.email_status ?? null,
                              source: prev[agency.name]?.source ?? "manual",
                              domain: prev[agency.name]?.domain ?? null,
                              contact_email: v,
                              contact_full_name: prev[agency.name]?.contact_full_name ?? agency.contact ?? null,
                            },
                          }));
                          toast.success("Email saved for this session");
                        }}
                        className="px-3 py-2 rounded-lg bg-[#0a1628] border border-amber-500/40 text-amber-200 text-xs w-56"
                      />
                    )}
                    <button onClick={() => copyHtml(agency.name)} className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00d4ff]/40">
                      <Copy className="w-3 h-3" /> Copy HTML
                    </button>
                    {enrich?.contact_email ? (
                      <a
                        href={`mailto:${enrich.contact_email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.plain_body)}`}
                        className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00d4ff]/40"
                      >
                        <Mail className="w-3 h-3" /> Open in mail
                      </a>
                    ) : (
                      <span
                        title="Add a contact email above to enable"
                        className="px-3 py-2 rounded-lg border border-white/5 text-slate-500 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <Mail className="w-3 h-3" /> No email
                      </span>
                    )}
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
