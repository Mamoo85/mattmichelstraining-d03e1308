import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Settings, Clock, DollarSign, Percent, MessageSquare, RefreshCw, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TIERS, TierKey } from "@/hooks/useAuth";

interface TrialSettings {
  trial_days: number;
  auto_charge_tier: string;
  early_cancel_discount_pct: number;
  auto_renew_default: boolean;
  tech_support_auto_reply: string;
}

const TIER_OPTIONS: { key: string; label: string; price: string }[] = [
  { key: "foundation", label: "The Foundation", price: "$19.99/mo" },
  { key: "pro", label: "Pro (Semi-Custom)", price: "$149.99/mo" },
  { key: "elite", label: "Elite (1-on-1)", price: "$349.99/mo" },
];

const AdminTrialSettings = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TrialSettings>({
    trial_days: 14,
    auto_charge_tier: "basic",
    early_cancel_discount_pct: 50,
    auto_renew_default: true,
    tech_support_auto_reply: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["trial-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_settings" as any)
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as any as TrialSettings;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        trial_days: settings.trial_days,
        auto_charge_tier: settings.auto_charge_tier,
        early_cancel_discount_pct: settings.early_cancel_discount_pct,
        auto_renew_default: settings.auto_renew_default,
        tech_support_auto_reply: settings.tech_support_auto_reply,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trial_settings" as any)
        .update({
          trial_days: form.trial_days,
          auto_charge_tier: form.auto_charge_tier,
          early_cancel_discount_pct: form.early_cancel_discount_pct,
          auto_renew_default: form.auto_renew_default,
          tech_support_auto_reply: form.tech_support_auto_reply,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["trial-settings"] });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- Active trial users ---
  const { data: trialUsers = [], isLoading: loadingTrials } = useQuery({
    queryKey: ["admin-trial-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, athlete_name, trial_started_at, subscription_tier")
        .not("trial_started_at", "is", null)
        .order("trial_started_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleCancelUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("customer-portal");
      // For admin cancel, we clear trial and set to free
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ subscription_tier: "free" })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["admin-trial-users"] });
      toast({ title: "User subscription cancelled" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-8">
      {/* Settings Panel */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={16} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Trial & Subscription Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trial Duration */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
              <Clock size={12} /> Trial Duration (days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={form.trial_days}
              onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value) || 14 })}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Number of free days before auto-charge kicks in</p>
          </div>

          {/* Auto-charge Tier */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
              <DollarSign size={12} /> Auto-Charge Tier After Trial
            </label>
            <select
              value={form.auto_charge_tier}
              onChange={(e) => setForm({ ...form, auto_charge_tier: e.target.value })}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} — {t.price}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Users are auto-subscribed to this tier when trial ends</p>
          </div>

          {/* Early Cancel Discount */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
              <Percent size={12} /> Early Cancel Discount (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.early_cancel_discount_pct}
              onChange={(e) => setForm({ ...form, early_cancel_discount_pct: parseInt(e.target.value) || 0 })}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Discount offered on first month if user tries to cancel during trial</p>
          </div>

          {/* Auto-Renew */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
              <RefreshCw size={12} /> Auto-Renew Default
            </label>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => setForm({ ...form, auto_renew_default: true })}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  form.auto_renew_default ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                On
              </button>
              <button
                onClick={() => setForm({ ...form, auto_renew_default: false })}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  !form.auto_renew_default ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Off
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">All memberships auto-renew monthly unless cancelled</p>
          </div>
        </div>

        {/* Tech Support Auto-Reply */}
        <div className="mt-6">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
            <MessageSquare size={12} /> AI Tech Support Auto-Reply Message
          </label>
          <textarea
            value={form.tech_support_auto_reply}
            onChange={(e) => setForm({ ...form, tech_support_auto_reply: e.target.value })}
            rows={4}
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground resize-y"
            placeholder="Enter the auto-reply message that the AI tech bot sends..."
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            This message is automatically sent when a user contacts tech support via the app
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Settings
        </button>
      </div>

      {/* Trial Users List */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Trial & Subscription Users</h2>
          <span className="text-[10px] text-muted-foreground ml-auto">{trialUsers.length} users</span>
        </div>

        {loadingTrials ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={16} />
          </div>
        ) : trialUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No trial users yet</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {trialUsers.map((user: any) => {
              const trialStart = user.trial_started_at ? new Date(user.trial_started_at) : null;
              const daysSince = trialStart ? Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)) : 0;
              const trialDaysLeft = Math.max(0, (form.trial_days || 14) - daysSince);
              const isExpired = daysSince >= (form.trial_days || 14);
              const tier = user.subscription_tier || "free";

              return (
                <div key={user.user_id} className="flex items-center justify-between bg-muted p-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">
                      {user.athlete_name || user.full_name || user.email || "Unknown"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {user.email} · Tier: <span className="font-bold text-foreground">{tier}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {isExpired ? (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Trial Expired</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {trialDaysLeft}d left
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelUser(user.user_id)}
                    className="shrink-0 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTrialSettings;
