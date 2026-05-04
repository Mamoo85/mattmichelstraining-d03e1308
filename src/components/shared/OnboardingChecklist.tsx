import { Check, Circle } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

interface Props {
  product: string;
  steps: OnboardingStep[];
  /** localStorage key suffix to remember dismissal */
  storageKey?: string;
}

/**
 * Lightweight onboarding checklist that auto-hides once all steps complete OR user dismisses.
 * Drop into any My*.tsx portal under the hero.
 */
export default function OnboardingChecklist({ product, steps, storageKey }: Props) {
  const allDone = useMemo(() => steps.every((s) => s.done), [steps]);
  const key = `onboarding-dismissed-${storageKey || product}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(key) === "1") {
      setDismissed(true);
    }
  }, [key]);

  if (allDone || dismissed) return null;

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] font-bold mb-1">
            Get the most out of {product}
          </p>
          <p className="text-white font-semibold text-sm">
            {completed} of {steps.length} steps complete · {pct}%
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(key, "1");
            setDismissed(true);
          }}
          className="text-[#64748b] hover:text-white text-xs"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>

      <div className="h-1 bg-[#030711] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-[#00d4ff] transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            {s.done ? (
              <Check className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-[#475569] mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm ${s.done ? "text-[#64748b] line-through" : "text-white"}`}>
                {s.label}
              </p>
              {!s.done && s.hint && <p className="text-xs text-[#94a3b8] mt-0.5">{s.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
