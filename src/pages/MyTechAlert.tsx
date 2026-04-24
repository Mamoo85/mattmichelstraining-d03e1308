import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Users, Flame, Phone, Mail, ChevronDown, ChevronUp,
  ExternalLink, Award, MapPin, Briefcase, Shield,
  Stethoscope, Heart, Building2, Wrench, Zap,
  UserCheck, ThumbsUp, Loader2, Lock, Clock,
  Copy, FileText, AlertTriangle, X, CalendarCheck,
  Radio, TrendingUp, Factory, Target, Info, Download, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import RevenueRecoveredLedger from "@/components/RevenueRecoveredLedger";
import InstallAppBanner from "@/components/shared/InstallAppBanner";
import HiringHealthScore from "@/components/techalert/HiringHealthScore";
import CandidateRiskBadges from "@/components/techalert/CandidateRiskBadges";
import { RadarExportBar } from "@/components/shared/RadarExportBar";
import DemoModeBadge, { isDemoMode, DEMO_MASTER_TOKEN } from "@/components/DemoModeBadge";
import { supabase } from "@/integrations/supabase/client";
import DWASuiteNav from "@/components/shared/DWASuiteNav";

const HEALTHCARE_ROLES = ["cna", "rn", "lpn", "director_of_nursing", "home_health_aide"];

interface Candidate {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_type: string | null;
  license_number: string | null;
  license_expiry: string | null;
  license_status: string;
  city: string | null;
  availability_score: number;
  availability_label: string;
  score_reason: string | null;
  qualifications_summary: string | null;
  hiring_recommendation: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  profile_photo_url: string | null;
  current_employer: string | null;
  current_title: string | null;
  years_experience: string | null;
  alerted_at: string;
  client_action: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  claimed_by_other: boolean;
  cross_referenced: boolean;
  flight_risk?: string | null;
  flight_risk_proof?: string | null;
  // Item 3 — HIBP cyber hygiene
  cyber_hygiene_score?: number | null;
  employer_domain_breached_recently?: boolean | null;
  password_compromised?: boolean | null;
  // Item 5 — urgency decay
  urgency_score?: number | null;
  available_until?: string | null;
}

interface DashboardData {
  client: {
    company_name: string;
    target_roles: string[];
    target_zip_codes: string[];
    booking_link?: string;
  };
  candidates: Candidate[];
  kpi: { total: number; hot: number; contacted: number; hired: number };
}

interface OutreachDraft {
  text_message: string;
  email_subject: string;
  email_body: string;
  tcpa_notice: string;
}

interface MarketSignal {
  id: string;
  company_name: string;
  location: string | null;
  signal_type: "expansion" | "hiring_pattern" | "cross_referenced";
  confidence: number;
  recommended_pitch: string | null;
  detected_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  hvac: "HVAC", hvac_tech: "HVAC Tech", plumber: "Plumber", electrician: "Electrician",
  boiler_operator: "Boiler Operator", welder: "Welder", pipefitter: "Pipefitter",
  millwright: "Millwright", industrial_mechanic: "Industrial Mechanic",
  pressure_vessel: "Pressure Vessel", cna: "CNA", rn: "Registered Nurse",
  lpn: "Licensed Practical Nurse", director_of_nursing: "Director of Nursing",
  home_health_aide: "Home Health Aide",
};

