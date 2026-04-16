import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { toast } from "sonner";
import { Zap, Loader2, CheckCircle2, Download, UserX, Lock } from "lucide-react";
import DemoModeBadge, { DEMO_MASTER_TOKEN, isDemoMode } from "@/components/DemoModeBadge";

interface Assignment {
  id: string;
  status: string;
  signal_strength: string | null;
  delivered_at: string;
  interview_booked_at: string | null;
  ghosted_at?: string | null;
  charge_amount_cents: number | null;
  candidate: {
    name: string;
    role?: string;
    licensed_role?: string;
    county?: string;
    city?: string;
  } | null;
}

// Hardcoded demo data for sales pitches — no DB calls, safe for Zoom
const DEMO_AGENCY = {
  agency_name: "Demo Staffing Co",
  vertical: "industrial",
  territory_counties: ["Wayne", "Oakland", "Macomb", "Washtenaw"],
  pricing_model: "performance",
  fast_track_credits: 1,
  demand_radar_access: true,
};
const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: "demo-1", status: "delivered", signal_strength: "exceptional",
    delivered_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    interview_booked_at: null, charge_amount_cents: null,
    candidate: { name: "John M.", licensed_role: "1st Class Boiler Operator", county: "Wayne" },
  },
  {
    id: "demo-2", status: "delivered", signal_strength: "exceptional",
    delivered_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    interview_booked_at: null, charge_amount_cents: null,
    candidate: { name: "Marcus T.", licensed_role: "HVAC Journeyman", county: "Wayne" },
  },
  {
    id: "demo-3", status: "delivered", signal_strength: "strong",
    delivered_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    interview_booked_at: null, charge_amount_cents: null,
    candidate: { name: "David L.", licensed_role: "Master Electrician", county: "Oakland" },
  },
  {
    id: "demo-4", status: "interview_booked", signal_strength: "strong",
    delivered_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    interview_booked_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    charge_amount_cents: 25000,
    candidate: { name: "Robert K.", licensed_role: "Stationary Engineer", county: "Macomb" },
  },
];

