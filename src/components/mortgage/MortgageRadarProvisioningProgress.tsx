import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  "Securing your ZIP codes (ZIP-exclusive lock)",
  "Provisioning your private dashboard",
  "Scanning permits, FSBO, foreclosures, divorces in your ZIPs",
  "Drafting your first AI-suggested openers",
];

interface Props {
  email?: string;
  onComplete?: () => void;
}

export default function MortgageRadarProvisioningProgress({ email, onComplete }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1800);
    return () => clearTimeout(t);
  }, [step, onComplete]);

  return (
    <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a1628] p-6 text-left mb-6">
      <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold mb-3">
        Setting up your account{email ? ` for ${email}` : ""}
      </p>
      <ul className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : active ? (
                <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-[#1e3a5f] flex-shrink-0" />
              )}
              <span className={`text-sm ${done ? "text-emerald-300" : active ? "text-white font-semibold" : "text-[#64748b]"}`}>
                {label}
              </span>
              {active && (
                <div className="ml-auto h-1.5 w-24 bg-[#1e3a5f] rounded overflow-hidden">
                  <div className="h-full bg-[#00d4ff] animate-pulse" style={{ width: "60%" }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {step >= STEPS.length && (
        <p className="text-xs text-emerald-300 mt-4 font-semibold">
          ✓ All set. Your dashboard link was emailed to you.
        </p>
      )}
    </div>
  );
}
