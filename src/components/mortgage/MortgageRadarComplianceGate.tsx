import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export interface ComplianceState {
  dob: string;
  tcpaConsent: boolean;
  manualAck: boolean;
}

interface Props {
  value: ComplianceState;
  onChange: (next: ComplianceState) => void;
}

export default function MortgageRadarComplianceGate({ value, onChange }: Props) {
  const [touched, setTouched] = useState(false);

  const ageOk = (() => {
    if (!value.dob) return false;
    const dob = new Date(value.dob);
    if (Number.isNaN(dob.getTime())) return false;
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    return age >= 18;
  })();

  return (
    <div className="rounded-2xl border-2 border-[#00d4ff]/40 bg-[#0a1628] p-6 max-w-3xl mx-auto mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-[#00d4ff]" />
        <h3 className="text-lg font-bold text-white">Required compliance — read before you check out</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="dob" className="text-sm text-white font-semibold">
            Date of birth <span className="text-red-400">*</span>
          </Label>
          <p className="text-[11px] text-[#64748b] mb-1">Required by Michigan HB 4388 age-verification mandate.</p>
          <Input
            id="dob"
            type="date"
            value={value.dob}
            onChange={(e) => {
              setTouched(true);
              onChange({ ...value, dob: e.target.value });
            }}
            className="bg-[#030711] border-[#1e3a5f] text-white max-w-xs"
          />
          {touched && value.dob && !ageOk && (
            <p className="text-xs text-red-400 mt-1">You must be 18 or older.</p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={value.tcpaConsent}
            onCheckedChange={(c) => onChange({ ...value, tcpaConsent: c === true })}
            className="mt-1 border-[#00d4ff] data-[state=checked]:bg-[#00d4ff] data-[state=checked]:text-black"
          />
          <span className="text-xs text-[#cbd5e1] leading-relaxed">
            <strong className="text-white">SMS consent (A2P 10DLC / TCPA):</strong> By providing my phone number and clicking Start,
            I agree to receive recurring SMS messages from Detroit Web Agency / Mortgage Radar
            regarding lead alerts, account updates, and digests at the number provided.
            Message and data rates may apply. Message frequency varies. Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for help.
            See <a href="/privacy" className="text-[#00d4ff] underline">Privacy Policy</a> and <a href="/terms" className="text-[#00d4ff] underline">Terms</a>.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={value.manualAck}
            onCheckedChange={(c) => onChange({ ...value, manualAck: c === true })}
            className="mt-1 border-[#00d4ff] data-[state=checked]:bg-[#00d4ff] data-[state=checked]:text-black"
          />
          <span className="text-xs text-[#cbd5e1] leading-relaxed">
            <strong className="text-white">Manual-only outreach acknowledgment:</strong> I understand all outreach to leads must be
            manually reviewed and sent by me as a licensed loan officer. Mortgage Radar does not auto-dial,
            auto-send, or auto-text on my behalf — per TCPA and Michigan SB 351 autodialer rules.
          </span>
        </label>
      </div>
    </div>
  );
}

export function isComplianceComplete(c: ComplianceState): boolean {
  if (!c.dob || !c.tcpaConsent || !c.manualAck) return false;
  const dob = new Date(c.dob);
  if (Number.isNaN(dob.getTime())) return false;
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age >= 18;
}
