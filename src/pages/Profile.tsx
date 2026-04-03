import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth, TIERS, TierKey, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppNavbar from "@/components/layout/AppNavbar";
import TechSupportButton from "@/components/layout/TechSupportButton";
import SupportTicketForm from "@/components/features/SupportTicketForm";
import PrivacySettingsCard from "@/components/features/PrivacySettingsCard";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Trophy, Medal, Award, Save, Loader2, Gift, Search,
  Crown, ExternalLink, ShoppingBag, Dumbbell, Calendar, Shield,
  ArrowRight, ChevronDown, ChevronUp, Zap, Clock, FileText, Send, Activity, Brain, Camera, Ticket, Share2, UserPlus
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import GiftSessionModal from "@/components/sessions/GiftSessionModal";
import FamilyBilling from "@/components/billing/FamilyBilling";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { safeLocalStorage } from "@/lib/browserStorage";

const TrainingHistory = lazy(() => import("@/components/profile/TrainingHistory"));
const WorkoutDataCenter = lazy(() => import("@/components/profile/WorkoutDataCenter"));
const WelcomeGiftModal = lazy(() => import("@/components/dashboard/WelcomeGiftModal"));
const UserActivityFeed = lazy(() => import("@/components/admin/UserActivityFeed"));

/** Posture Analysis card */
const PostureAnalysisCard = () => {
  const { user } = useAuth();
  const [hasPosture, setHasPosture] = useState<boolean | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("posture_requests" as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setHasPosture((count ?? 0) > 0));
  }, [user]);

  if (hasPosture !== false) return null;

  return (
    <div className="bg-card border border-border p-5 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Camera size={14} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Free Posture Analysis</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Take a quick front & side photo — Coach Matt will analyze your posture and send you a personalized breakdown.
      </p>
      <button
        onClick={() => setShowCapture(true)}
        className="w-full h-10 border-2 border-primary text-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
      >
        <Camera size={14} /> Get My Free Analysis
      </button>
      {showCapture && (
        <Suspense fallback={null}>
          <WelcomeGiftModal open={showCapture} onClose={() => setShowCapture(false)} />
        </Suspense>
      )}
    </div>
  );
};

/** Deferred free custom program coupon */
const DeferredCouponCard = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const isDeferred = safeLocalStorage.getItem("m2_coupon_deferred") === "true";
    if (!isDeferred) return;
    supabase
      .from("profiles")
      .select("is_in_person, free_program_redeemed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.is_in_person && !data?.free_program_redeemed) {
          supabase
            .from("custom_program_requests" as any)
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .then(({ count }) => {
              if ((count ?? 0) === 0) setVisible(true);
            });
        }
      });
  }, [user]);

  if (!visible) return null;

  const handleClaim = () => {
    safeLocalStorage.removeItem("m2_coupon_deferred");
    nav("/dashboard");
  };

  return (
    <div className="bg-primary/5 border-2 border-primary/30 p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Ticket size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Free Custom Program
          </span>
        </div>
        <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
          1 Free Coupon
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        You have a free custom workout program waiting to be claimed.
      </p>
      <button
        onClick={handleClaim}
        className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
      >
        <Dumbbell size={14} /> Claim My Free Program
      </button>
    </div>
  );
};

interface ProfileData {
  full_name: string | null;
  athlete_name: string | null;
  email: string | null;
  subscription_tier: string;
}

type ProfileTab = "profile" | "programs" | "activity" | "data";

const PROFILE_TABS: { key: ProfileTab; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "programs", label: "Programs", icon: Dumbbell },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "data", label: "Data", icon: Brain },
];

