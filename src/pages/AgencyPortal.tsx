import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { toast } from "sonner";
import { Zap, Loader2, CheckCircle2, Calendar } from "lucide-react";

interface Assignment {
  id: string;
  status: string;
  signal_strength: string | null;
  delivered_at: string;
  interview_booked_at: string | null;
  charge_amount_cents: number | null;
  candidate: {
    name: string;
    role: string;
    county: string;
  } | null;
}

export default function AgencyPortal() {
  const [params] = useSearchParams();
  const agencyId = params.get("id") || "";
  const isWelcome = params.get("welcome") === "1";

  const [agency, setAgency] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  useEffect(() => {
    if (isWelcome) toast.success("Welcome! Your feed is now active.");
    if (!agencyId) { setLoading(false); return; }
    load();
  }, [agencyId]);

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
        .select("id, status, signal_strength, delivered_at, interview_booked_at, charge_amount_cents, candidate:hire_alert_candidates(name, role, county)")
        .eq("agency_id", agencyId)
        .order("delivered_at", { ascending: false })
        .limit(50);
      setAssignments((rows as any[]) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fastTrack = async (id: string) => {
    setTrackingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("agency-fast-track-interview", {
        body: { assignment_id: id, agency_id: agencyId },
      });
      if (error) throw error;
      toast.success(data?.charged ? "Interview logged + $250 charged" : "Interview logged");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setTrackingId(null);
    }
  };

  if (!agencyId) {
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
      <SEOHead title="Agency Portal | Detroit Web Agency" description="Talent intelligence feed" />
      <div className="min-h-screen" style={{ background: "#0a1628" }}>
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[#00d4ff] text-xs uppercase tracking-wider">Agency Portal</p>
              <h1 className="text-white text-xl font-bold">{agency?.agency_name || "Your Feed"}</h1>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">{agency?.vertical} · {agency?.territory_counties?.join(", ")}</p>
              <p className="text-slate-400 text-xs mt-0.5 capitalize">{(agency?.pricing_model || "").replace("_", " ")} tier</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-3 gap-4">
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
        </div>

        {/* Feed */}
        <div className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-white text-lg font-bold mb-4">Talent Feed</h2>
          {assignments.length === 0 ? (
            <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-12 text-center">
              <p className="text-slate-400">No candidates yet. Daily feed runs at 7am ET.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const sig = a.signal_strength || "moderate";
                const sigColor = sig === "exceptional" ? "#00d4ff" : sig === "strong" ? "#06b6d4" : "#475569";
                return (
                  <div key={a.id} className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 flex items-center justify-between hover:border-[#00d4ff]/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-semibold">{a.candidate?.name || "Verified Candidate"}</span>
                        <span style={{ background: `${sigColor}20`, color: sigColor, border: `1px solid ${sigColor}40` }} className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">
                          {sig}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{a.candidate?.role || "Skilled Trade"} · {a.candidate?.county || "Metro Detroit"}</p>
                      <p className="text-slate-600 text-xs mt-1">Delivered {new Date(a.delivered_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      {a.status === "interview_booked" ? (
                        <div className="flex items-center gap-2 text-[#00d4ff] text-sm font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          Interview Booked
                        </div>
                      ) : (
                        <button
                          onClick={() => fastTrack(a.id)}
                          disabled={trackingId === a.id}
                          className="px-5 py-2.5 rounded-lg bg-[#00d4ff] text-[#0a1628] font-bold text-sm hover:bg-[#00d4ff]/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {trackingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          Fast-Track Interview
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