export default function AgencyPortal() {
  const [params] = useSearchParams();
  const agencyId = params.get("id") || "";
  const token = params.get("token");
  const isWelcome = params.get("welcome") === "1";
  const demoMode = isDemoMode(token);

  const [agency, setAgency] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [ghostingId, setGhostingId] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) {
      setAgency(DEMO_AGENCY);
      setAssignments(DEMO_ASSIGNMENTS);
      setLoading(false);
      return;
    }
    if (isWelcome) toast.success("Welcome! Your feed is now active.");
    if (!agencyId) { setLoading(false); return; }
    load();
  }, [agencyId, demoMode]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: a } = await supabase
        .from("staffing_agency_clients")
        .select("*")
        .eq("id", agencyId)
        .maybeSingle();
      setAgency(a);

      const { data: rows } = await supabase
        .from("agency_candidate_assignments")
        .select("id, status, signal_strength, delivered_at, interview_booked_at, ghosted_at, charge_amount_cents, candidate:hire_alert_candidates(name, license_type, county, city)")
        .eq("agency_id", agencyId)
        .order("delivered_at", { ascending: false })
        .limit(50);
      setAssignments((rows as any[])?.map((r: any) => ({
        ...r,
        candidate: r.candidate ? { name: r.candidate.name, licensed_role: r.candidate.license_type, county: r.candidate.county || r.candidate.city } : null,
      })) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fastTrack = async (id: string) => {
    setTrackingId(id);
    try {
      if (demoMode) {
        await new Promise(r => setTimeout(r, 600));
        toast.success("DEMO MODE — interview logged (no charge, no SMS)");
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: "interview_booked", interview_booked_at: new Date().toISOString(), charge_amount_cents: 25000 } : a));
        return;
      }
      const { data, error } = await supabase.functions.invoke("agency-fast-track-interview", {
        body: { assignment_id: id, agency_id: agencyId },
      });
      if (error) throw error;
      if (data?.error === "already_claimed") {
        toast.error("Another agency claimed this candidate first.");
      } else {
        toast.success(data?.credit_burned ? "Interview logged — ghost credit burned (free)" : data?.charged ? "Interview logged + $250 charged" : "Interview logged");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setTrackingId(null);
    }
  };

  const markGhost = async (id: string) => {
    if (!confirm("Mark this candidate as a no-show? You'll get 1 free Fast-Track credit.")) return;
    setGhostingId(id);
    try {
      if (demoMode) {
        await new Promise(r => setTimeout(r, 500));
        toast.success("DEMO — ghost reported, 1 free credit granted");
        return;
      }
      const { data, error } = await supabase.functions.invoke("agency-mark-ghosted", {
        body: { assignment_id: id, agency_id: agencyId },
      });
      if (error) throw error;
      toast.success(`Ghost reported · ${data?.credits || 1} free credit available`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setGhostingId(null);
    }
  };

  const exportCSV = () => {
    const header = "verification_id,signal_strength,vertical,county,interview_booked_at,status";
    const rows = assignments
      .filter(a => a.interview_booked_at)
      .map(a => [
        a.id.slice(0, 8),
        a.signal_strength || "moderate",
        agency?.vertical || "",
        a.candidate?.county || "",
        a.interview_booked_at,
        a.status,
      ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dwa-talent-signal-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (!demoMode && !agencyId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <div className="text-center text-slate-400">
          <p>No agency ID. Use the link from your welcome email.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
      </div>
    );
  }

  const interviewsThisMonth = assignments.filter(a => {
    if (!a.interview_booked_at) return false;
    const d = new Date(a.interview_booked_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpend = interviewsThisMonth.reduce((s, a) => s + (a.charge_amount_cents || 0), 0);

  return (
    <>
      <SEOHead title="DWA Talent Signal Portal | Detroit Web Agency" description="Pre-market talent intelligence feed" />
      {demoMode && <DemoModeBadge />}
      <div className="min-h-screen" style={{ background: "#0a1628" }}>
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[#00d4ff] text-xs uppercase tracking-wider">DWA Talent Signal · Agency Portal</p>
              <h1 className="text-white text-xl font-bold">{agency?.agency_name || "Your Feed"}</h1>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">{agency?.vertical} · {agency?.territory_counties?.join(", ")}</p>
              <p className="text-slate-400 text-xs mt-0.5 capitalize">{(agency?.pricing_model || "").replace("_", " ")} tier</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-4 gap-4">
          <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Candidates this month</p>
            <p className="text-white text-3xl font-bold">{assignments.length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Interviews booked</p>
            <p className="text-[#00d4ff] text-3xl font-bold">{interviewsThisMonth.length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Spend this month</p>
            <p className="text-white text-3xl font-bold">${(totalSpend / 100).toFixed(0)}</p>
          </div>
          <div className="bg-[#0f1f35] border border-[#00d4ff]/20 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Free Credits</p>
            <p className="text-[#00d4ff] text-3xl font-bold">{agency?.fast_track_credits ?? 0}</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="max-w-6xl mx-auto px-6 pb-2 flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">Talent Feed</h2>
          <button
            onClick={exportCSV}
            disabled={interviewsThisMonth.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f1f35] border border-white/10 text-slate-300 text-sm hover:border-[#00d4ff]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Feed */}
        <div className="max-w-6xl mx-auto px-6 pb-12">
          {assignments.length === 0 ? (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-12 text-center">
              <p className="text-slate-400">No candidates yet. Daily feed runs at 7am ET.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const sig = a.signal_strength || "moderate";
                const sigColor = sig === "exceptional" ? "#00d4ff" : sig === "strong" ? "#06b6d4" : "#475569";
                const isClaimedByOther = a.status === "claimed_by_other";
                const isGhosted = !!a.ghosted_at;
                return (
                  <div key={a.id} className={`bg-[#0f1f35] border rounded-xl p-5 flex items-center justify-between transition-colors ${isClaimedByOther ? "border-white/5 opacity-50" : "border-white/10 hover:border-[#00d4ff]/30"}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-semibold">{a.candidate?.name || "Verified Candidate"}</span>
                        <span style={{ background: `${sigColor}20`, color: sigColor, border: `1px solid ${sigColor}40` }} className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">
                          {sig}
                        </span>
                        {isGhosted && <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">👻 Ghost</span>}
                        {isClaimedByOther && <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-slate-500/20 text-slate-400 border border-slate-500/40 flex items-center gap-1"><Lock className="w-3 h-3" />Claimed</span>}
                      </div>
                      <p className="text-slate-400 text-sm">{a.candidate?.licensed_role || a.candidate?.role || "Skilled Trade"} · {a.candidate?.county || "Metro Detroit"}</p>
                      <p className="text-slate-600 text-xs mt-1">Delivered {new Date(a.delivered_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status === "interview_booked" ? (
                        <>
                          <div className="flex items-center gap-2 text-[#00d4ff] text-sm font-semibold mr-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Booked
                          </div>
                          {!isGhosted && (
                            <button
                              onClick={() => markGhost(a.id)}
                              disabled={ghostingId === a.id}
                              className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              title="Mark as no-show — get 1 free Fast-Track credit"
                            >
                              {ghostingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                              No-Show
                            </button>
                          )}
                        </>
                      ) : isClaimedByOther ? (
                        <div className="text-slate-500 text-xs italic">Claimed by another agency</div>
                      ) : (
                        <button
                          onClick={() => fastTrack(a.id)}
                          disabled={trackingId === a.id}
                          className="px-5 py-2.5 rounded-lg bg-[#00d4ff] text-[#0a1628] font-bold text-sm hover:bg-[#00d4ff]/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {trackingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          Fast-Track Interview {(agency?.fast_track_credits ?? 0) > 0 ? "(Free)" : "$250"}{demoMode ? " — Demo" : ""}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-slate-600 text-xs text-center mt-8">
            DWA Talent Signal · Proprietary multi-source intelligence engine · {assignments.length} candidates this month
            {demoMode && <span className="block mt-1 text-[#00d4ff]">DEMO MODE — All actions sandboxed, no real candidates contacted.</span>}
          </p>
        </div>
      </div>
    </>
  );
}
