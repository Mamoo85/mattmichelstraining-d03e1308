import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Stethoscope, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  candidateId: string;
  candidateName: string;
  initialLicense?: string | null;
  initialState?: string | null;
  initialEnrolled?: boolean;
  onEnrolled?: () => void;
}

const US_STATES = ["MI", "OH", "IN", "IL", "WI", "PA", "NY", "CA", "TX", "FL", "GA", "NC", "TN"];

export default function CandidateLicenseEditor({ candidateId, candidateName, initialLicense, initialState, initialEnrolled, onEnrolled }: Props) {
  const [license, setLicense] = useState(initialLicense || "");
  const [state, setState] = useState(initialState || "MI");
  const [enrolled, setEnrolled] = useState(!!initialEnrolled);
  const [busy, setBusy] = useState(false);

  async function enroll() {
    if (!license.trim()) { toast.error("Enter a license number first"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("nursys-enroll", {
        body: { candidate_id: candidateId, license_number: license.trim(), license_state: state },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Enrollment failed");
      setEnrolled(true);
      toast.success(`✓ ${candidateName} enrolled in Nursys monitoring`);
      onEnrolled?.();
    } catch (e: any) {
      toast.error(e?.message || "Nursys enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap bg-pink-500/5 border border-pink-500/20 rounded px-2 py-1.5">
      <Stethoscope className="w-3 h-3 text-pink-300" />
      <span className="text-[10px] text-pink-200 font-bold uppercase tracking-wider">Nursys</span>
      <select
        value={state}
        onChange={e => setState(e.target.value)}
        disabled={busy || enrolled}
        className="bg-[#0a1628] border border-white/10 rounded text-[10px] px-1 py-0.5 text-slate-200 disabled:opacity-50"
      >
        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input
        type="text"
        value={license}
        onChange={e => setLicense(e.target.value.toUpperCase())}
        placeholder="License #"
        disabled={busy || enrolled}
        maxLength={20}
        className="bg-[#0a1628] border border-white/10 rounded text-[10px] px-1.5 py-0.5 text-slate-200 w-24 font-mono disabled:opacity-50"
      />
      {enrolled ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 flex items-center gap-1 font-semibold">
          <CheckCircle2 className="w-3 h-3" /> Monitored
        </span>
      ) : (
        <button
          onClick={enroll}
          disabled={busy || !license.trim()}
          className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 border border-pink-500/40 text-pink-200 hover:bg-pink-500/30 disabled:opacity-40 flex items-center gap-1 font-semibold"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Enroll
        </button>
      )}
    </div>
  );
}
