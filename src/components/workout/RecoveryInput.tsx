import { useState } from "react";
import { ChevronDown, Moon, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecoveryData {
  sleepHours: string;
  sleepQuality: number | null;
  soreness: number | null;
  energy: number | null;
  recoveryNotes: string;
}

interface RecoveryInputProps {
  value: RecoveryData;
  onChange: (data: RecoveryData) => void;
}

const SCALE_LABELS: Record<string, string[]> = {
  sleepQuality: ["Awful", "Poor", "OK", "Good", "Great"],
  soreness: ["None", "Mild", "Moderate", "Sore", "Wrecked"],
  energy: ["Dead", "Low", "Decent", "Good", "Wired"],
};

const ScaleSelector = ({
  label,
  icon: Icon,
  field,
  value,
  onSelect,
  labels,
}: {
  label: string;
  icon: React.ElementType;
  field: string;
  value: number | null;
  onSelect: (v: number) => void;
  labels: string[];
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <Icon size={12} className="text-muted-foreground" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(value === n ? 0 : n)}
          className={cn(
            "flex-1 h-7 text-[10px] font-mono font-bold transition-all",
            value === n
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
          title={labels[n - 1]}
        >
          {n}
        </button>
      ))}
    </div>
    {value && value > 0 && (
      <span className="text-[9px] text-muted-foreground font-mono">{labels[value - 1]}</span>
    )}
  </div>
);

const RecoveryInput = ({ value, onChange }: RecoveryInputProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasData =
    value.sleepHours !== "" ||
    (value.sleepQuality !== null && value.sleepQuality > 0) ||
    (value.soreness !== null && value.soreness > 0) ||
    (value.energy !== null && value.energy > 0);

  return (
    <div className="border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={cn(hasData ? "text-primary" : "text-muted-foreground")} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            How do you feel?
          </span>
          {hasData && !expanded && (
            <span className="text-[9px] font-mono text-primary">
              {value.sleepHours && `${value.sleepHours}h`}
              {value.energy && value.energy > 0 ? ` · E${value.energy}` : ""}
              {value.soreness && value.soreness > 0 ? ` · S${value.soreness}` : ""}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Sleep hours */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Moon size={12} className="text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Sleep
              </span>
            </div>
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              placeholder="Hours slept"
              value={value.sleepHours}
              onChange={(e) => onChange({ ...value, sleepHours: e.target.value })}
              className="bg-background border border-border text-right pr-2 font-mono text-primary text-sm focus:ring-1 focus:ring-primary outline-none h-8 w-24"
            />
          </div>

          <ScaleSelector
            label="Sleep Quality"
            icon={Moon}
            field="sleepQuality"
            value={value.sleepQuality}
            onSelect={(v) => onChange({ ...value, sleepQuality: v || null })}
            labels={SCALE_LABELS.sleepQuality}
          />

          <ScaleSelector
            label="Soreness"
            icon={Activity}
            field="soreness"
            value={value.soreness}
            onSelect={(v) => onChange({ ...value, soreness: v || null })}
            labels={SCALE_LABELS.soreness}
          />

          <ScaleSelector
            label="Energy"
            icon={Zap}
            field="energy"
            value={value.energy}
            onSelect={(v) => onChange({ ...value, energy: v || null })}
            labels={SCALE_LABELS.energy}
          />

          <textarea
            placeholder="Anything else? (optional)"
            value={value.recoveryNotes}
            onChange={(e) => onChange({ ...value, recoveryNotes: e.target.value })}
            className="w-full bg-background border border-border p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none min-h-[40px] resize-none"
          />
        </div>
      )}
    </div>
  );
};

export default RecoveryInput;
