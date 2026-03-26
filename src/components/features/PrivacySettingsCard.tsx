import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

interface PrivacySettings {
  show_name: boolean;
  show_points: boolean;
  show_level: boolean;
  show_lifts: boolean;
  show_challenges: boolean;
  show_nutrition: boolean;
  show_streaks: boolean;
  show_programs: boolean;
}

const SETTINGS_CONFIG = [
  { key: "show_name" as const, label: "Name", desc: "Your real name visible to other athletes (Matt always sees it)" },
  { key: "show_points" as const, label: "Points", desc: "Your total points visible on leaderboards" },
  { key: "show_level" as const, label: "Level & Rank", desc: "Your level badge visible to other athletes" },
  { key: "show_lifts" as const, label: "Lift Stats", desc: "Top lifts and PRs visible on your profile" },
  { key: "show_challenges" as const, label: "Challenge Scores", desc: "Monthly challenge & focus entries — on by default" },
  { key: "show_nutrition" as const, label: "Nutrition Data", desc: "Meal logs and macro summaries" },
  { key: "show_streaks" as const, label: "Streaks", desc: "Weekly workout streak count" },
  { key: "show_programs" as const, label: "Programs", desc: "Active programs and training history" },
];

const PrivacySettingsCard = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Try to fetch existing settings
      const { data, error } = await supabase
        .from("user_privacy_settings" as any)
        .select("show_name, show_points, show_level, show_lifts, show_challenges, show_nutrition, show_streaks, show_programs")
        .eq("user_id", user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // No row exists yet, create one with defaults
        const { data: newRow } = await supabase
          .from("user_privacy_settings" as any)
          .insert({ user_id: user.id } as any)
          .select("show_name, show_points, show_level, show_lifts, show_challenges, show_nutrition, show_streaks, show_programs")
          .single();
        if (newRow) setSettings(newRow as any);
      } else if (data) {
        setSettings(data as any);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleToggle = async (key: keyof PrivacySettings) => {
    if (!user || !settings) return;
    const newValue = !settings[key];
    setSaving(key);

    // Optimistic update
    setSettings((prev) => prev ? { ...prev, [key]: newValue } : prev);

    const { error } = await supabase
      .from("user_privacy_settings" as any)
      .update({ [key]: newValue } as any)
      .eq("user_id", user.id);

    if (error) {
      // Revert
      setSettings((prev) => prev ? { ...prev, [key]: !newValue } : prev);
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    } else {
      // Also sync points visibility to user_points table for backwards compat
      if (key === "show_points") {
        await supabase.rpc("toggle_points_visibility", { _is_public: newValue });
      }
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border p-5 mb-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!settings) return null;

  const publicCount = Object.values(settings).filter(Boolean).length;
  const totalCount = SETTINGS_CONFIG.length;

  return (
    <div className="bg-card border border-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
          <Shield size={12} /> Privacy Settings
        </h2>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {publicCount === 0 ? <EyeOff size={10} /> : <Eye size={10} />}
          {publicCount}/{totalCount} public
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
        Control which data points are visible to other athletes on leaderboards and public profiles.
      </p>
      <div className="space-y-1">
        {SETTINGS_CONFIG.map((cfg) => {
          const isOn = settings[cfg.key];
          const isSaving = saving === cfg.key;
          return (
            <div
              key={cfg.key}
              className="flex items-center justify-between py-2.5 px-3 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-xs font-bold text-foreground">{cfg.label}</p>
                <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isOn ? "text-primary" : "text-muted-foreground"}`}>
                  {isOn ? "Public" : "Private"}
                </span>
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin text-primary" />
                ) : (
                  <Switch
                    checked={isOn}
                    onCheckedChange={() => handleToggle(cfg.key)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrivacySettingsCard;
