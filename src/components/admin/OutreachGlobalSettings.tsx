import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Power, Mail, MessageSquare, ShieldAlert, Loader2 } from "lucide-react";

interface Settings {
  cold_email_enabled: boolean;
  cold_sms_enabled: boolean;
  min_quality_score_to_send: number;
  hide_demo_leads_below_score: number;
  updated_at: string;
}

export default function OutreachGlobalSettings({
  onChange,
}: {
  onChange?: (s: Settings) => void;
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("outreach_global_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (data) {
        setS(data);
        onChange?.(data);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(patch: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("outreach_global_settings")
      .update(patch)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange?.(next);
    toast.success("Outreach settings updated");
  }

  if (!s) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> Loading global settings…
      </div>
    );
  }

  return (
    <div className="bg-card border border-amber-700/40 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300">Global Outreach Kill-Switches</h3>
        </div>
        {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>

      <p className="text-[11px] text-muted-foreground -mt-1">
        These flags are enforced server-side by every send pipeline. If a switch is off, sends are blocked and logged with reason "global kill switch".
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Toggle
          icon={<Mail size={13} />}
          label="Cold Email"
          on={s.cold_email_enabled}
          onColor="emerald"
          onChange={v => update({ cold_email_enabled: v })}
          help="CAN-SPAM compliant B2B email blasts."
        />
        <Toggle
          icon={<MessageSquare size={13} />}
          label="Cold SMS"
          on={s.cold_sms_enabled}
          onColor="rose"
          onChange={v => update({ cold_sms_enabled: v })}
          help="Cold SMS is OFF by default. Even when ON, per-prospect consent is still required."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Slider
          label="Min quality score to send"
          value={s.min_quality_score_to_send}
          min={0}
          max={100}
          step={5}
          help="Prospects scoring lower will be skipped and logged."
          onChange={v => update({ min_quality_score_to_send: v })}
        />
        <Slider
          label="Hide demo leads below score"
          value={s.hide_demo_leads_below_score}
          min={0}
          max={100}
          step={5}
          help="UI auto-hides low-confidence prospects flagged as demo records."
          onChange={v => update({ hide_demo_leads_below_score: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  icon, label, on, onColor, onChange, help,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onColor: "emerald" | "rose";
  onChange: (v: boolean) => void;
  help: string;
}) {
  const onClasses = onColor === "emerald"
    ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
    : "bg-rose-500 text-white hover:bg-rose-400";
  return (
    <div className="bg-background/40 border border-border rounded p-3 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          {icon} {label}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{help}</p>
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold ${
          on ? onClasses : "bg-slate-700 text-slate-300 hover:bg-slate-600"
        }`}
      >
        <Power size={10} /> {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, help,
}: {
  label: string; value: number; min: number; max: number; step: number; help: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-background/40 border border-border rounded p-3">
      <div className="flex items-center justify-between text-[11px] font-bold text-foreground mb-1">
        <span>{label}</span>
        <span className="text-cyan-300">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-cyan-500"
      />
      <p className="text-[10px] text-muted-foreground mt-1">{help}</p>
    </div>
  );
}
