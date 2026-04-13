import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Users, Flame, Phone, Mail, ChevronDown, ChevronUp,
  ExternalLink, Award, MapPin, Briefcase, Shield,
  Stethoscope, Heart, Building2, Wrench, Zap, HardHat,
  UserCheck, ThumbsUp, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const HEALTHCARE_ROLES = ["cna", "rn", "lpn", "director_of_nursing", "home_health_aide"];

interface Candidate {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_type: string | null;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  availability_score: number;
  score_reason: string | null;
  qualifications_summary: string | null;
  hiring_recommendation: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  current_employer: string | null;
  current_title: string | null;
  years_experience: string | null;
  alerted_at: string;
  client_action: string | null;
}

interface DashboardData {
  client: {
    company_name: string;
    target_roles: string[];
    target_zip_codes: string[];
  };
  candidates: Candidate[];
  kpi: { total: number; hot: number; contacted: number; hired: number };
}

const ROLE_LABELS: Record<string, string> = {
  hvac: "HVAC", plumber: "Plumber", electrician: "Electrician",
  boiler_operator: "Boiler Operator", welder: "Welder", pipefitter: "Pipefitter",
  millwright: "Millwright", industrial_mechanic: "Industrial Mechanic",
  pressure_vessel: "Pressure Vessel", cna: "CNA", rn: "Registered Nurse",
  lpn: "Licensed Practical Nurse", director_of_nursing: "Director of Nursing",
  home_health_aide: "Home Health Aide",
};

