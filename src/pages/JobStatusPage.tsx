import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, MapPin, Clock, Wrench, Phone } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

interface JobStatus {
  title: string;
  status: string;
  status_index: number;
  status_count: number;
  tech_name: string | null;
  customer_name: string | null;
  company_name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  eta: string | null;
}

const STAGES = [
  { key: "open",      label: "Scheduled",  icon: Clock },
  { key: "assigned",  label: "Assigned",   icon: Wrench },
  { key: "en_route",  label: "En Route",   icon: MapPin },
  { key: "on_site",   label: "On Site",    icon: CheckCircle2 },
  { key: "completed", label: "Completed",  icon: CheckCircle2 },
];

export default function JobStatusPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("No tracking token provided"); setLoading(false); return; }
    const load = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) throw new Error("Job not found");
        setJob(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    // Auto-refresh every 90 seconds while job is active
    const interval = setInterval(load, 90_000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center px-4">
        <div className="text-center">
          <Wrench className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Tracking Link Expired</h2>
          <p className="text-white/50 text-sm">{error || "This job tracking link is no longer active."}</p>
        </div>
      </div>
    );
  }

  const activeStageIndex = job.status_index;
  const isComplete = job.status === "completed";

  return (
    <>
      <SEOHead
        title={`Job Status — ${job.company_name || "Service Update"}`}
        description="Real-time service job tracking"
      />
      <div className="min-h-screen bg-[#030711] text-white">
        {/* Header */}
        <header className="border-b border-white/5 bg-[#0a1628]/90 backdrop-blur-md py-4 px-4 text-center">
          <p className="text-[10px] text-[#00d4ff] uppercase tracking-widest font-bold mb-0.5">
            {job.company_name || "Service Tracking"}
          </p>
          <h1 className="text-white font-bold text-base">Your Service Update</h1>
        </header>

        <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Job title */}
          <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-5">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Service Request</p>
            <h2 className="text-white font-bold text-lg leading-tight">{job.title}</h2>
            {job.customer_name && (
              <p className="text-white/50 text-sm mt-1">{job.customer_name}</p>
            )}
          </div>

          {/* Status progress */}
          <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-5">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-4">Job Progress</p>
            <div className="space-y-3">
              {STAGES.map((stage, i) => {
                const isDone = i < activeStageIndex;
                const isCurrent = i === activeStageIndex;
                const Icon = stage.icon;
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isDone ? "bg-emerald-500" :
                      isCurrent ? "bg-[#00d4ff] ring-4 ring-[#00d4ff]/20" :
                      "bg-white/5 border border-white/10"
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      ) : (
                        <Icon className={`h-4 w-4 ${isCurrent ? "text-[#0a1628]" : "text-white/20"}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        isDone ? "text-emerald-400" :
                        isCurrent ? "text-white" :
                        "text-white/30"
                      }`}>
                        {stage.label}
                        {isCurrent && !isComplete && (
                          <span className="ml-2 text-[10px] bg-[#00d4ff]/20 text-[#00d4ff] px-2 py-0.5 rounded-full font-normal">
                            Current
                          </span>
                        )}
                      </p>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`absolute left-[2.25rem] w-0.5 h-3 mt-8 ${isDone ? "bg-emerald-500" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ETA / timing */}
          {job.eta && (
            <div className={`border rounded-2xl p-5 ${
              isComplete
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-[#00d4ff]/5 border-[#00d4ff]/20"
            }`}>
              <div className="flex items-center gap-3">
                <Clock className={`h-5 w-5 flex-shrink-0 ${isComplete ? "text-emerald-400" : "text-[#00d4ff]"}`} />
                <div>
                  <p className={`text-sm font-bold ${isComplete ? "text-emerald-400" : "text-[#00d4ff]"}`}>
                    {isComplete ? "Service Complete" : "Timing"}
                  </p>
                  <p className="text-white/70 text-sm mt-0.5">{job.eta}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tech info */}
          {job.tech_name && (
            <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-5">
              <p className="text-[10px] text-white/40 uppercase tracking-wide mb-2">Your Technician</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center">
                  <span className="text-[#00d4ff] font-bold text-base">
                    {job.tech_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-semibold">{job.tech_name}</p>
                  <p className="text-white/40 text-xs">Licensed Technician</p>
                </div>
              </div>
            </div>
          )}

          {/* Questions? */}
          <div className="text-center py-4">
            <p className="text-white/30 text-xs mb-3">Have a question?</p>
            <a
              href="sms:+13139921219"
              className="inline-flex items-center gap-2 bg-[#0f1f35] border border-white/10 rounded-xl px-5 py-3 text-white/70 text-sm hover:border-white/30 transition-colors"
            >
              <Phone className="h-4 w-4 text-[#00d4ff]" />
              Text us at (313) 992-1219
            </a>
          </div>
        </main>

        <footer className="py-6 text-center border-t border-white/5">
          <p className="text-white/20 text-[10px]">Detroit Web Agency · FieldDesk</p>
        </footer>
      </div>
    </>
  );
}