const Profile = () => {
  const { user, subscribed, subscriptionTier, subscriptionEnd, checkSubscription } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (typeof window !== "undefined" && window.location.hash === "#data") return "data";
    return "profile";
  });
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

  const handleShare = () => {
    const url = `${window.location.origin}?ref=${user?.id || ""}`;
    if (navigator.share) {
      navigator.share({ title: "Train with me on M²", url });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Referral link copied!" });
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
      <div className="container pt-20 pb-12 max-w-3xl px-3 sm:px-4">

        {/* Profile Header Card */}
        <div className="bg-card border border-border p-4 sm:p-6 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0 rounded-full">
              <User size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black uppercase tracking-tight text-foreground truncate">
                {displayName}
              </h1>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {isAdmin ? (
                  <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground">
                    <Crown size={10} /> M² Coach
                  </Badge>
                ) : subscriptionTier ? (
                  <Badge className="flex items-center gap-1 text-[10px] uppercase tracking-widest">
                    <Crown size={10} /> {TIERS[subscriptionTier].name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Free</Badge>
                )}
              </div>
            </div>
          </div>
          {/* Quick action buttons */}
          <div className="flex gap-2 mt-3">
            {subscribed ? (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 rounded"
              >
                {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Manage Plan
              </button>
            ) : (
              <Link
                to="/pricing"
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded"
              >
                <Zap size={12} /> Upgrade
              </Link>
            )}
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 border border-primary/30 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all rounded"
            >
              <UserPlus size={12} /> Invite
            </button>
            {canGiftSession && (
              <button
                onClick={() => setGiftModalOpen(true)}
                className="flex items-center justify-center gap-1.5 border border-primary/30 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all rounded"
              >
                <Gift size={12} /> Gift
              </button>
            )}
          </div>
        </div>

        {/* 4-Tab Lateral Navigation */}
        <div className="flex border border-border rounded-lg overflow-hidden mb-4">
          {PROFILE_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${
                activeTab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon size={12} />
              <span className="hidden xs:inline sm:inline">{label}</span>
              <span className="xs:hidden sm:hidden">{label.slice(0, 4)}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "activity" ? (
          <Suspense fallback={
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          }>
            {user && <UserActivityFeed targetUserId={user.id} />}
          </Suspense>
        ) : activeTab === "data" ? (
          <Suspense fallback={
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          }>
            <TrainingHistory />
            <div className="mt-6">
              <WorkoutDataCenter />
            </div>
          </Suspense>
        ) : activeTab === "programs" ? (
          <>
            {/* Active & Purchased Programs */}
            {activePrograms.length === 0 && purchasedPrograms.length === 0 ? (
              <EmptyStateCard
                title="No Programs Yet"
                description="Pick your starting track and let Matt build your path."
                ctaLabel="Browse Programs →"
                ctaTo="/shop"
              />
            ) : (
              <div className="bg-card border border-border p-4 mb-4">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <Dumbbell size={12} /> My Programs
                </h2>
                <div className="space-y-2">
                  {activePrograms.map((ap: any) => (
                    <div key={ap.id} className="flex items-center justify-between bg-muted p-3 rounded">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {(ap.training_programs as any)?.title || "Training Program"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(ap.training_programs as any)?.category} · {(ap.training_programs as any)?.level}
                        </p>
                      </div>
                      <Badge variant={ap.status === "active" ? "default" : "outline"} className="text-[9px] uppercase tracking-widest shrink-0">
                        {ap.status}
                      </Badge>
                    </div>
                  ))}
                  {purchasedPrograms.map((pp: any) => (
                    <div key={pp.id} className="flex items-center justify-between bg-muted p-3 rounded">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{pp.program_title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Purchased {new Date(pp.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                      <FileText size={14} className="text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bookings */}
            {bookings.length > 0 && (
              <div className="bg-card border border-border p-4 mb-4">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <Calendar size={12} /> Session History
                </h2>
                <div className="space-y-2">
                  {bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between bg-muted p-3 rounded">
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

            {/* Challenge Results */}
            {challenges.length > 0 && (
              <div className="bg-card border border-border p-4 mb-4">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <Trophy size={12} /> Challenge Results
                </h2>
                <div className="space-y-2">
                  {challenges.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-muted p-3 rounded">
                      <div className="w-8 flex justify-center">
                        {getMedalIcon(c.rank)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{c.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Score: {c.current_value} · {getMedalLabel(c.rank)} of {c.total}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Lifts */}
            {liftStats.length > 0 && (
              <div className="bg-card border border-border p-4 mb-4">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <Dumbbell size={12} /> Top Lifts
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {visibleLifts.map((s, i) => (
                    <div key={i} className="bg-muted p-3 rounded">
                      <p className="text-xs font-bold text-foreground truncate">{s.exercise_name}</p>
                      <p className="text-lg font-mono font-bold text-primary">{Math.round(s.max_weight)} lbs</p>
                      <p className="text-[10px] text-muted-foreground">{s.count} sessions</p>
                    </div>
                  ))}
                </div>
                {liftStats.length > 6 && (
                  <button
                    onClick={() => setShowAllLifts(!showAllLifts)}
                    className="mt-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-all"
                  >
                    {showAllLifts ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {liftStats.length}</>}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          /* Profile tab */
          <>
            {/* Subscription Details */}
            {(subscribed || isAdmin) && (
              <div className="bg-primary/5 border border-primary/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={14} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Your Subscription</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Plan</p>
                    <p className="text-sm font-bold text-foreground">{isAdmin ? "M² Coach" : subscriptionTier ? TIERS[subscriptionTier].name : "Free"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Price</p>
                    <p className="text-sm font-bold text-foreground">{isAdmin ? "∞" : subscriptionTier ? `${TIERS[subscriptionTier].price}/mo` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Discount</p>
                    <p className="text-sm font-bold text-primary">{isAdmin ? "100%" : subscriptionTier ? `${TIER_DISCOUNTS[subscriptionTier]}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Renews</p>
                    <p className="text-sm font-bold text-foreground">
                      {isAdmin ? "Never" : subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <FamilyBilling />

            {/* Edit Profile */}
            <div className="bg-card border border-border p-4 mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Profile Details</h2>
              <div className="space-y-3">
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
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 rounded"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>

            {/* Auto-Regulation Engine */}
            <div className="bg-card border border-border p-4 mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                <Activity size={12} /> Auto-Regulation Engine
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                When enabled, your working weights auto-adjust based on recovery data.
              </p>
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 p-3 rounded">
                <Switch id="auto-regulate" checked={autoRegulate} onCheckedChange={setAutoRegulate} />
                <label htmlFor="auto-regulate" className="text-xs font-bold text-foreground cursor-pointer select-none">
                  {autoRegulate ? "Active" : "Disabled"}
                </label>
              </div>
            </div>

            <DeferredCouponCard />
            <PostureAnalysisCard />
            <PrivacySettingsCard />

            {/* Gift Cards */}
            <div className="bg-card border border-border p-4 mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                <Gift size={12} /> Gift Cards
              </h2>
              <div className="flex gap-2 mb-3">
                <Input
                  value={lookupCode}
                  onChange={(e) => { setLookupCode(e.target.value.toUpperCase()); setLookupResult(null); }}
                  placeholder="Enter gift card code"
                  className="font-mono uppercase tracking-widest"
                />
                <button
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupCode.trim()}
                  className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 rounded"
                >
                  {lookupLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  Check
                </button>
              </div>
              {lookupResult && (
                <div className="bg-primary/10 border border-primary/20 p-4 mb-3 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Remaining Balance</p>
                  <p className="text-2xl font-mono font-bold text-primary">${lookupResult.remaining_balance.toFixed(2)}</p>
                </div>
              )}
              {giftCards.length > 0 ? (
                <div className="space-y-2">
                  {giftCards.map((gc: any) => (
                    <div key={gc.id} className="flex items-center justify-between bg-muted p-3 rounded">
                      <div>
                        <p className="text-sm font-mono font-bold text-foreground tracking-widest">{gc.code}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {gc.purchaser_id === user?.id ? "Purchased" : "Redeemed"} · {new Date(gc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-lg font-mono font-bold ${gc.remaining_balance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        ${gc.remaining_balance.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No gift cards yet. <Link to="/shop" className="text-primary hover:underline">Buy one</Link>.
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
