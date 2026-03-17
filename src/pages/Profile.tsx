import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppNavbar from "@/components/AppNavbar";
import { User, Trophy, Medal, Award, Save, Loader2, Eye, EyeOff, Gift, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProfileData {
  full_name: string | null;
  athlete_name: string | null;
  email: string | null;
}

interface ChallengeResult {
  challenge_id: string;
  current_value: number;
  is_public: boolean;
  monthly_challenge_id: string | null;
}

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [liftStats, setLiftStats] = useState<{ exercise_name: string; max_weight: number; count: number }[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<{ valid: boolean; remaining_balance: number; original_amount: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // Profile
      const { data: p } = await supabase.from("profiles").select("full_name, athlete_name, email").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setFullName(p.full_name || "");
        setAthleteName(p.athlete_name || "");
      }

      // Challenge participation with rankings
      const { data: parts } = await supabase
        .from("challenge_participants")
        .select("challenge_id, current_value, is_public, monthly_challenge_id")
        .eq("user_id", user.id);
      
      if (parts && parts.length > 0) {
        // For each challenge, get all participants to determine rank
        const enriched = await Promise.all(
          (parts as any[]).map(async (p: any) => {
            const { data: allParts } = await supabase
              .from("challenge_participants")
              .select("user_id, current_value")
              .eq("challenge_id", p.challenge_id)
              .order("current_value", { ascending: false });
            const rank = allParts ? allParts.findIndex((a: any) => a.user_id === user.id) + 1 : 0;
            const total = allParts?.length || 0;
            // Get challenge title if monthly
            let title = p.challenge_id;
            if (p.monthly_challenge_id) {
              const { data: mc } = await supabase
                .from("monthly_challenges")
                .select("title")
                .eq("id", p.monthly_challenge_id)
                .single();
              if (mc) title = mc.title;
            }
            return { ...p, rank, total, title };
          })
        );
        setChallenges(enriched);
      }

      // Lift stats - top lifts
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("exercise_name, weight")
        .eq("user_id", user.id);
      if (logs && logs.length > 0) {
        const grouped: Record<string, { max: number; count: number }> = {};
        logs.forEach((l: any) => {
          if (!grouped[l.exercise_name]) grouped[l.exercise_name] = { max: 0, count: 0 };
          grouped[l.exercise_name].count++;
          if (l.weight > grouped[l.exercise_name].max) grouped[l.exercise_name].max = l.weight;
        });
        const stats = Object.entries(grouped)
          .map(([name, s]) => ({ exercise_name: name, max_weight: s.max, count: s.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        setLiftStats(stats);
      }

      // Gift cards
      const { data: cards } = await supabase
        .from("gift_cards" as any)
        .select("*")
        .or(`purchaser_id.eq.${user.id},redeemed_by.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (cards) setGiftCards(cards);

      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim() || null,
      athlete_name: athleteName.trim() || null,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const handleLookup = async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-gift-card", {
        body: { code: lookupCode.trim(), action: "check" },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Not found", description: data.error, variant: "destructive" });
      } else {
        setLookupResult(data);
      }
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={16} className="text-primary" />;
    if (rank === 2) return <Medal size={16} className="text-muted-foreground" />;
    if (rank === 3) return <Award size={16} className="text-primary/70" />;
    return null;
  };

  const getMedalLabel = (rank: number) => {
    if (rank === 1) return "Gold";
    if (rank === 2) return "Silver";
    if (rank === 3) return "Bronze";
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container pt-24 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 flex items-center justify-center">
            <User size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              {athleteName || fullName || "Your Profile"}
            </h1>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-card border border-border p-5 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Profile Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Athlete Display Name</label>
              <Input value={athleteName} onChange={(e) => setAthleteName(e.target.value)} placeholder="Name shown on leaderboards" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Email</label>
              <Input value={profile?.email || ""} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed here</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Challenge Medals */}
        {challenges.length > 0 && (
          <div className="bg-card border border-border p-5 mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Challenge Results</h2>
            <div className="space-y-3">
              {challenges.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-muted p-3">
                  <div className="w-8 flex justify-center">
                    {getMedalIcon(c.rank)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Score: {c.current_value} · Rank: {getMedalLabel(c.rank)} of {c.total}
                    </p>
                  </div>
                  {c.rank <= 3 && (
                    <Badge className="text-[9px] uppercase tracking-widest shrink-0">
                      {getMedalLabel(c.rank)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lift Stats */}
        {liftStats.length > 0 && (
          <div className="bg-card border border-border p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Top Lifts</h2>
            <div className="grid grid-cols-2 gap-3">
              {liftStats.map((s, i) => (
                <div key={i} className="bg-muted p-3">
                  <p className="text-xs font-bold text-foreground truncate">{s.exercise_name}</p>
                  <p className="text-lg font-mono font-bold text-primary">{Math.round(s.max_weight)} lbs</p>
                  <p className="text-[10px] text-muted-foreground">{s.count} sessions logged</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