export default function MyTechAlert() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [scoreFilter, setScoreFilter] = useState<"all" | "hot" | "medium">("all");

  const isHealthcare = useMemo(() => {
    if (!data) return false;
    return data.client.target_roles.some((r) => HEALTHCARE_ROLES.includes(r));
  }, [data]);

  useEffect(() => {
    if (!token) {
      setError("No access token provided. Check your email for the dashboard link.");
      setLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke("get-my-techalert", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      // Edge functions via invoke don't support GET query params well, use fetch directly
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-techalert?token=${token}`;
      const res = await fetch(url, {
        headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load dashboard");
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function updateAction(candidateId: string, action: "contacted" | "hired") {
    if (!token) return;
    setUpdatingIds((prev) => new Set(prev).add(candidateId));
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-candidate-action`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token, candidate_id: candidateId, action }),
      });
      const result = await res.json();
      if (result.success) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId ? { ...c, client_action: action } : c
            ),
            kpi: {
              ...prev.kpi,
              contacted: action === "contacted" ? prev.kpi.contacted + 1 : prev.kpi.contacted,
              hired: action === "hired" ? prev.kpi.hired + 1 : prev.kpi.hired,
            },
          };
        });
        if (action === "hired") {
          toast.success("Congratulations on the hire! This data helps us find even better candidates for you.", {
            duration: 6000,
          });
        } else {
          toast.success("Marked as contacted");
        }
      }
    } catch {
      toast.error("Failed to update — try again");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredCandidates = useMemo(() => {
    if (!data) return [];
    let list = data.candidates;
    if (scoreFilter === "hot") list = list.filter((c) => c.availability_score >= 7);
    else if (scoreFilter === "medium") list = list.filter((c) => c.availability_score >= 5 && c.availability_score < 7);
    return list;
  }, [data, scoreFilter]);

  const scoreBadgeColor = (score: number) => {
    if (score >= 8) return "bg-red-600 text-white";
    if (score >= 7) return "bg-orange-500 text-white";
    if (score >= 5) return "bg-amber-500 text-white";
    return "bg-slate-400 text-white";
  };

  // Theme
  const accentColor = isHealthcare ? "text-blue-500" : "text-cyan-400";
  const accentBg = isHealthcare ? "bg-blue-500" : "bg-cyan-400";
  const brandName = isHealthcare ? "HireAlert" : "TechAlert";
  const subtitle = isHealthcare ? "Licensed Healthcare Professionals" : "Licensed Techs in Your Area";
  const badgeLabel = isHealthcare ? "License Type" : "Trade";
  const IndustryIcon = isHealthcare ? Stethoscope : Wrench;
  const emptyText = isHealthcare ? "No candidates found yet" : "No techs found yet";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
        <Card className="max-w-md bg-[#1e293b] border-slate-700">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-white text-lg font-bold mb-2">Access Denied</h2>
            <p className="text-slate-400 text-sm">{error || "Invalid or expired token."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Header */}
      <div className={`border-b ${isHealthcare ? "border-blue-500/30" : "border-cyan-400/30"}`}
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #1e293b 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <IndustryIcon className={`h-6 w-6 ${accentColor}`} />
            <p className={`text-xs font-extrabold tracking-[3px] uppercase ${accentColor}`}>
              ⚡ {brandName}
            </p>
          </div>
          <h1 className="text-white text-2xl md:text-3xl font-extrabold tracking-tight mb-1">
            {subtitle}
          </h1>
          <p className="text-slate-400 text-sm">
            {data.client.company_name ? `Dashboard for ${data.client.company_name}` : "Your candidate dashboard"}
            {data.client.target_roles.length > 0 && (
              <span className="ml-2">
                · Tracking: {data.client.target_roles.map((r) => ROLE_LABELS[r] || r).join(", ")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Candidates", value: data.kpi.total, icon: Users, color: "text-slate-300" },
            { label: "Hot (7+)", value: data.kpi.hot, icon: Flame, color: "text-orange-400" },
            { label: "Contacted", value: data.kpi.contacted, icon: ThumbsUp, color: "text-cyan-400" },
            { label: "Hired", value: data.kpi.hired, icon: UserCheck, color: "text-emerald-400" },
          ].map((kpi) => (
            <Card key={kpi.label} className="bg-[#1e293b] border-slate-700/50">
              <CardContent className="p-4 flex items-center gap-3">
                <kpi.icon className={`h-5 w-5 ${kpi.color} shrink-0`} />
                <div>
                  <p className="text-2xl font-black text-white leading-none">{kpi.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all" as const, label: "All", count: data.candidates.length },
            { key: "hot" as const, label: "🔥 Hot (7+)", count: data.kpi.hot },
            { key: "medium" as const, label: "📋 Available (5-6)", count: data.candidates.filter((c) => c.availability_score >= 5 && c.availability_score < 7).length },
          ].map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={scoreFilter === f.key ? "default" : "outline"}
              onClick={() => setScoreFilter(f.key)}
              className={scoreFilter === f.key
                ? `${isHealthcare ? "bg-blue-600 hover:bg-blue-700" : "bg-cyan-600 hover:bg-cyan-700"} text-white border-0`
                : "border-slate-600 text-slate-300 hover:bg-slate-800"
              }
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>

        {/* Candidate List */}
        {filteredCandidates.length === 0 ? (
          <Card className="bg-[#1e293b] border-slate-700/50">
            <CardContent className="py-12 text-center">
              <IndustryIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">{emptyText}</p>
              <p className="text-slate-500 text-sm mt-1">We scan daily — new matches will appear here automatically.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCandidates.map((c) => {
              const isExpanded = expandedIds.has(c.id);
              const isUpdating = updatingIds.has(c.id);

              return (
                <Card key={c.id} className={`bg-[#1e293b] border-slate-700/50 overflow-hidden transition-all ${c.availability_score >= 7 ? "ring-1 ring-orange-500/20" : ""}`}>
                  {/* Collapsed header */}
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black ${scoreBadgeColor(c.availability_score)}`}>
                      {c.availability_score >= 8 ? "🔥" : c.availability_score >= 7 ? "⚡" : ""}{c.availability_score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{c.full_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className={`text-[10px] px-2 py-0 ${isHealthcare ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"}`}>
                          {c.license_type || (isHealthcare ? "Healthcare" : "Technician")}
                        </Badge>
                        {c.city && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {c.city}
                          </span>
                        )}
                        {c.client_action && (
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 ${c.client_action === "hired" ? "border-emerald-500/40 text-emerald-400" : "border-slate-500/40 text-slate-400"}`}>
                            {c.client_action === "hired" ? "✅ Hired" : c.client_action === "contacted" ? "📞 Contacted" : "👁 Viewed"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-slate-500">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                      {/* Contact info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-orange-400 hover:text-orange-300 font-bold text-sm bg-orange-500/5 rounded-lg px-3 py-2.5 transition-colors">
                            <Phone className="h-4 w-4" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className={`flex items-center gap-2 ${isHealthcare ? "text-blue-400 hover:text-blue-300 bg-blue-500/5" : "text-cyan-400 hover:text-cyan-300 bg-cyan-500/5"} font-semibold text-sm rounded-lg px-3 py-2.5 transition-colors`}>
                            <Mail className="h-4 w-4" /> {c.email}
                          </a>
                        )}
                      </div>

                      {/* Professional details */}
                      <div className="space-y-2 text-sm">
                        {c.current_employer && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            <span><strong>{c.current_employer}</strong>{c.current_title ? ` · ${c.current_title}` : ""}</span>
                          </div>
                        )}
                        {c.license_number && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Award className="h-3.5 w-3.5 text-slate-500" />
                            <span>License: <strong>{c.license_number}</strong>{c.license_expiry ? ` · Exp: ${c.license_expiry}` : ""}</span>
                          </div>
                        )}
                        {c.years_experience && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                            <span>{c.years_experience}+ years experience</span>
                          </div>
                        )}
                      </div>

                      {/* Links */}
                      {(c.linkedin_url || c.facebook_url) && (
                        <div className="flex gap-2">
                          {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:text-blue-400 text-xs font-semibold flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> LinkedIn
                            </a>
                          )}
                          {c.facebook_url && (
                            <a href={c.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[#1877f2] hover:text-blue-400 text-xs font-semibold flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Facebook
                            </a>
                          )}
                        </div>
                      )}

                      {/* Qualifications & Recommendation */}
                      {c.qualifications_summary && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Qualifications</p>
                          <p className="text-slate-300 text-xs leading-relaxed">{c.qualifications_summary}</p>
                        </div>
                      )}
                      {c.hiring_recommendation && (
                        <div className={`${isHealthcare ? "bg-blue-500/5 border-blue-500/20" : "bg-cyan-500/5 border-cyan-500/20"} border rounded-lg p-3`}>
                          <p className={`text-[11px] font-bold ${isHealthcare ? "text-blue-400" : "text-cyan-400"} uppercase tracking-wide mb-1`}>Recommendation</p>
                          <p className="text-slate-300 text-xs leading-relaxed">{c.hiring_recommendation}</p>
                        </div>
                      )}

                      {/* Score reason */}
                      {c.score_reason && (
                        <p className="text-[11px] text-slate-500 italic">{c.score_reason}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        {c.client_action !== "contacted" && c.client_action !== "hired" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                            disabled={isUpdating}
                            onClick={() => updateAction(c.id, "contacted")}
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
                            Mark as Contacted
                          </Button>
                        )}
                        {c.client_action !== "hired" && (
                          <Button
                            size="sm"
                            className={`text-xs text-white ${isHealthcare ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                            disabled={isUpdating}
                            onClick={() => updateAction(c.id, "hired")}
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                            Mark as Hired
                          </Button>
                        )}
                      </div>

                      {/* Alert date */}
                      <p className="text-[10px] text-slate-600">
                        Alerted: {new Date(c.alerted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Upsell Card */}
        <Card className={`${isHealthcare ? "bg-blue-950/30 border-blue-500/20" : "bg-cyan-950/30 border-cyan-500/20"}`}>
          <CardContent className="p-5">
            {isHealthcare ? (
              <div className="flex items-start gap-3">
                <Heart className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-bold text-sm mb-1">Refer a Partner Facility</p>
                  <p className="text-slate-400 text-xs mb-3">Know another facility struggling to find staff? Refer them and get 1 month free.</p>
                  <a href="mailto:matt@detroitwebagent.com?subject=HireAlert%20Referral" className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                    <Mail className="h-3.5 w-3.5" /> Refer Now
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Zap className="h-6 w-6 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-bold text-sm mb-1">Need Exclusive Inbound Leads?</p>
                  <p className="text-slate-400 text-xs mb-3">Get homeowner leads delivered directly to you — pay per lead, no contracts.</p>
                  <a href="https://detroitwebagency.com/contractor-leads" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Learn More
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t border-slate-800">
          <p className="text-slate-600 text-[11px]">
            Powered by Detroit Web Agency · <a href="tel:+13139921219" className={`${accentColor} hover:underline`}>(313) 992-1219</a>
          </p>
          <p className="text-slate-700 text-[10px] mt-1">Reply to any alert email to adjust your target roles or zip codes</p>
        </div>
      </div>
    </div>
  );
}
