import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth, TIERS, TierKey, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppNavbar from "@/components/layout/AppNavbar";
import TechSupportButton from "@/components/layout/TechSupportButton";
import SupportTicketForm from "@/components/features/SupportTicketForm";
import PrivacySettingsCard from "@/components/features/PrivacySettingsCard";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Link } from "react-router-dom";
import {
  User, Trophy, Medal, Award, Save, Loader2, Gift, Search,
  Crown, ExternalLink, ShoppingBag, Dumbbell, Calendar, Shield,
  ArrowRight, ChevronDown, ChevronUp, Zap, Clock, FileText, Send, Activity, Brain
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import GiftSessionModal from "@/components/sessions/GiftSessionModal";
import FamilyBilling from "@/components/billing/FamilyBilling";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EmptyStateCard from "@/components/shared/EmptyStateCard";

const TrainingHistory = lazy(() => import("@/components/profile/TrainingHistory"));

interface ProfileData {
  full_name: string | null;
  athlete_name: string | null;
  email: string | null;
  subscription_tier: string;
}

const Profile = () => {
  const { user, subscribed, subscriptionTier, subscriptionEnd, checkSubscription } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [autoRegulate, setAutoRegulate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [liftStats, setLiftStats] = useState<{ exercise_name: string; max_weight: number; count: number }[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [purchasedPrograms, setPurchasedPrograms] = useState<any[]>([]);
  const [activePrograms, setActivePrograms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<{ valid: boolean; remaining_balance: number; original_amount: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showAllLifts, setShowAllLifts] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const canGiftSession = subscriptionTier === "pro" || subscriptionTier === "elite";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Parallel data fetching for performance
      const [profileRes, partsRes, logsRes, cardsRes, purchasedRes, activeRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, athlete_name, email, subscription_tier, auto_regulate").eq("user_id", user.id).single(),
        supabase.from("challenge_participants").select("challenge_id, current_value, is_public, monthly_challenge_id").eq("user_id", user.id),
        supabase.from("progress_logs").select("exercise_name, weight").eq("user_id", user.id),
        supabase.from("gift_cards" as any).select("*").or(`purchaser_id.eq.${user.id},redeemed_by.eq.${user.id}`).order("created_at", { ascending: false }),
        supabase.from("purchased_programs").select("*").eq("user_id", user.id).order("purchased_at", { ascending: false }),
        supabase.from("user_active_programs").select("*, training_programs(title, category, level, sport)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("session_bookings").select("*").eq("user_id", user.id).order("slot_date", { ascending: false }).limit(10),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data as ProfileData);
        setFullName(profileRes.data.full_name || "");
        setAthleteName(profileRes.data.athlete_name || "");
        setAutoRegulate((profileRes.data as any).auto_regulate === true);
      }

      // Challenge enrichment
      if (partsRes.data && partsRes.data.length > 0) {
        const enriched = await Promise.all(
          (partsRes.data as any[]).map(async (p: any) => {
            const { data: allParts } = await supabase
              .from("challenge_participants")
              .select("user_id, current_value")
              .eq("challenge_id", p.challenge_id)
              .order("current_value", { ascending: false });
            const rank = allParts ? allParts.findIndex((a: any) => a.user_id === user.id) + 1 : 0;
            const total = allParts?.length || 0;
            let title = p.challenge_id;
            if (p.monthly_challenge_id) {
              const { data: mc } = await supabase.from("monthly_challenges").select("title").eq("id", p.monthly_challenge_id).single();
              if (mc) title = mc.title;
            }
            return { ...p, rank, total, title };
          })
        );
        setChallenges(enriched);
      }

      // Lift stats
      if (logsRes.data && logsRes.data.length > 0) {
        const grouped: Record<string, { max: number; count: number }> = {};
        logsRes.data.forEach((l: any) => {
          if (!grouped[l.exercise_name]) grouped[l.exercise_name] = { max: 0, count: 0 };
          grouped[l.exercise_name].count++;
          if (l.weight > grouped[l.exercise_name].max) grouped[l.exercise_name].max = l.weight;
        });
        setLiftStats(
          Object.entries(grouped)
            .map(([name, s]) => ({ exercise_name: name, max_weight: s.max, count: s.count }))
            .sort((a, b) => b.count - a.count)
        );
      }

      if (cardsRes.data) setGiftCards(cardsRes.data);
      if (purchasedRes.data) setPurchasedPrograms(purchasedRes.data as any[]);
      if (activeRes.data) setActivePrograms(activeRes.data as any[]);
      if (bookingsRes.data) setBookings(bookingsRes.data as any[]);

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
      auto_regulate: autoRegulate,
    } as any).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Portal error", description: e.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
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

  const displayName = athleteName || fullName || "Athlete";
  const visibleLifts = showAllLifts ? liftStats : liftStats.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12 max-w-3xl">

        {/* Profile Header Card */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <User size={28} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black uppercase tracking-tight text-foreground truncate">
                {displayName}
              </h1>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isAdmin ? (
                  <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground">
                    <Crown size={10} />
                    M² Coach
                  </Badge>
                ) : subscriptionTier ? (
                  <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest">
                    <Crown size={10} />
                    {TIERS[subscriptionTier].name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Free Account</Badge>
                )}
                {subscriptionEnd && (
                  <span className="text-[10px] text-muted-foreground">
                    Renews {new Date(subscriptionEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {subscribed ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                  Manage Plan
                </button>
              ) : (
                <Link
                  to="/pricing"
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  <Zap size={12} />
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={`grid grid-cols-2 ${canGiftSession ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-2 mb-6`}>
          <Link to="/dashboard" className="bg-card border border-border p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 transition-all">
            <Dumbbell size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dashboard</span>
          </Link>
          <Link to="/shop" className="bg-card border border-border p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 transition-all">
            <ShoppingBag size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shop</span>
          </Link>
          <Link to="/schedule" className="bg-card border border-border p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 transition-all">
            <Calendar size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</span>
          </Link>
          <Link to="/pricing" className="bg-card border border-border p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 transition-all">
            <Shield size={18} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plans</span>
          </Link>
          {canGiftSession && (
            <button
              onClick={() => setGiftModalOpen(true)}
              className="bg-primary/10 border border-primary/30 p-3 flex flex-col items-center gap-1.5 hover:border-primary/60 transition-all"
            >
              <Gift size={18} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Gift Session</span>
            </button>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User size={12} /> Profile
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Brain size={12} /> Training History
          </button>
        </div>

        {activeTab === "history" ? (
          <Suspense fallback={
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          }>
            <TrainingHistory />
          </Suspense>
        ) : (
        <>
        {/* Subscription Details */}
        {(subscribed || isAdmin) && (
          <div className="bg-primary/5 border border-primary/20 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={14} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Your Subscription</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Plan</p>
                <p className="text-sm font-bold text-foreground">{isAdmin ? "M² Coach" : subscriptionTier ? TIERS[subscriptionTier].name : "Free"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Price</p>
                <p className="text-sm font-bold text-foreground">{isAdmin ? "∞" : subscriptionTier ? `${TIERS[subscriptionTier].price}/mo` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Store Discount</p>
                <p className="text-sm font-bold text-primary">{isAdmin ? "100% off" : subscriptionTier ? `${TIER_DISCOUNTS[subscriptionTier]}% off` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Renews</p>
                <p className="text-sm font-bold text-foreground">
                  {isAdmin ? "Never expires" : subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-1.5 border border-primary/30 text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all disabled:opacity-50"
              >
                {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Change Plan · Update Payment
              </button>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-1.5 border border-destructive/40 text-destructive px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/10 transition-all disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        )}

        {/* Family Billing */}
        <FamilyBilling />

        {/* My Programs — show empty state or list */}
        {activePrograms.length === 0 && purchasedPrograms.length === 0 && liftStats.length === 0 && (
          <div className="mb-6">
            <EmptyStateCard
              title="Your Journey Starts Here"
              description="You haven't started any programs or logged any lifts yet. Pick your starting track and let Matt build your path."
              ctaLabel="Select Your Starting Track →"
              ctaTo="/shop"
            />
          </div>
        )}
        {(activePrograms.length > 0 || purchasedPrograms.length > 0) && (
          <div className="bg-card border border-border p-5 mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
              <Dumbbell size={12} /> My Programs
            </h2>
            <div className="space-y-2">
              {activePrograms.map((ap: any) => (
                <div key={ap.id} className="flex items-center justify-between bg-muted p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {(ap.training_programs as any)?.title || "Training Program"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(ap.training_programs as any)?.category} · {(ap.training_programs as any)?.level}
                      {(ap.training_programs as any)?.sport && ` · ${(ap.training_programs as any).sport}`}
                    </p>
                  </div>
                  <Badge variant={ap.status === "active" ? "default" : "outline"} className="text-[9px] uppercase tracking-widest shrink-0">
                    {ap.status}
                  </Badge>
                </div>
              ))}
              {purchasedPrograms.map((pp: any) => (
                <div key={pp.id} className="flex items-center justify-between bg-muted p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{pp.program_title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {pp.program_type === "custom" ? "Custom Program" : pp.program_type}
                      {pp.sport && ` · ${pp.sport}`}
                      {" · "}Purchased {new Date(pp.purchased_at).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText size={14} className="text-primary shrink-0" />
                </div>
              ))}
            </div>
            <Link
              to="/dashboard"
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-all"
            >
              Go to Dashboard <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {/* Recent Bookings */}
        {bookings.length > 0 && (
          <div className="bg-card border border-border p-5 mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
              <Calendar size={12} /> Session History
            </h2>
            <div className="space-y-2">
              {bookings.slice(0, 5).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between bg-muted p-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {new Date(b.slot_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {" at "}{b.start_time?.slice(0, 5)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.duration_minutes} min · ${(b.amount_cents / 100).toFixed(0)}
                    </p>
                  </div>
                  <Badge
                    variant={b.status === "confirmed" ? "default" : "outline"}
                    className={`text-[9px] uppercase tracking-widest ${b.status === "cancelled" ? "text-destructive" : ""}`}
                  >
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Auto-Regulation Engine */}
        <div className="bg-card border border-border p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                <Activity size={12} /> Auto-Regulation Engine
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                When enabled, you'll be asked how many hours you slept before each workout. 
                If you're under-recovered, your prescribed working weights (3RM/5RM) automatically drop 
                and complex barbell movements swap to dumbbell/machine equivalents — protecting your 
                joints when your nervous system is compromised.
              </p>
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 p-3">
                <Switch
                  id="auto-regulate"
                  checked={autoRegulate}
                  onCheckedChange={setAutoRegulate}
                />
                <label htmlFor="auto-regulate" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  {autoRegulate ? "Active — you'll get a readiness check before each workout" : "Disabled — standard programming only"}
                </label>
              </div>
              {autoRegulate && (
                <p className="text-[10px] text-primary mt-2 flex items-center gap-1">
                  <Zap size={10} />
                  Don't forget to hit "Save Changes" above to save this preference.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <PrivacySettingsCard />

        {/* Challenge Medals */}
        {challenges.length > 0 && (
          <div className="bg-card border border-border p-5 mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
              <Trophy size={12} /> Challenge Results
            </h2>
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
          <div className="bg-card border border-border p-5 mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
              <Dumbbell size={12} /> Top Lifts
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleLifts.map((s, i) => (
                <div key={i} className="bg-muted p-3">
                  <p className="text-xs font-bold text-foreground truncate">{s.exercise_name}</p>
                  <p className="text-lg font-mono font-bold text-primary">{Math.round(s.max_weight)} lbs</p>
                  <p className="text-[10px] text-muted-foreground">{s.count} sessions logged</p>
                </div>
              ))}
            </div>
            {liftStats.length > 6 && (
              <button
                onClick={() => setShowAllLifts(!showAllLifts)}
                className="mt-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-all"
              >
                {showAllLifts ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {liftStats.length} Lifts</>}
              </button>
            )}
          </div>
        )}

        {/* Refer & Earn */}
        <Link
          to="/dashboard"
          onClick={() => { /* will navigate; tab set handled by Dashboard */ }}
          className="bg-card border border-border p-5 mb-6 flex items-center justify-between hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Send size={14} className="text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Refer & Earn</p>
              <p className="text-xs text-muted-foreground">Share your referral code and earn credits</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-all" />
        </Link>

        {/* Gift Cards */}
        <div className="bg-card border border-border p-5 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1.5">
            <Gift size={12} /> Gift Cards
          </h2>

          {/* Lookup */}
          <div className="flex gap-2 mb-4">
            <Input
              value={lookupCode}
              onChange={(e) => { setLookupCode(e.target.value.toUpperCase()); setLookupResult(null); }}
              placeholder="Enter gift card code"
              className="font-mono uppercase tracking-widest"
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !lookupCode.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {lookupLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Check
            </button>
          </div>

          {lookupResult && (
            <div className="bg-primary/10 border border-primary/20 p-4 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Remaining Balance</p>
              <p className="text-2xl font-mono font-bold text-primary">${lookupResult.remaining_balance.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Original value: ${lookupResult.original_amount.toFixed(2)}
              </p>
            </div>
          )}

          {giftCards.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Cards</p>
              {giftCards.map((gc: any) => (
                <div key={gc.id} className="flex items-center justify-between bg-muted p-3">
                  <div>
                    <p className="text-sm font-mono font-bold text-foreground tracking-widest">{gc.code}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {gc.purchaser_id === user?.id ? "Purchased" : "Redeemed"} · {new Date(gc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-mono font-bold ${gc.remaining_balance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      ${gc.remaining_balance.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      of ${gc.original_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No gift cards yet. <Link to="/shop" className="text-primary hover:underline">Buy one in the store</Link>.
            </p>
          )}
        </div>
        </>
        )}
      </div>
      <SupportTicketForm />
      <TechSupportButton />
      <GiftSessionModal open={giftModalOpen} onClose={() => setGiftModalOpen(false)} />
    </div>
  );
};

export default Profile;