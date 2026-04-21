// ContractorOnboardingStatus — public page contractors visit after Stripe
// checkout to see whether their account is "Payment pending" or "Ready", with
// a clear explanation of when their welcome SMS will arrive.
// Lookup by ?email=... or ?contractor_id=...
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface StatusResponse {
  status: "payment_pending" | "ready" | "blocked" | "unknown";
  ready: boolean;
  headline: string;
  explanation: string;
  contractor: {
    business_name: string;
    trade: string;
    city: string;
    phone_masked: string | null;
    onboarded_at: string | null;
  } | null;
  attempts: { slot: number; status: string; twilio_status: string | null; sent_at: string }[];
  last_audit_outcome: string | null;
}

const SLOT_LABEL: Record<number, string> = {
  0: "Welcome (within 5 min)",
  1: "Day 3 status",
  2: "Day 7 recap",
};

function statusBadge(s: string) {
  if (s === "ready") return { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400", icon: "✅" };
  if (s === "payment_pending") return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", icon: "⏳" };
  if (s === "blocked") return { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-400", icon: "⛔" };
  return { bg: "bg-white/5", border: "border-white/20", text: "text-white/70", icon: "❓" };
}

function attemptBadge(s: string) {
  if (s === "delivered") return { text: "text-emerald-400", label: "Delivered" };
  if (s === "sent") return { text: "text-cyan-400", label: "Sent" };
  if (s === "queued") return { text: "text-amber-400", label: "Queued" };
  if (s === "failed") return { text: "text-red-400", label: "Failed" };
  if (s === "skipped") return { text: "text-white/50", label: "Skipped" };
  return { text: "text-white/50", label: s };
}

export default function ContractorOnboardingStatus() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const contractorId = params.get("contractor_id") || params.get("cid") || "";

  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  async function load() {
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (contractorId) qs.set("contractor_id", contractorId);
      else if (email) qs.set("email", email);
      else { setErr("Missing ?email=... or ?contractor_id=... in the URL."); setLoading(false); return; }

      const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
      const url = `https://${projectRef}.supabase.co/functions/v1/contractor-onboarding-status?${qs.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || "Lookup failed");
      setData(json as StatusResponse);
    } catch (e: any) {
      setErr(e?.message || "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [email, contractorId]);

  // Auto-refresh every 15s while payment is still pending — usually clears under a minute
  useEffect(() => {
    if (!data || data.status !== "payment_pending") return;
    if (polls >= 20) return; // stop after ~5 minutes
    const t = setTimeout(() => { setPolls((p) => p + 1); load(); }, 15000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [data, polls]);

  const badge = data ? statusBadge(data.status) : statusBadge("unknown");

  return (
    <div className="min-h-screen bg-[#0a1628] text-white py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <p className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold">Detroit Web Agency</p>
          <h1 className="text-2xl font-bold mt-1">Onboarding status</h1>
        </div>

        {loading && <div className="text-white/60">Checking your status…</div>}

        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
            {err}<br />
            <span className="text-white/60 text-xs">Text Matt at (313) 992-1219 if this keeps happening.</span>
          </div>
        )}

        {data && (
          <>
            <div className={`${badge.bg} ${badge.border} border rounded-xl p-6 mb-4`}>
              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${badge.text}`}>
                <span>{badge.icon}</span>
                <span>{data.status.replace("_", " ")}</span>
              </div>
              <h2 className="text-2xl font-bold mt-2">{data.headline}</h2>
              <p className="text-white/70 text-sm mt-3 leading-relaxed">{data.explanation}</p>
              {data.status === "payment_pending" && (
                <div className="mt-4 text-xs text-white/50">
                  Auto-refreshing every 15 seconds… {polls > 0 && `(checked ${polls + 1}×)`}
                </div>
              )}
            </div>

            {data.contractor && (
              <div className="bg-[#0d1f3c] border border-white/10 rounded-lg p-4 mb-4 text-sm">
                <div className="text-white/50 text-xs uppercase tracking-wide mb-2">On file</div>
                <div className="font-bold">{data.contractor.business_name}</div>
                <div className="text-white/60 text-xs mt-1">
                  {data.contractor.trade} · {data.contractor.city}
                </div>
                {data.contractor.phone_masked && (
                  <div className="text-white/60 text-xs mt-1">
                    Texts going to {data.contractor.phone_masked}
                  </div>
                )}
              </div>
            )}

            {data.attempts.length > 0 && (
              <div className="bg-[#0d1f3c] border border-white/10 rounded-lg p-4 mb-4">
                <div className="text-white/50 text-xs uppercase tracking-wide mb-3">Welcome SMS schedule</div>
                <div className="space-y-2">
                  {[0, 1, 2].map((slot) => {
                    const a = data.attempts.find((x) => x.slot === slot);
                    if (!a) {
                      return (
                        <div key={slot} className="flex items-center justify-between text-sm">
                          <div className="text-white/60">{SLOT_LABEL[slot]}</div>
                          <div className="text-white/30 text-xs">Pending</div>
                        </div>
                      );
                    }
                    const ab = attemptBadge(a.status);
                    return (
                      <div key={slot} className="flex items-center justify-between text-sm">
                        <div className="text-white/80">{SLOT_LABEL[slot]}</div>
                        <div className={`text-xs font-mono ${ab.text}`}>{ab.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-center text-xs text-white/40 mt-6">
              Questions? Text Matt at <a href="tel:+13139921219" className="text-[#00d4ff]">(313) 992-1219</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