const SIGNAL_CONFIG: Record<string, { icon: typeof Factory; label: string; color: string; bg: string }> = {
  expansion: { icon: Factory, label: "Expansion News", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  hiring_pattern: { icon: TrendingUp, label: "Hiring Pattern", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  cross_referenced: { icon: Target, label: "Cross-Referenced", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

export default function MyTechAlert() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const isDemo = isDemoMode(token);
  const autoClaimId = searchParams.get("claim");
  const autoMode = searchParams.get("auto");
  const highlightId = searchParams.get("highlight");
  const autoAction = searchParams.get("action"); // "draft" to auto-open outreach modal
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const [scoreFilter, setScoreFilter] = useState<"all" | "hot" | "medium">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState<"all" | "boiler" | "hvac" | "plumber" | "electrician" | "healthcare">("all");
  const [sortMode, setSortMode] = useState<"score" | "newest" | "license" | "contact">("score");
  const [outreachModal, setOutreachModal] = useState<{ candidateId: string; draft: OutreachDraft; isPitch?: boolean } | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState<string | null>(null);
  const [fastTrackingId, setFastTrackingId] = useState<string | null>(null);
  const [quickStartDismissed, setQuickStartDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("techalert_quickstart_dismissed") === "1"
  );
  const highlightRef = useRef<HTMLDivElement>(null);
  const highlightHandled = useRef(false);

  const isHealthcare = useMemo(() => {
    if (!data) return false;
    return data.client.target_roles.some((r) => HEALTHCARE_ROLES.includes(r));
  }, [data]);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Scanner run history query
  const { data: scannerStats } = useQuery({
    queryKey: ["hire-alert-public-stats"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("hire-alert-public-stats", { method: "GET" as never });
      return data ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Market Signals query
  const { data: signalsData } = useQuery({
    queryKey: ["techalert-signals", token],
    queryFn: async () => {
      const r = await fetch(`${baseUrl}/get-techalert-signals?token=${encodeURIComponent(token || "")}`, { headers: { apikey } });
      if (!r.ok) return { type: "empty", items: [] };
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) {
      setError("No access token provided. Check your email for the dashboard link.");
      setLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  // Auto-claim on mount when ?claim=X&auto=1
  useEffect(() => {
    if (autoClaimId && autoMode === "1" && data && token) {
      claimCandidate(autoClaimId);
    }
  }, [autoClaimId, autoMode, data]);

  // Deep-link: highlight, scroll, expand, and optionally auto-draft
  useEffect(() => {
    if (!highlightId || !data || highlightHandled.current) return;
    highlightHandled.current = true;
    // Expand the highlighted candidate
    setExpandedIds((prev) => new Set(prev).add(highlightId));
    // Scroll after render
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    // Auto-open draft outreach modal if action=draft
    if (autoAction === "draft") {
      setTimeout(() => generateOutreach(highlightId), 600);
    }
  }, [highlightId, data, autoAction]);

  async function fetchData() {
    setLoading(true);
    try {
      // Demo mode: load mock data without hitting the API
      if (isDemo) {
        setData({
          client: {
            company_name: "Demo Company",
            target_roles: ["boiler_operator", "hvac_tech", "plumber", "electrician", "rn"],
            target_zip_codes: ["48124", "48092", "48034"],
            booking_link: "https://calendly.com/demo-link",
          },
          candidates: [
            { id: "demo-1", full_name: "John Mitchell", phone: "+13135550101", email: "demo@example.com", license_type: "boiler_operator", license_number: "DEMO-BO-4821", license_expiry: "2027-06-15", license_status: "active", city: "Dearborn", availability_score: 9, availability_label: "High Availability", score_reason: "License renewing soon, updated LinkedIn profile, no current employer listed", qualifications_summary: "12 years boiler operation experience. High-pressure steam certified. Previous: Ford Rouge Complex, Henry Ford Health. ASME Section I qualified.", hiring_recommendation: "Top candidate — actively looking, strong industrial background, available immediately.", linkedin_url: null, facebook_url: null, profile_photo_url: null, current_employer: null, current_title: "Senior Boiler Operator", years_experience: "12", alerted_at: new Date().toISOString(), client_action: null, claimed_at: null, claim_expires_at: null, claimed_by_other: false, cross_referenced: true, flight_risk: "high_flight_risk", flight_risk_proof: '🎯 HIGH FLIGHT RISK — No recent growth signals detected at current employer in last 60 days. Candidate is statistically more receptive to outreach.' },
            { id: "demo-2", full_name: "Sarah Chen", phone: "+13135550102", email: "demo2@example.com", license_type: "hvac_tech", license_number: "DEMO-HV-7293", license_expiry: "2027-09-01", license_status: "active", city: "Warren", availability_score: 8, availability_label: "High Availability", score_reason: "Recently completed additional EPA 608 certification", qualifications_summary: "8 years HVAC residential & commercial. EPA 608 Universal. Carrier & Trane factory trained.", hiring_recommendation: "Strong hire — dual residential/commercial experience rare in this market.", linkedin_url: null, facebook_url: null, profile_photo_url: null, current_employer: "Metro Comfort Systems", current_title: "Lead HVAC Technician", years_experience: "8", alerted_at: new Date().toISOString(), client_action: null, claimed_at: null, claim_expires_at: null, claimed_by_other: false, cross_referenced: false, flight_risk: "neutral", flight_risk_proof: '↔️ NEUTRAL — Employer shows 1 recent activity signal. Approach with standard outreach.' },
            { id: "demo-3", full_name: "Marcus Williams", phone: "+13135550103", email: "demo3@example.com", license_type: "plumber", license_number: "DEMO-PL-3847", license_expiry: "2026-12-31", license_status: "active", city: "Southfield", availability_score: 7, availability_label: "Possible Availability", score_reason: "License expiring this year — may be exploring options", qualifications_summary: "15 years master plumber. Backflow prevention certified. Medical gas installer (ASSE 6010).", hiring_recommendation: "Worth pursuing — medical gas certification is highly valued.", linkedin_url: null, facebook_url: null, profile_photo_url: null, current_employer: "Great Lakes Plumbing Co", current_title: "Master Plumber", years_experience: "15", alerted_at: new Date().toISOString(), client_action: null, claimed_at: null, claim_expires_at: null, claimed_by_other: false, cross_referenced: false, flight_risk: "high_flight_risk", flight_risk_proof: '🎯 HIGH FLIGHT RISK — No recent growth signals detected at current employer in last 60 days. Candidate is statistically more receptive to outreach.' },
            { id: "demo-4", full_name: "Lisa Rodriguez", phone: "+13135550104", email: "demo4@example.com", license_type: "rn", license_number: "DEMO-RN-6194", license_expiry: "2027-03-15", license_status: "active", city: "Troy", availability_score: 8, availability_label: "High Availability", score_reason: "Recent practice address change detected — possible job transition", qualifications_summary: "10 years RN. BSN from Wayne State. ICU & med-surg experience. BLS/ACLS current.", hiring_recommendation: "Excellent candidate — ICU background with major health system experience.", linkedin_url: null, facebook_url: null, profile_photo_url: null, current_employer: null, current_title: "Registered Nurse", years_experience: "10", alerted_at: new Date().toISOString(), client_action: null, claimed_at: null, claim_expires_at: null, claimed_by_other: false, cross_referenced: true, flight_risk: "neutral", flight_risk_proof: 'Employer not identified — flight risk unknown.' },
            { id: "demo-5", full_name: "David Kowalski", phone: "+13135550105", email: "demo5@example.com", license_type: "electrician", license_number: "DEMO-EL-5520", license_expiry: "2027-11-30", license_status: "active", city: "Livonia", availability_score: 6, availability_label: "Monitor", score_reason: "Stable employment but license shows recent continuing education", qualifications_summary: "20 years journeyman electrician. Industrial controls & PLC programming. Allen-Bradley certified.", hiring_recommendation: "Long-shot but high value — industrial controls expertise commands premium rates.", linkedin_url: null, facebook_url: null, profile_photo_url: null, current_employer: "Stellantis (Warren Truck Assembly)", current_title: "Industrial Electrician", years_experience: "20", alerted_at: new Date().toISOString(), client_action: null, claimed_at: null, claim_expires_at: null, claimed_by_other: false, cross_referenced: false, flight_risk: "hard_to_poach", flight_risk_proof: '🛡️ HARD TO POACH — Employer shows 4 expansion signals in last 60 days (~120 open roles tracked). Candidate is likely comfortable.' },
          ],
          kpi: { total: 5, hot: 3, contacted: 0, hired: 0 },
        });
        setLoading(false);
        return;
      }
      const res = await fetch(`${baseUrl}/get-my-techalert?token=${token}`, { headers: { apikey } });
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

  async function updateAction(candidateId: string, action: "contacted" | "interviewed" | "hired") {
    if (!token) return;
    setUpdatingIds((prev) => new Set(prev).add(candidateId));
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("update-candidate-action", {
        body: { token, candidate_id: candidateId, action },
      });
      if (invokeErr) throw invokeErr;
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
        toast.success(action === "hired"
          ? "Congratulations on the hire! This helps us find even better candidates."
          : "Marked as contacted"
        );
      }
    } catch {
      toast.error("Failed to update — try again");
    } finally {
      setUpdatingIds((prev) => { const n = new Set(prev); n.delete(candidateId); return n; });
    }
  }

  const claimLockRef = useRef<Set<string>>(new Set());
  async function claimCandidate(candidateId: string) {
    if (!token || claimLockRef.current.has(candidateId)) return;
    claimLockRef.current.add(candidateId);
    setClaimingIds((prev) => new Set(prev).add(candidateId));
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("claim-candidate", {
        body: { token, candidate_id: candidateId, is_demo: isDemo },
      });
      if (invokeErr) throw invokeErr;
      if (result.claimed) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId ? { ...c, claimed_at: new Date().toISOString(), claim_expires_at: result.expires_at, claimed_by_other: false } : c
            ),
          };
        });
        toast.success("⚡ Claimed! 48-hour exclusivity activated.");
      } else {
        toast.info(result.message || "Already claimed by another company.");
      }
    } catch {
      toast.error("Claim failed — try again");
    } finally {
      setClaimingIds((prev) => { const n = new Set(prev); n.delete(candidateId); return n; });
      claimLockRef.current.delete(candidateId);
    }
  }

  async function generateOutreach(candidateId: string) {
    if (!token) return;
    setGeneratingDraft(candidateId);
    try {
      const { data: draft, error: invokeErr } = await supabase.functions.invoke("generate-outreach-draft", {
        body: { token, candidate_id: candidateId, is_demo: isDemo },
      });
      if (invokeErr) throw invokeErr;
      if (draft.error) throw new Error(draft.error);
      setOutreachModal({ candidateId, draft });
    } catch {
      toast.error("Failed to generate draft — try again");
    } finally {
      setGeneratingDraft(null);
    }
  }

  function openPitchModal(signal: MarketSignal) {
    const pitch = signal.recommended_pitch || `We've identified ${signal.company_name} as a high-growth target in your area.`;
    setOutreachModal({
      candidateId: signal.id,
      isPitch: true,
      draft: {
        text_message: `Hi — I noticed ${signal.company_name} in ${signal.location || "your area"} is expanding. We help companies like yours find licensed talent before they hit job boards. Interested in a quick call?`,
        email_subject: `Staffing intelligence for ${signal.company_name}`,
        email_body: pitch,
        tcpa_notice: "Copy-paste and send from your phone. Do not text numbers on your internal do-not-contact list.",
      },
    });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  const fastTrackLock = useRef(false);
  async function fastTrackInterview(candidateId: string) {
    if (!token || fastTrackLock.current || fastTrackingId === candidateId) return;
    fastTrackLock.current = true;
    setFastTrackingId(candidateId);
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("fast-track-interview", {
        body: { token, candidate_id: candidateId, is_demo: isDemo },
      });
      if (invokeErr) throw invokeErr;
      if (result.error === "no_booking_link") {
        toast.info("Add your scheduling link to enable Fast-Track. Email matt@detroitwebagent.com to set it up.");
        return;
      }
      if (result.success) {
        toast.success(`⚡ Interview invite sent to ${result.candidate_name}!`);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateId ? { ...c, client_action: "contacted" } : c
            ),
            kpi: { ...prev.kpi, contacted: prev.kpi.contacted + 1 },
          };
        });
      } else if (result.skipped) {
        toast.info("Candidate opted out of SMS — try reaching out via email or LinkedIn.");
      } else {
        toast.error(result.error || "Failed to send invite");
      }
    } catch {
      toast.error("Failed to send invite — try again");
    } finally {
      setFastTrackingId(null);
      fastTrackLock.current = false;
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredCandidates = useMemo(() => {
    if (!data) return [];
    let list = data.candidates;

    // Score filter
    if (scoreFilter === "hot") list = list.filter((c) => c.availability_score >= 7);
    else if (scoreFilter === "medium") list = list.filter((c) => c.availability_score >= 5 && c.availability_score < 7);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) =>
        [c.full_name, c.city, c.license_type, c.current_employer].some(
          (f) => f?.toLowerCase().includes(q)
        )
      );
    }

    // Trade filter
    if (tradeFilter !== "all") {
      if (tradeFilter === "healthcare") {
        list = list.filter((c) => /cna|rn|lpn|nurse/i.test(c.license_type || ""));
      } else {
        list = list.filter((c) => c.license_type?.toLowerCase().includes(tradeFilter));
      }
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortMode === "score") {
        if (a.cross_referenced && !b.cross_referenced) return -1;
        if (!a.cross_referenced && b.cross_referenced) return 1;
        return (b.availability_score || 0) - (a.availability_score || 0);
      }
      if (sortMode === "newest") {
        return new Date(b.alerted_at).getTime() - new Date(a.alerted_at).getTime();
      }
      if (sortMode === "license") {
        return (b.license_number ? 1 : 0) - (a.license_number ? 1 : 0);
      }
      if (sortMode === "contact") {
        const aHas = (a.phone || a.email) ? 1 : 0;
        const bHas = (b.phone || b.email) ? 1 : 0;
        return bHas - aHas;
      }
      return 0;
    });
  }, [data, scoreFilter, searchQuery, tradeFilter, sortMode]);

  const exportCSV = useCallback(() => {
    const headers = ["Name", "License Type", "License Number", "City", "Phone", "Email", "Score", "First Seen"];
    const rows = filteredCandidates.map((c) => [
      c.full_name, c.license_type || "", c.license_number || "", c.city || "",
      c.phone || "", c.email || "", String(c.availability_score), c.alerted_at?.split("T")[0] || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `techalert-candidates-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredCandidates.length} candidates`);
  }, [filteredCandidates]);

  const scoreBadgeColor = (score: number) => {
    if (score >= 8) return "bg-emerald-500 text-white";
    if (score >= 5) return "bg-amber-500 text-white";
    return "bg-slate-500 text-white";
  };

  const accentColor = isHealthcare ? "text-blue-500" : "text-[#00d4ff]";
  const brandName = "Talent Radar";
  const subtitle = isHealthcare ? "Licensed Healthcare Professionals" : "Licensed Techs in Your Area";
  const IndustryIcon = isHealthcare ? Stethoscope : Wrench;

  function getClaimStatus(c: Candidate): "unclaimed" | "mine" | "other" | "expired" {
    if (!c.claimed_at) return "unclaimed";
    if (c.claimed_by_other) return "other";
    if (c.claim_expires_at && new Date(c.claim_expires_at) < new Date()) return "expired";
    return "mine";
  }

  function getClaimTimeLeft(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }

  const signals: MarketSignal[] = signalsData?.items || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff] mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isMissingToken = !token;
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
        <Card className="max-w-md border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-white text-lg font-bold mb-2">
              {isMissingToken ? "Dashboard Link Required" : "Access Denied"}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {error || "Invalid or expired token. Check your latest email for a fresh dashboard link."}
            </p>
            <a
              href="sms:+13139921219"
              className="inline-block bg-[#00d4ff] text-black font-bold text-sm px-6 py-3 rounded-md hover:bg-[#00d4ff]/90 transition"
              style={{ minHeight: 44, lineHeight: "1.25rem", touchAction: "manipulation" }}
            >
              Text Matt for a fresh link →
            </a>
            <p className="text-slate-500 text-xs mt-4">(313) 992-1219</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {isDemo && <DemoModeBadge />}
      <DWASuiteNav activeProduct="techalert" />
      {/* Header */}
      <div className="border-b border-white/5" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f2e 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <IndustryIcon className={`h-6 w-6 ${accentColor}`} />
              <p className={`text-xs font-extrabold tracking-[3px] uppercase ${accentColor}`}>
                ⚡ {brandName}
              </p>
            </div>
            {token && <RevenueRecoveredLedger token={token} clientType="techalert" />}
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
        {/* One-tap install — shown to net-new clients arriving from welcome email */}
        <InstallAppBanner app="dwa-client" />

        {/* Hiring Health Score + Pipeline Funnel */}
        {token && <HiringHealthScore token={token} />}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Candidates", value: data.kpi.total, icon: Users, color: "text-slate-300" },
            { label: "Hot (7+)", value: data.kpi.hot, icon: Flame, color: "text-orange-400" },
            { label: "Contacted", value: data.kpi.contacted, icon: ThumbsUp, color: "text-[#00d4ff]" },
            { label: "Hired", value: data.kpi.hired, icon: UserCheck, color: "text-emerald-400" },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
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

        {/* Quick Start Banner */}
        {!quickStartDismissed && !isDemo && (
          <div className="rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#00d4ff]" />
                <p className="text-[#00d4ff] font-bold text-xs uppercase tracking-wider">Quick Start</p>
              </div>
              <button
                onClick={() => { localStorage.setItem("techalert_quickstart_dismissed", "1"); setQuickStartDismissed(true); }}
                className="text-slate-500 hover:text-white transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {[
                { icon: "⚡", text: "Claim candidates before competitors — 48-hour exclusivity locks them to you" },
                { icon: "📞", text: "Mark candidates as Contacted to track your hiring pipeline" },
                { icon: "✍️", text: "Use Draft Outreach on any card for AI-written SMS + email templates" },
                { icon: "🎯", text: "Filter by trade (Boiler / HVAC / Healthcare) or use the search bar" },
                { icon: "🔔", text: "Scanner runs every morning at 7am — new matches appear here automatically and trigger an alert" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Scanner Activity — last 7 runs */}
        {scannerStats?.runs && scannerStats.runs.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">Scanner Activity</span>
              </div>
              <span className="text-slate-500 text-[11px]">Last {scannerStats.runs.length} runs</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2 text-left text-slate-500 font-semibold uppercase tracking-wide">Date</th>
                    <th className="px-4 py-2 text-center text-slate-500 font-semibold uppercase tracking-wide">Scanned</th>
                    <th className="px-4 py-2 text-center text-slate-500 font-semibold uppercase tracking-wide">New</th>
                    <th className="px-4 py-2 text-center text-slate-500 font-semibold uppercase tracking-wide">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {scannerStats.runs.map((run: { run_at: string; candidates_found: number; new_candidates: number; alerts_sent: number }, i: number) => {
                    const d = new Date(run.run_at);
                    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-slate-300">{label} <span className="text-slate-600">{time}</span></td>
                        <td className="px-4 py-2.5 text-center text-slate-300">{run.candidates_found}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={run.new_candidates > 0 ? "text-emerald-400 font-bold" : "text-slate-500"}>
                            {run.new_candidates > 0 ? `+${run.new_candidates}` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={run.alerts_sent > 0 ? "text-[#00d4ff] font-bold" : "text-slate-500"}>
                            {run.alerts_sent > 0 ? run.alerts_sent : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Market Signals Feed */}
        {signals.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#00d4ff] animate-pulse" />
              <h2 className="text-white font-bold text-sm uppercase tracking-wider">Market Signals</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-amber-400/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] bg-[#0a1628] border-white/10 text-slate-300 text-xs">
                  ⚠️ Verify signals independently before outreach.
                </TooltipContent>
              </Tooltip>
              <span className="text-[10px] text-slate-500 ml-auto">{signals.length} active</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {signals.map((signal) => {
                const cfg = SIGNAL_CONFIG[signal.signal_type] || SIGNAL_CONFIG.expansion;
                const SignalIcon = cfg.icon;
                return (
                  <div key={signal.id} className={`rounded-xl border p-4 ${cfg.bg} bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-white font-bold text-sm">{signal.company_name}</p>
                        {signal.location && (
                          <p className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {signal.location}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cfg.bg} ${cfg.color} border-current/20 shrink-0`}>
                        <SignalIcon className="h-2.5 w-2.5 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    {signal.recommended_pitch && (
                      <p className="text-slate-300 text-xs leading-relaxed mb-3 line-clamp-2">{signal.recommended_pitch}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold ${
                        signal.confidence >= 8 ? "text-emerald-400" : signal.confidence >= 5 ? "text-amber-400" : "text-slate-400"
                      }`}>
                        Confidence: {signal.confidence}/10
                      </span>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-black font-bold"
                        onClick={() => openPitchModal(signal)}
                      >
                        📨 Draft Pitch
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : signalsData?.type === "empty" ? (
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] p-6 text-center">
            <Radio className="h-8 w-8 text-slate-600 mx-auto mb-2 animate-pulse" />
            <p className="text-slate-400 text-sm font-medium">Scanner running. First signals appear within 24h.</p>
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all" as const, label: "All", count: data.candidates.length },
            { key: "hot" as const, label: "🟢 High Availability", count: data.kpi.hot },
            { key: "medium" as const, label: "🟡 Possible", count: data.candidates.filter((c) => c.availability_score >= 5 && c.availability_score < 7).length },
          ].map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={scoreFilter === f.key ? "default" : "outline"}
              onClick={() => setScoreFilter(f.key)}
              className={scoreFilter === f.key
                ? "bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-black font-bold border-0"
                : "border-white/10 text-slate-300 hover:bg-white/5"
              }
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, city, or trade…"
            className="pl-10 bg-[#0a1628] border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-[#00d4ff]/40"
          />
        </div>

        {/* Trade Filter Chips */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "all", label: "All" },
            { key: "boiler", label: "Boiler Operator" },
            { key: "hvac", label: "HVAC" },
            { key: "plumber", label: "Plumber" },
            { key: "electrician", label: "Electrician" },
            { key: "healthcare", label: "Healthcare" },
          ] as const).map((chip) => (
            <button
              key={chip.key}
              onClick={() => setTradeFilter(chip.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tradeFilter === chip.key
                  ? "bg-[#00d4ff] text-black"
                  : "border border-white/10 text-slate-400 hover:bg-white/5"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Sort + Export Row */}
        <div className="flex items-center justify-between gap-3">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
            <SelectTrigger className="w-[180px] bg-[#0a1628] border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1f2e] border-white/10">
              <SelectItem value="score">Highest Score</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="license">Has License</SelectItem>
              <SelectItem value="contact">Has Contact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Universal Export Bar — PDF / CSV / Email / SMS */}
        <RadarExportBar
          radar="talent"
          records={filteredCandidates as any}
          businessName={data?.client?.company_name}
        />

        {/* Candidate List */}
        {filteredCandidates.length === 0 ? (
          <Card className="border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
            <CardContent className="py-12 text-center">
              <IndustryIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">{isHealthcare ? "No candidates found yet" : "No techs found yet"}</p>
              <p className="text-slate-500 text-sm mt-1">We scan daily — new matches will appear here automatically.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCandidates.map((c) => {
              const isExpanded = expandedIds.has(c.id);
              const isUpdating = updatingIds.has(c.id);
              const isClaiming = claimingIds.has(c.id);
              const claimStatus = getClaimStatus(c);
              const isLapsed = c.license_status === "Recently Lapsed";

              const isHighlighted = c.id === highlightId;

              return (
                <Card key={c.id} ref={isHighlighted ? highlightRef : undefined} className={`border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] overflow-hidden transition-all ${
                  c.availability_score >= 7 ? "ring-1 ring-[#00d4ff]/20" : ""
                } ${claimStatus === "mine" ? "ring-1 ring-emerald-500/30" : ""} ${isHighlighted ? "ring-2 ring-[#00d4ff] animate-pulse" : ""}`}>
                  {/* Collapsed header */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      {/* Profile photo or availability label */}
                      {c.profile_photo_url ? (
                        <div className="shrink-0 relative">
                          <img
                            src={c.profile_photo_url}
                            alt={c.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-white/10"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                          />
                          <div className="hidden w-10 h-10 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: c.availability_score >= 8 ? "#059669" : c.availability_score >= 5 ? "#d97706" : "#475569" }}>
                            {c.availability_score >= 8 ? "🟢" : c.availability_score >= 5 ? "🟡" : "🔵"}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center ${scoreBadgeColor(c.availability_score)}`}>
                            {c.availability_score >= 8 ? "🟢" : c.availability_score >= 5 ? "🟡" : "🔵"}
                          </span>
                        </div>
                      ) : (
                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${scoreBadgeColor(c.availability_score)}`}>
                          {c.availability_score >= 8 ? "🟢" : c.availability_score >= 5 ? "🟡" : "🔵"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold text-sm truncate max-w-[200px]">{c.full_name}</p>
                          {/* Social links in header */}
                          {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[#0a66c2] hover:text-blue-400 transition-colors" title="LinkedIn">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                          )}
                          {c.facebook_url && (
                            <a href={c.facebook_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[#1877f2] hover:text-blue-400 transition-colors" title="Facebook">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/20">
                            {c.license_type || (isHealthcare ? "Healthcare" : "Technician")}
                          </Badge>
                          {c.city && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" /> {c.city}
                            </span>
                          )}
                          {isLapsed && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-amber-500/40 text-amber-400 bg-amber-500/5">
                              🔄 {c.license_status}
                            </Badge>
                          )}
                          {c.license_status === "Expiring Soon" && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-yellow-500/40 text-yellow-400 bg-yellow-500/5">
                              ⚠️ Expiring Soon
                            </Badge>
                          )}
                          {c.cross_referenced && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-purple-500/40 text-purple-400 bg-purple-500/5">
                              ⚡ Verified
                            </Badge>
                          )}
                          {claimStatus === "mine" && c.claim_expires_at && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-500/40 text-emerald-400">
                              <Lock className="h-2.5 w-2.5 mr-0.5" /> Claimed · {getClaimTimeLeft(c.claim_expires_at)}
                            </Badge>
                          )}
                          {claimStatus === "other" && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-slate-500/40 text-slate-400">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> 1 company claimed — you'll be notified if they pass
                            </Badge>
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
                    {/* Inline action buttons for score >= 7 */}
                    {c.availability_score >= 7 && claimStatus === "unclaimed" && !isExpanded && (
                      <Button
                        size="sm"
                        onClick={() => claimCandidate(c.id)}
                        disabled={isClaiming}
                        className="shrink-0 h-7 text-[11px] bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-black font-bold"
                      >
                        {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-0.5" />}
                        Claim
                      </Button>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                      {/* Lapsed license warning */}
                      {isLapsed && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-300/80">
                            May be available — worth a check. License lapse can mean job change, relocation, or simply late renewal paperwork.
                          </p>
                        </div>
                      )}

                      {/* Claim button */}
                      {claimStatus === "unclaimed" && c.availability_score >= 5 && (
                        <Button
                          size="sm"
                          onClick={() => claimCandidate(c.id)}
                          disabled={isClaiming}
                          className="w-full bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-black font-bold text-xs"
                        >
                          {isClaiming ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                          ⚡ Claim This Candidate — 48hr Exclusive
                        </Button>
                      )}

                      {/* Contact info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-[#00d4ff] hover:text-[#00d4ff]/80 font-bold text-sm bg-[#00d4ff]/5 rounded-lg px-3 py-2.5 transition-colors border border-[#00d4ff]/10">
                            <Phone className="h-4 w-4" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-[#00d4ff] hover:text-[#00d4ff]/80 font-semibold text-sm bg-[#00d4ff]/5 rounded-lg px-3 py-2.5 transition-colors border border-[#00d4ff]/10">
                            <Mail className="h-4 w-4" /> {c.email}
                          </a>
                        )}
                      </div>

                      {/* Professional details */}
                      <div className="space-y-2 text-sm">
                        {c.current_employer && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            <span className="truncate"><strong className="truncate max-w-[150px] inline-block align-bottom">{c.current_employer}</strong>{c.current_title ? ` · ${c.current_title}` : ""}</span>
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
                        <div className="flex gap-3">
                          {c.linkedin_url && (
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:text-blue-400 text-xs font-semibold flex items-center gap-1 bg-[#0a66c2]/5 rounded-lg px-3 py-2 border border-[#0a66c2]/10">
                              <ExternalLink className="h-3 w-3" /> LinkedIn
                            </a>
                          )}
                          {c.facebook_url && (
                            <a href={c.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[#1877f2] hover:text-blue-400 text-xs font-semibold flex items-center gap-1 bg-[#1877f2]/5 rounded-lg px-3 py-2 border border-[#1877f2]/10">
                              <ExternalLink className="h-3 w-3" /> Facebook
                            </a>
                          )}
                        </div>
                      )}

                      {/* Qualifications & Recommendation */}
                      {c.qualifications_summary && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Qualifications</p>
                          <p className="text-slate-300 text-xs leading-relaxed line-clamp-6">{c.qualifications_summary}</p>
                        </div>
                      )}
                      {c.hiring_recommendation && (
                        <div className="bg-[#00d4ff]/5 border border-[#00d4ff]/20 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-[#00d4ff] uppercase tracking-wide mb-1">Recommendation</p>
                          <p className="text-slate-300 text-xs leading-relaxed line-clamp-6">{c.hiring_recommendation}</p>
                        </div>
                      )}

                      {/* Tangible Proof — flight risk classification */}
                      {c.flight_risk_proof && (
                        <div className={
                          c.flight_risk === "high_flight_risk"
                            ? "bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
                            : c.flight_risk === "hard_to_poach"
                            ? "bg-slate-500/10 border border-slate-500/30 rounded-lg p-3"
                            : "bg-slate-500/5 border border-slate-500/20 rounded-lg p-3"
                        }>
                          <p className={
                            c.flight_risk === "high_flight_risk"
                              ? "text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-1"
                              : "text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1"
                          }>Tangible Proof</p>
                          <p className="text-slate-300 text-xs leading-relaxed">{c.flight_risk_proof}</p>
                        </div>
                      )}

                      {/* Item 3 + 5 — HIBP cyber hygiene + urgency decay window */}
                      <CandidateRiskBadges
                        cyber_hygiene_score={c.cyber_hygiene_score}
                        employer_domain_breached_recently={c.employer_domain_breached_recently}
                        password_compromised={c.password_compromised}
                        license_expiry={c.license_expiry}
                        urgency_score={c.urgency_score}
                        available_until={c.available_until}
                      />

                      {c.score_reason && (
                        <p className="text-[11px] text-slate-500 italic">{c.score_reason}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1 flex-wrap">
                        {c.phone && c.client_action !== "hired" && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold"
                            disabled={fastTrackingId === c.id}
                            onClick={() => fastTrackInterview(c.id)}
                          >
                            {fastTrackingId === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CalendarCheck className="h-3 w-3 mr-1" />}
                            ⚡ Fast-Track Interview
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs"
                          disabled={generatingDraft === c.id}
                          onClick={() => generateOutreach(c.id)}
                        >
                          {generatingDraft === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                          ✍️ Draft Outreach
                        </Button>
                        {c.client_action !== "contacted" && c.client_action !== "interviewed" && c.client_action !== "hired" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-slate-300 hover:bg-white/5 text-xs"
                            disabled={isUpdating}
                            onClick={() => updateAction(c.id, "contacted")}
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
                            Mark Contacted
                          </Button>
                        )}
                        {(c.client_action === "contacted") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10 text-xs"
                            disabled={isUpdating}
                            onClick={() => updateAction(c.id, "interviewed")}
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CalendarCheck className="h-3 w-3 mr-1" />}
                            Mark Interviewed
                          </Button>
                        )}
                        {c.client_action !== "hired" && (
                          <Button
                            size="sm"
                            className="text-xs text-white bg-emerald-600 hover:bg-emerald-700"
                            disabled={isUpdating}
                            onClick={() => updateAction(c.id, "hired")}
                          >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                            Mark Hired
                          </Button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-600">
                        Identified {(() => {
                          const days = Math.floor((Date.now() - new Date(c.alerted_at).getTime()) / (1000 * 60 * 60 * 24));
                          return days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
                        })()}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Add-on Suite — bundle discount for TechAlert clients */}
        <Card className="border-[#00d4ff]/20 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-[#00d4ff]" />
              <p className="text-white font-bold text-sm">Add-Ons — 20% Off for TechAlert Clients</p>
              <span className="ml-auto text-[10px] font-bold text-[#00d4ff] bg-[#00d4ff]/10 border border-[#00d4ff]/30 px-2 py-0.5 rounded-full">Bundle pricing</span>
            </div>
            <p className="text-slate-500 text-[11px] mb-4">All products below are 20% off when added to your existing TechAlert plan.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: "Contractor Lead Gen", tagline: "Exclusive homeowner leads in your trade + city", price: 319, was: 399, path: "/contractor-leads" },
                { name: "FieldDesk CRM", tagline: "Dispatch board + mobile tech app — replaces eWay", price: 159, was: 199, path: "/field-service" },
                { name: "Missed Call Text-Back", tagline: "Auto-texts callers who hit voicemail in 5 seconds", price: 79, was: 99, path: "/missed-call-catch" },
                { name: "Growth Radar", tagline: "Daily industrial expansion signals — SAM.gov + permits", price: 159, was: 199, path: "/industry-pulse" },
                { name: "Estimate Follow-Up Drip", tagline: "Auto-texts quotes that didn't book within 48 hrs", price: 31, was: 39, path: "/estimate-followup" },
                { name: "Seasonal Promo Blaster", tagline: "Auto-text past customers when seasons change", price: 23, was: 29, path: "/seasonal-promo" },
              ].map(a => (
                <div key={a.name} className="bg-[#030711]/60 border border-white/5 rounded-lg p-3 hover:border-[#00d4ff]/20 transition-colors">
                  <p className="text-white text-xs font-bold mb-0.5">{a.name}</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed mb-2">{a.tagline}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-white/30 line-through text-[10px]">${a.was}/mo</span>
                    <span className="text-[#00d4ff] font-black text-base">${a.price}</span>
                    <span className="text-white/40 text-[10px]">/mo</span>
                    <span className="text-emerald-400 text-[10px] ml-auto">save ${a.was - a.price}/mo</span>
                  </div>
                  <a href={`${a.path}?bundle=techalert`} className="block text-center text-[10px] font-bold text-[#00d4ff] border border-[#00d4ff]/30 rounded py-1 hover:bg-[#00d4ff]/10 transition-colors">Add →</a>
                </div>
              ))}
            </div>
            {isHealthcare && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-3">
                <Heart className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-bold text-xs mb-0.5">Refer a Partner Facility — Get 1 Month Free</p>
                  <p className="text-slate-500 text-[10px] mb-2">Know another Director of Nursing or facility administrator struggling with staffing?</p>
                  <a href="mailto:matt@detroitwebagent.com?subject=Talent%20Radar%20Referral" className="text-[10px] font-bold text-blue-400 border border-blue-500/30 rounded px-3 py-1 hover:bg-blue-500/10 transition-colors">Refer Now →</a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t border-white/5">
          <p className="text-slate-600 text-[11px]">
            Powered by Detroit Web Agency · <a href="tel:+13139921219" className="text-[#00d4ff] hover:underline">(313) 992-1219</a>
          </p>
          <p className="text-slate-700 text-[10px] mt-1">Reply to any alert email to adjust your target roles or zip codes</p>
        </div>
      </div>

      {/* Outreach Draft Modal */}
      {outreachModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOutreachModal(null)}>
          <div className="bg-gradient-to-br from-[#0a1628] to-[#0d1f2e] rounded-xl border border-white/10 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" />
                {outreachModal.isPitch ? "Talent Radar Pitch Drafts" : "Outreach Drafts"}
              </h3>
              <button onClick={() => setOutreachModal(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Text Message */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">📱 Text Message</p>
                <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white h-7"
                  onClick={() => copyToClipboard(outreachModal.draft.text_message, "Text message")}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{outreachModal.draft.text_message}</p>
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[#00d4ff] uppercase tracking-wide">✉️ Email</p>
                <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white h-7"
                  onClick={() => copyToClipboard(`Subject: ${outreachModal.draft.email_subject}\n\n${outreachModal.draft.email_body}`, "Email")}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <p className="text-[#00d4ff]/80 text-xs font-semibold mb-2">Subject: {outreachModal.draft.email_subject}</p>
                <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{outreachModal.draft.email_body}</p>
              </div>
            </div>

            {/* Regenerate */}
            {!outreachModal.isPitch && (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs mb-3"
                onClick={() => { setOutreachModal(null); generateOutreach(outreachModal.candidateId); }}
              >
                🔄 Regenerate Drafts
              </Button>
            )}

            {/* TCPA Notice */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-[10px] text-amber-400/80 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {outreachModal.draft.tcpa_notice || "Copy-paste and send from your phone. Do not text numbers on your internal do-not-contact list."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
