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

const SCALE_CONFIG: Record<string, { labels: string[]; emojis: string[] }> = {
  sleepQuality: {
    labels: ["Awful", "Poor", "OK", "Good", "Great"],
    emojis: ["😫", "😕", "😐", "😊", "😴"],
  },
  soreness: {
    labels: ["None", "Mild", "Moderate", "Sore", "Wrecked"],
    emojis: ["✅", "🟡", "🟠", "🔴", "💀"],
  },
  energy: {
    labels: ["Dead", "Low", "Decent", "Good", "Wired"],
    emojis: ["🪫", "😮‍💨", "👍", "💪", "⚡"],
  },
};

const ScaleSelector = ({
  label,
  icon: Icon,
  field,
  value,
  onSelect,
}: {
  label: string;
  icon: React.ElementType;
  field: string;
  value: number | null;
  onSelect: (v: number) => void;
}) => {
  const config = SCALE_CONFIG[field];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(value === n ? 0 : n)}
            className={cn(
              "flex-1 h-10 rounded-full text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1",
              value === n
                ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)] scale-105"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
            title={config.labels[n - 1]}
          >
            <span className="text-xs">{config.emojis[n - 1]}</span>
          </button>
        ))}
      </div>
      {value && value > 0 && (
        <span className="text-[11px] text-primary font-medium pl-1">{config.labels[value - 1]}</span>
      )}
    </div>
  );
};

const RecoveryInput = ({ value, onChange }: RecoveryInputProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasData =
    value.sleepHours !== "" ||
    (value.sleepQuality !== null && value.sleepQuality > 0) ||
    (value.soreness !== null && value.soreness > 0) ||
    (value.energy !== null && value.energy > 0);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-card to-card/80 overflow-hidden shadow-lg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            hasData ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
          )}>
            <Activity size={16} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground block">How do you feel?</span>
            {hasData && !expanded && (
              <div className="flex gap-1.5 mt-1">
                {value.sleepHours && (
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{value.sleepHours}h sleep</span>
                )}
                {value.energy && value.energy > 0 && (
                  <span className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
                    {SCALE_CONFIG.energy.emojis[value.energy - 1]} Energy
                  </span>
                )}
                {value.soreness && value.soreness > 0 && (
                  <span className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
                    {SCALE_CONFIG.soreness.emojis[value.soreness - 1]} Sore
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.05] pt-4">
          {/* Sleep hours */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Hours Slept</span>
            </div>
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              placeholder="e.g. 7.5"
              value={value.sleepHours}
              onChange={(e) => onChange({ ...value, sleepHours: e.target.value })}
              className="bg-background/60 border border-white/[0.08] rounded-xl text-center font-mono text-primary text-sm focus:ring-2 focus:ring-primary/40 outline-none h-12 w-28 transition-all"
            />
          </div>

          <ScaleSelector
            label="Sleep Quality"
            icon={Moon}
            field="sleepQuality"
            value={value.sleepQuality}
            onSelect={(v) => onChange({ ...value, sleepQuality: v || null })}
          />

          <ScaleSelector
            label="Soreness"
            icon={Activity}
            field="soreness"
            value={value.soreness}
            onSelect={(v) => onChange({ ...value, soreness: v || null })}
          />

          <ScaleSelector
            label="Energy"
            icon={Zap}
            field="energy"
            value={value.energy}
            onSelect={(v) => onChange({ ...value, energy: v || null })}
          />

          <textarea
            placeholder="Anything else? (optional)"
            value={value.recoveryNotes}
            onChange={(e) => onChange({ ...value, recoveryNotes: e.target.value })}
            className="w-full bg-background/60 border border-white/[0.08] rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/40 outline-none min-h-[48px] resize-none transition-all"
          />
        </div>
      )}
    </div>
  );
};

export default RecoveryInput;
