import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Save, ShieldCheck, Zap, Star, Users, Loader2, ChevronDown, Pencil, Eye, Copy, Link } from "lucide-react";

const TIERS = [
  { key: "tier_free", label: "Free", icon: Eye, color: "text-muted-foreground" },
  { key: "tier_basic", label: "Basic", icon: Star, color: "text-blue-400" },
  { key: "tier_foundation", label: "Foundation", icon: Zap, color: "text-yellow-400" },
  { key: "tier_custom", label: "Custom", icon: ShieldCheck, color: "text-orange-400" },
  { key: "tier_team_elite", label: "Team/Elite", icon: Users, color: "text-green-400" },
] as const;

type TierKey = typeof TIERS[number]["key"];

const PRESET_FEATURES = [
  { key: "exercise_library", label: "Exercise Library", description: "Access to the full exercise library" },
  { key: "fix_it_library", label: "Fix It Library", description: "Corrective exercise video library" },
  { key: "monthly_focus", label: "Monthly Focus", description: "Monthly training focus plans" },
  { key: "custom_programming", label: "Custom Programming", description: "Custom-built programs by Matt" },
  { key: "coach_messaging", label: "Coach Messaging", description: "Direct messaging with Coach Matt" },
  { key: "flag_coach", label: "Flag for Coach", description: "Flag exercises for coach review" },
  { key: "video_analysis", label: "Video Analysis", description: "Form and video analysis" },
  { key: "nutrition_scanner", label: "Nutrition Scanner", description: "Photo-based nutrition tracking" },
  { key: "posture_analysis", label: "Posture Analysis", description: "Biomechanics posture scan" },
  { key: "velocity_tracker", label: "Velocity Tracker", description: "Velocity-based training tracker" },
  { key: "community_workouts", label: "Community Workouts", description: "Share and discover workouts" },
  { key: "challenges", label: "Challenges", description: "Monthly challenges and leaderboard" },
  { key: "team_management", label: "Team Management", description: "Full roster and team training plans" },
  { key: "session_booking", label: "Session Booking", description: "Book 1-on-1 training sessions" },
  { key: "progress_tracking", label: "Progress Tracking", description: "Progress charts and lift logging" },
  { key: "ai_recovery", label: "Recovery Advisor", description: "Personalized recovery recommendations" },
  { key: "workout_scanner", label: "Workout Scanner", description: "Scan workout photos to log exercises" },
  { key: "shared_feed", label: "Shared Feed", description: "Community workout feed and social sharing" },
  { key: "posture_capture", label: "Posture Capture", description: "Posture photo capture and analysis" },
  { key: "lift_insights", label: "Lift Insights", description: "Lift trend analysis and insights" },
  { key: "ask_coach_matt", label: "Ask Coach Matt", description: "Coaching Q&A with Coach Matt" },
  { key: "referral_program", label: "Referral Program", description: "Refer-a-friend and earn credits" },
  { key: "points_leaderboard", label: "Points & Leaderboard", description: "Points system and leaderboards" },
  { key: "gift_sessions", label: "Gift Sessions", description: "Gift training sessions to others" },
  { key: "interval_timer", label: "Interval Timer", description: "Built-in workout interval timer" },
  { key: "workout_builder", label: "Workout Builder", description: "Custom workout builder tool" },
  { key: "live_form_tracker", label: "Live Form Tracker", description: "Real-time AI form tracking via camera" },
  { key: "voice_notes", label: "Voice Notes", description: "Record voice notes during workouts" },
];

interface TierFeature {
  id: string;
  feature_key: string;
  feature_label: string;
  description: string;
  tier_free: boolean;
  tier_basic: boolean;
  tier_foundation: boolean;
  tier_custom: boolean;
  tier_team_elite: boolean;
  tier_vip: boolean;
  sort_order: number;
}

const VipInviteGenerator = () => {
  const [generating, setGenerating] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const link = `${window.location.origin}/auth?ref=vip-${code}`;
      await navigator.clipboard.writeText(link);
      toast({ title: "VIP invite link copied!", description: link });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 border border-border p-3">
      <Crown size={16} className="text-purple-400 shrink-0" />
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">VIP Invite</p>
        <p className="text-[10px] text-muted-foreground">Generate a unique invite link for VIP clients. Admin-only, invite-only access.</p>
      </div>
      <button
        onClick={generateLink}
        disabled={generating}
        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50 whitespace-nowrap"
      >
        <Link size={12} />
        Generate & Copy Link
      </button>
    </div>
  );
};

