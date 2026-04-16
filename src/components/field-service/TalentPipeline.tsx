import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Phone, MapPin, Star, Lock, Clock, ArrowRight, Download, Search, ChevronDown, Copy, MessageSquare, Mail, X, CheckCircle2, ExternalLink } from "lucide-react";

interface Candidate {
  id: string;
  full_name: string;
  license_type: string;
  license_number: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  availability_score: number;
  score_reason: string | null;
  source: string | null;
  client_action: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  tcpa_notice: string;
  created_at: string;
}

interface Props {
  token: string;
  clientId?: string;
}

const ACCENT = "#00d4ff";

export default function TalentPipeline({ token }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "claimed" | "contacted" | "hired" | "passed">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "date" | "name">("score");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [outreachCandidate, setOutreachCandidate] = useState<Candidate | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const isDemo = token === "demo" || token === "DWA_DEMO_MASTER";

  // Demo seed candidates — realistic data for prospect demos
  const DEMO_CANDIDATES: Candidate[] = [
    { id: "demo-1", full_name: "Marcus Johnson", license_type: "HVAC Journeyman", license_number: "JM-48291", location: "Royal Oak, MI", phone: "(248) 555-0147", email: "m.johnson@email.com", availability_score: 9, score_reason: "License renewed 2 weeks ago, updated Indeed profile, open to offers", source: "LARA + Indeed", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "demo-2", full_name: "David Chen", license_type: "Master Plumber", license_number: "MP-33107", location: "Southfield, MI", phone: "(313) 555-0293", email: "d.chen@email.com", availability_score: 8, score_reason: "New master license issued 3 days ago, no current employer listed", source: "LARA", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: "demo-3", full_name: "Sarah Williams", license_type: "Journeyman Electrician", license_number: "JE-55820", location: "Warren, MI", phone: "(586) 555-0381", email: "s.williams@email.com", availability_score: 8, score_reason: "Updated LinkedIn — 'open to work', 5 years experience", source: "LARA + LinkedIn", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: "demo-4", full_name: "James Rodriguez", license_type: "HVAC Contractor", license_number: "HC-71445", location: "Dearborn, MI", phone: "(313) 555-0512", email: null, availability_score: 7, score_reason: "License transfer filed — leaving current employer", source: "LARA", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 18000000).toISOString() },
    { id: "demo-5", full_name: "Robert Taylor", license_type: "Boiler Operator 1st Class", license_number: "BO-12938", location: "Detroit, MI", phone: "(313) 555-0678", email: "r.taylor@email.com", availability_score: 7, score_reason: "Employer (Beaumont) recently downsized facilities dept", source: "LARA + News", client_action: "contacted", claimed_at: new Date(Date.now() - 86400000).toISOString(), claim_expires_at: new Date(Date.now() + 86400000).toISOString(), tcpa_notice: "Public license record", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "demo-6", full_name: "Angela Martinez", license_type: "CNA", license_number: "CNA-88412", location: "Livonia, MI", phone: "(734) 555-0845", email: "a.martinez@email.com", availability_score: 9, score_reason: "New CNA certification issued yesterday, actively seeking employment", source: "LARA", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 1800000).toISOString() },
    { id: "demo-7", full_name: "Kevin Brown", license_type: "HVAC Journeyman", license_number: "JM-62104", location: "Sterling Heights, MI", phone: "(586) 555-0923", email: null, availability_score: 6, score_reason: "License active, ZipRecruiter profile updated this week", source: "LARA + ZipRecruiter", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 43200000).toISOString() },
    { id: "demo-8", full_name: "Patricia Davis", license_type: "LPN", license_number: "LPN-45291", location: "Troy, MI", phone: "(248) 555-1034", email: "p.davis@email.com", availability_score: 8, score_reason: "Just completed RN bridge program, seeking new position", source: "LARA + Indeed", client_action: null, claimed_at: null, claim_expires_at: null, tcpa_notice: "Public license record", created_at: new Date(Date.now() - 14400000).toISOString() },
  ];

  useEffect(() => {
    fetchCandidates();
    const interval = setInterval(fetchCandidates, 120_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCandidates() {
    if (isDemo) {
      setCandidates(DEMO_CANDIDATES);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/get-my-techalert?token=${token}`, { headers: { apikey } });
      const data = await res.json();
      if (data?.candidates) {
        setCandidates(data.candidates);
      }
    } catch {
      console.error("[TalentPipeline] Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }

  async function claimCandidate(candidateId: string) {
    setClaimingId(candidateId);
    try {
      await fetch(`${baseUrl}/claim-candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey },
        body: JSON.stringify({ token, candidate_id: candidateId }),
      });
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, claimed_at: new Date().toISOString(), claim_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() } : c
      ));
    } catch {
      console.error("Claim failed");
    } finally {
      setClaimingId(null);
    }
  }

  async function updateAction(candidateId: string, action: string) {
    setActionId(candidateId);
    try {
      await fetch(`${baseUrl}/update-candidate-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey },
        body: JSON.stringify({ token, candidate_id: candidateId, action }),
      });
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, client_action: action } : c
      ));
    } catch {
      console.error("Action update failed");
    } finally {
      setActionId(null);
    }
  }

  function generateOutreach(c: Candidate): string {
    const licenseShort = c.license_type.replace(/journeyman /i, "").replace(/master /i, "");
    return `Hi ${c.full_name.split(" ")[0]},

I came across your ${c.license_type} license (${c.license_number || "active"}) and wanted to reach out. We're actively looking for qualified ${licenseShort} professionals${c.location ? ` in the ${c.location} area` : ""}.

We offer competitive pay, benefits, and a team that respects your expertise. Would you be open to a quick 5-minute call this week?

Best regards`;
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportCSV() {
    const rows = filtered.map(c => [c.full_name, c.license_type, c.license_number || "", c.location || "", c.phone || "", c.email || "", c.availability_score, c.client_action || "new"].join(","));
    const csv = "Name,License Type,License #,Location,Phone,Email,Score,Status\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `talent-pipeline-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  // Filter + search + sort
  const filtered = candidates
    .filter(c => {
      if (filter === "new") return !c.client_action || c.client_action === "new";
      if (filter === "claimed") return !!c.claimed_at;
      if (filter !== "all") return c.client_action === filter;
      return true;
    })
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.full_name.toLowerCase().includes(q) || c.license_type.toLowerCase().includes(q) || (c.location || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "score") return b.availability_score - a.availability_score;
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return a.full_name.localeCompare(b.full_name);
    });

  const counts = {
    all: candidates.length,
    new: candidates.filter(c => !c.client_action || c.client_action === "new").length,
    claimed: candidates.filter(c => !!c.claimed_at).length,
    contacted: candidates.filter(c => c.client_action === "contacted").length,
    hired: candidates.filter(c => c.client_action === "hired").length,
    passed: candidates.filter(c => c.client_action === "passed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#00d4ff] text-sm animate-pulse">Loading talent pipeline...</div>
      </div>
    );
  }

  // Hiring Health Score calculations
  const claimRate = counts.all > 0 ? Math.round((counts.claimed / counts.all) * 100) : 0;
  const hireRate = counts.claimed > 0 ? Math.round((counts.hired / counts.claimed) * 100) : 0;
  const avgScore = candidates.length > 0 ? (candidates.reduce((s, c) => s + c.availability_score, 0) / candidates.length).toFixed(1) : "0";
  const healthScore = Math.min(100, Math.round(
    (claimRate * 0.3) + (hireRate * 0.4) + (Number(avgScore) * 3)
  ));
  const healthColor = healthScore >= 70 ? "#3fb950" : healthScore >= 40 ? "#d29922" : "#f85149";

  return (
    <div className="p-4">
      {/* Hiring Health Score Bar */}
      {counts.all > 0 && (
        <div className="mb-4 bg-white/[0.03] border border-white/10 rounded-lg p-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: `${healthColor}20`, color: healthColor, border: `1px solid ${healthColor}30` }}>
              {healthScore}
            </div>
            <div>
              <div className="text-white text-xs font-bold">Hiring Health</div>
              <div className="text-white/30 text-[10px]">Score / 100</div>
            </div>
          </div>
          <div className="flex-1 flex gap-6">
            <div className="text-center">
              <div className="text-white/70 text-sm font-bold">{claimRate}%</div>
              <div className="text-white/25 text-[9px]">Claim Rate</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-sm font-bold">{hireRate}%</div>
              <div className="text-white/25 text-[9px]">Hire Rate</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-sm font-bold">{avgScore}</div>
              <div className="text-white/25 text-[9px]">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="text-white/70 text-sm font-bold">{counts.all}</div>
              <div className="text-white/25 text-[9px]">Total Found</div>
            </div>
          </div>
          {counts.hired > 0 && (
            <div className="shrink-0 text-right bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
              <div className="text-emerald-400 text-[10px] font-bold">Est. Savings</div>
              <div className="text-emerald-400 text-sm font-black font-mono">${(counts.hired * 4500 - 149).toLocaleString()}</div>
              <div className="text-emerald-400/40 text-[8px]">vs staffing agency</div>
            </div>
          )}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {(["all", "new", "claimed", "contacted", "hired", "passed"] as const).map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`p-2 rounded-lg text-center transition-all ${
              filter === key
                ? "bg-[#00d4ff]/10 border-2 border-[#00d4ff]/50"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            }`}
          >
            <div className={`text-lg font-black ${filter === key ? "text-[#00d4ff]" : "text-white/60"}`}>
              {counts[key]}
            </div>
            <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider capitalize">{key}</div>
          </button>
        ))}
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search name, license type, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d4ff]/50"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-8 text-sm text-white/60 focus:outline-none cursor-pointer"
            >
              <option value="score">Score (high→low)</option>
              <option value="date">Date (newest)</option>
              <option value="name">Name (A→Z)</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>
          <button
            onClick={exportCSV}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Candidate cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{search ? "No matches found" : "No candidates yet. Scanner runs daily at 7am ET."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const scoreColor = c.availability_score >= 7 ? "#22c55e" : c.availability_score >= 4 ? "#f97316" : "#64748b";
            const isClaimed = !!c.claimed_at;
            const claimExpired = c.claim_expires_at && new Date(c.claim_expires_at) < new Date();

            // Calculate time remaining for claim
            let claimTimeLeft = "";
            if (isClaimed && !claimExpired && c.claim_expires_at) {
              const diff = new Date(c.claim_expires_at).getTime() - Date.now();
              const hours = Math.floor(diff / 3600000);
              const mins = Math.floor((diff % 3600000) / 60000);
              claimTimeLeft = `${hours}h ${mins}m`;
            }

            return (
              <div key={c.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:bg-white/[0.05] transition-colors" data-testid={`candidate-${c.id}`}>
                <div className="flex items-start gap-3">
                  {/* Score badge */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm"
                    style={{ background: `${scoreColor}20`, color: scoreColor }}
                  >
                    {c.availability_score}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setDetailCandidate(c)} className="text-sm font-bold text-white truncate hover:text-[#00d4ff] transition-colors text-left" data-testid={`candidate-name-${c.id}`}>
                        {c.full_name}
                      </button>
                      {isClaimed && !claimExpired && (
                        <span className="text-[9px] bg-[#00d4ff]/20 text-[#00d4ff] px-2 py-0.5 rounded font-bold flex-shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          CLAIMED — {claimTimeLeft} left
                        </span>
                      )}
                      {c.client_action && c.client_action !== "new" && (
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold flex-shrink-0 ${
                          c.client_action === "hired" ? "bg-green-500/20 text-green-400" :
                          c.client_action === "contacted" ? "bg-blue-500/20 text-blue-400" :
                          "bg-white/10 text-white/40"
                        }`}>
                          {c.client_action.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {c.license_type}{c.license_number ? ` #${c.license_number}` : ""}
                      </span>
                      {c.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.location}
                        </span>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[#00d4ff] hover:underline">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </a>
                      )}
                    </div>

                    {c.score_reason && (
                      <p className="text-[11px] text-white/20 mt-1 truncate">{c.score_reason}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {!isClaimed && (
                      <button
                        onClick={() => claimCandidate(c.id)}
                        disabled={claimingId === c.id}
                        className="text-[10px] bg-[#00d4ff] text-[#0a1628] font-bold px-3 py-1.5 rounded hover:bg-[#00d4ff]/90 transition-colors disabled:opacity-50"
                        data-testid={`claim-${c.id}`}
                      >
                        {claimingId === c.id ? "..." : "Claim 48h"}
                      </button>
                    )}
                    <button
                      onClick={() => setOutreachCandidate(c)}
                      className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded hover:bg-emerald-500/30 transition-colors flex items-center gap-1 justify-center"
                      data-testid={`outreach-${c.id}`}
                    >
                      <MessageSquare className="w-2.5 h-2.5" /> Outreach
                    </button>
                    {(!c.client_action || c.client_action === "new") && (
                      <>
                        <button
                          onClick={() => updateAction(c.id, "contacted")}
                          disabled={actionId === c.id}
                          className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-3 py-1.5 rounded hover:bg-blue-500/30 transition-colors"
                        >
                          Contacted
                        </button>
                        <button
                          onClick={() => updateAction(c.id, "hired")}
                          disabled={actionId === c.id}
                          className="text-[10px] bg-green-500/20 text-green-400 font-bold px-3 py-1.5 rounded hover:bg-green-500/30 transition-colors"
                        >
                          Hired!
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => updateAction(c.id, "passed")}
                      disabled={actionId === c.id}
                      className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
                    >
                      Pass
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TCPA Notice */}
      <p className="text-[10px] text-white/15 mt-4 text-center">
        Contact information sourced from public licensing records and professional databases.
        TCPA compliance: verify consent before any outreach calls/texts.
      </p>

      {/* ── CANDIDATE DETAIL MODAL ──────────────────────────────── */}
      {detailCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailCandidate(null)}>
          <div className="bg-[#0f1f35] border border-white/10 rounded-xl max-w-md w-full max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()} data-testid="candidate-detail-modal">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-bold text-sm">{detailCandidate.full_name}</h3>
              <button onClick={() => setDetailCandidate(null)} className="text-white/30 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Score */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg" style={{ background: `${detailCandidate.availability_score >= 7 ? "#22c55e" : detailCandidate.availability_score >= 4 ? "#f97316" : "#64748b"}20`, color: detailCandidate.availability_score >= 7 ? "#22c55e" : detailCandidate.availability_score >= 4 ? "#f97316" : "#64748b" }}>
                  {detailCandidate.availability_score}/10
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Availability Score</p>
                  <p className="text-white/40 text-xs">{detailCandidate.score_reason || "Based on license activity and public signals"}</p>
                </div>
              </div>

              {/* License Info */}
              <div className="bg-white/5 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/40 text-xs">License Type</span>
                  <span className="text-white text-xs font-semibold">{detailCandidate.license_type}</span>
                </div>
                {detailCandidate.license_number && (
                  <div className="flex justify-between">
                    <span className="text-white/40 text-xs">License #</span>
                    <span className="text-white/70 text-xs font-mono">{detailCandidate.license_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/40 text-xs">Location</span>
                  <span className="text-white/70 text-xs">{detailCandidate.location || "Michigan"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40 text-xs">Source</span>
                  <span className="text-white/70 text-xs">{detailCandidate.source || "LARA"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40 text-xs">Found</span>
                  <span className="text-white/70 text-xs">{new Date(detailCandidate.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-bold">Contact</p>
                {detailCandidate.phone && (
                  <a href={`tel:${detailCandidate.phone}`} className="flex items-center gap-2 text-[#00d4ff] text-sm hover:underline">
                    <Phone className="w-4 h-4" /> {detailCandidate.phone}
                  </a>
                )}
                {detailCandidate.email && (
                  <a href={`mailto:${detailCandidate.email}`} className="flex items-center gap-2 text-[#00d4ff]/70 text-sm hover:underline">
                    <Mail className="w-4 h-4" /> {detailCandidate.email}
                  </a>
                )}
                {detailCandidate.location && (
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent(detailCandidate.location)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/40 text-sm hover:text-[#00d4ff]">
                    <MapPin className="w-4 h-4" /> View on Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => { setDetailCandidate(null); setOutreachCandidate(detailCandidate); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> Draft Outreach
                </button>
                {!detailCandidate.claimed_at && (
                  <button
                    onClick={() => { claimCandidate(detailCandidate.id); setDetailCandidate(null); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00d4ff] text-[#0a1628] text-sm font-bold hover:bg-[#00d4ff]/90 transition-colors"
                  >
                    <Lock className="w-4 h-4" /> Claim 48h
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── OUTREACH DRAFT MODAL ───────────────────────────────── */}
      {outreachCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOutreachCandidate(null)}>
          <div className="bg-[#0f1f35] border border-white/10 rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()} data-testid="outreach-modal">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-bold text-sm">Outreach Draft</h3>
                <p className="text-white/40 text-xs">{outreachCandidate.full_name} — {outreachCandidate.license_type}</p>
              </div>
              <button onClick={() => setOutreachCandidate(null)} className="text-white/30 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-black/20 rounded-lg p-4 border border-white/5">
                {generateOutreach(outreachCandidate)}
              </pre>
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => copyText(generateOutreach(outreachCandidate))}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Message"}
              </button>
              {outreachCandidate.email && (
                <a
                  href={`mailto:${outreachCandidate.email}?subject=${encodeURIComponent(`Opportunity for ${outreachCandidate.full_name.split(" ")[0]}`)}&body=${encodeURIComponent(generateOutreach(outreachCandidate))}`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <Mail className="w-4 h-4" /> Email
                </a>
              )}
              {outreachCandidate.phone && (
                <a
                  href={`sms:${outreachCandidate.phone}`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <Phone className="w-4 h-4" /> Text
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