const AdminTierManager = () => {
  const queryClient = useQueryClient();
  const [newFeature, setNewFeature] = useState({ feature_key: "", feature_label: "", description: "" });
  const [showAdd, setShowAdd] = useState(false);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["tier-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tier_features")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as TierFeature[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: TierKey; value: boolean }) => {
      const { error } = await supabase
        .from("tier_features")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tier-features"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newFeature.feature_key || !newFeature.feature_label) throw new Error("Key and label required");
      const maxOrder = features.length > 0 ? Math.max(...features.map(f => f.sort_order)) : 0;
      const { error } = await supabase.from("tier_features").insert({
        feature_key: newFeature.feature_key.toLowerCase().replace(/\s+/g, "_"),
        feature_label: newFeature.feature_label,
        description: newFeature.description,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tier-features"] });
      setNewFeature({ feature_key: "", feature_label: "", description: "" });
      setShowAdd(false);
      toast({ title: "Feature added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tier_features").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tier-features"] });
      toast({ title: "Feature removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VipInviteGenerator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Tier Access Manager</h2>
          <p className="text-xs text-muted-foreground mt-1">Toggle feature access for each subscription tier. Changes take effect immediately.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-m2">
              <Plus size={12} /> Add Feature <ChevronDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
            {PRESET_FEATURES
              .filter((p) => !features.some((f) => f.feature_key === p.key))
              .map((preset) => (
                <DropdownMenuItem
                  key={preset.key}
                  onClick={() => {
                    setNewFeature({ feature_key: preset.key, feature_label: preset.label, description: preset.description });
                    setShowAdd(true);
                  }}
                  className="text-xs"
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setNewFeature({ feature_key: "", feature_label: "", description: "" });
                setShowAdd(true);
              }}
              className="text-xs"
            >
              <Pencil size={12} className="mr-2" /> Custom Feature…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showAdd && (
        <div className="bg-muted border border-border p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-widest">Feature Key</Label>
              <Input
                value={newFeature.feature_key}
                onChange={(e) => setNewFeature(p => ({ ...p, feature_key: e.target.value }))}
                placeholder="e.g. video_analysis"
                className="text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest">Label</Label>
              <Input
                value={newFeature.feature_label}
                onChange={(e) => setNewFeature(p => ({ ...p, feature_label: e.target.value }))}
                placeholder="e.g. Video Analysis"
                className="text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest">Description</Label>
              <Input
                value={newFeature.description}
                onChange={(e) => setNewFeature(p => ({ ...p, description: e.target.value }))}
                placeholder="What this feature does"
                className="text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save size={10} /> Save
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[10px] uppercase tracking-widest font-bold w-[200px]">Feature</TableHead>
              {TIERS.map(t => {
                const Icon = t.icon;
                return (
                  <TableHead key={t.key} className="text-center w-[80px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <Icon size={14} className={t.color} />
                      <span className="text-[9px] uppercase tracking-widest font-bold">{t.label}</span>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((f) => (
              <TableRow key={f.id} className="group">
                <TableCell>
                  <div>
                    <span className="text-xs font-bold text-foreground">{f.feature_label}</span>
                    <p className="text-[10px] text-muted-foreground leading-tight">{f.description}</p>
                    <code className="text-[9px] text-muted-foreground/60">{f.feature_key}</code>
                  </div>
                </TableCell>
                {TIERS.map(t => (
                  <TableCell key={t.key} className="text-center">
                    <Checkbox
                      checked={(f as any)[t.key] ?? false}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: f.id, field: t.key as TierKey, value: !!checked })
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${f.feature_label}" feature?`)) {
                        deleteMutation.mutate(f.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-muted/50 border border-border p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong>How it works:</strong> Use <code className="text-[9px] bg-muted px-1">feature_key</code> values in PaywallGate components throughout the app. 
          When a feature is checked for a tier, users on that tier (or higher) get access. VIP is invite-only and admin-managed. Admins always bypass all gates.
        </p>
      </div>
    </div>
  );
};

export default AdminTierManager;
