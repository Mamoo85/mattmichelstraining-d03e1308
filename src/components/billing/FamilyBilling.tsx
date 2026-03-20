import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIERS, TierKey } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Users, Crown, Loader2, AlertTriangle, UserPlus, Shield, Zap
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface FamilyMember {
  user_id: string;
  name: string;
  email: string;
  tier: TierKey | "free";
  is_self: boolean;
}

const TIER_OPTIONS: { key: TierKey; label: string; price: number }[] = [
  { key: "basic", label: "Basic", price: 14.99 },
  { key: "foundation", label: "Foundation", price: 39.99 },
  { key: "custom", label: "Custom", price: 99.99 },
  { key: "team_elite", label: "Team / Elite", price: 149.99 },
];

const getTierPrice = (tier: TierKey | "free"): number => {
  const opt = TIER_OPTIONS.find((t) => t.key === tier);
  return opt?.price || 0;
};

const getTierLabel = (tier: TierKey | "free"): string => {
  if (tier === "free") return "Free";
  const opt = TIER_OPTIONS.find((t) => t.key === tier);
  return opt?.label || tier;
};

const FamilyBilling = () => {
  const { user, checkSubscription } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Track staged tier changes (not yet submitted)
  const [stagedChanges, setStagedChanges] = useState<Record<string, TierKey>>({});

  // Confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Add athlete modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const fetchFamily = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [profileRes, linksRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, email, subscription_tier")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("parent_child_links")
          .select("child_user_id")
          .eq("parent_user_id", user.id),
      ]);

      const familyMembers: FamilyMember[] = [];

      if (profileRes.data) {
        familyMembers.push({
          user_id: profileRes.data.user_id,
          name: profileRes.data.athlete_name || profileRes.data.full_name || "You",
          email: profileRes.data.email || "",
          tier: (profileRes.data.subscription_tier as TierKey) || "free",
          is_self: true,
        });
      }

      if (linksRes.data && linksRes.data.length > 0) {
        const childIds = linksRes.data.map((l: any) => l.child_user_id);
        const { data: childProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, athlete_name, email, subscription_tier")
          .in("user_id", childIds);

        if (childProfiles) {
          childProfiles.forEach((cp: any) => {
            familyMembers.push({
              user_id: cp.user_id,
              name: cp.athlete_name || cp.full_name || "Athlete",
              email: cp.email || "",
              tier: (cp.subscription_tier as TierKey) || "free",
              is_self: false,
            });
          });
        }
      }

      setMembers(familyMembers);
      setStagedChanges({});
    } catch (err: any) {
      toast({ title: "Error loading family", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [user]);

  // Effective tier for a member (staged or current)
  const getEffectiveTier = (member: FamilyMember): TierKey | "free" => {
    return stagedChanges[member.user_id] || member.tier;
  };

  // Current total (from DB)
  const currentTotal = useMemo(
    () => members.reduce((sum, m) => sum + getTierPrice(m.tier), 0),
    [members]
  );

  // Projected total (with staged changes)
  const projectedTotal = useMemo(
    () => members.reduce((sum, m) => sum + getTierPrice(getEffectiveTier(m)), 0),
    [members, stagedChanges]
  );

  const hasChanges = Object.keys(stagedChanges).length > 0;
  const totalDiff = projectedTotal - currentTotal;

  // Build change summary for confirmation
  const changeSummary = useMemo(() => {
    return Object.entries(stagedChanges).map(([userId, newTier]) => {
      const member = members.find((m) => m.user_id === userId);
      if (!member) return null;
      return {
        name: member.name,
        from: getTierLabel(member.tier),
        to: getTierLabel(newTier),
        priceDiff: getTierPrice(newTier) - getTierPrice(member.tier),
      };
    }).filter(Boolean);
  }, [stagedChanges, members]);

  const handleTierStage = (memberId: string, newTier: string) => {
    const member = members.find((m) => m.user_id === memberId);
    if (!member) return;

    // If reverting to original tier, remove staged change
    if (newTier === member.tier) {
      setStagedChanges((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    } else {
      setStagedChanges((prev) => ({ ...prev, [memberId]: newTier as TierKey }));
    }
  };

  const handleSubmitAll = async () => {
    setUpdating(true);
    setConfirmOpen(false);

    try {
      // Process each change sequentially (Stripe needs sequential item updates)
      for (const [userId, newTier] of Object.entries(stagedChanges)) {
        const { data, error } = await supabase.functions.invoke("update-family-tier", {
          body: { memberUserId: userId, newTier },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast({
        title: "Family plan updated!",
        description: `Your new monthly total is $${projectedTotal.toFixed(2)}/mo.`,
      });

      await Promise.all([fetchFamily(), checkSubscription()]);
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddAthlete = async () => {
    if (!user || !addEmail.trim() || !addName.trim() || !addPassword.trim()) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    if (addPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-child-account", {
        body: { childEmail: addEmail.trim(), childName: addName.trim(), childPassword: addPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Athlete linked!", description: `${addName} is now part of your family plan.` });
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddOpen(false);
      fetchFamily();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  // Only show if parent has linked children
  if (members.length <= 1) return null;

  return (
    <>
      <div className="bg-card border border-border p-5 sm:p-6 mb-6">
        {/* Section Header */}
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Users size={20} className="text-primary" />
            Family Memberships
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage access levels for your household. Billing is consolidated into one monthly charge.
          </p>
        </div>

        {/* Member Cards */}
        <div className="space-y-3">
          {members.map((member) => {
            const effectiveTier = getEffectiveTier(member);
            const isChanged = stagedChanges[member.user_id] !== undefined;

            return (
              <div
                key={member.user_id}
                className={`border p-4 transition-all ${
                  isChanged
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-secondary/30"
                }`}
              >
                {/* Mobile: stack vertically. Desktop: flex row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {member.name[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm sm:text-base font-bold text-foreground truncate">
                          {member.name}
                        </p>
                        {member.is_self ? (
                          <Badge variant="outline" className="text-[9px] uppercase tracking-widest border-primary/30 text-primary shrink-0">
                            <Shield size={8} className="mr-1" />
                            Parent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] uppercase tracking-widest border-muted-foreground/30 text-muted-foreground shrink-0">
                            <Zap size={8} className="mr-1" />
                            Athlete
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {/* Right: Tier Selector */}
                  <div className="sm:ml-auto shrink-0">
                    <Select
                      value={effectiveTier === "free" ? undefined : effectiveTier}
                      onValueChange={(val) => handleTierStage(member.user_id, val)}
                      disabled={updating}
                    >
                      <SelectTrigger className="w-full sm:w-[180px] h-10 text-sm border-border bg-background">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            <span className="flex items-center gap-2">
                              <Crown size={12} className="text-primary shrink-0" />
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-muted-foreground ml-auto">${opt.price}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isChanged && (
                      <p className="text-[10px] text-primary mt-1 text-right font-medium uppercase tracking-widest">
                        Changed
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Athlete Button */}
        <button
          onClick={() => setAddOpen(true)}
          className="mt-4 flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-all px-1 py-2"
        >
          <UserPlus size={16} />
          + Link another athlete
        </button>

        {/* Billing Summary Footer */}
        <div className="bg-secondary/50 border border-border p-4 sm:p-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-widest font-bold">
              Total Monthly Investment
            </span>
            <div className="text-right">
              <span className="text-xl sm:text-2xl font-mono font-bold text-primary">
                ${(hasChanges ? projectedTotal : currentTotal).toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">/mo</span>
            </div>
          </div>

          {hasChanges && (
            <div className="flex items-center justify-between text-xs mb-3 pb-3 border-b border-border">
              <span className="text-muted-foreground">
                Currently: ${currentTotal.toFixed(2)}/mo
              </span>
              <span className={`font-mono font-bold ${totalDiff > 0 ? "text-destructive" : "text-primary"}`}>
                {totalDiff > 0 ? "+" : ""}${totalDiff.toFixed(2)}/mo
              </span>
            </div>
          )}

          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!hasChanges || updating}
            className="w-full bg-primary text-primary-foreground py-3 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {updating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Crown size={16} />
            )}
            Update Family Plan
          </button>

          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Changes are prorated automatically — you only pay the difference for the rest of the billing cycle.
          </p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <AlertTriangle size={18} className="text-primary" />
              Confirm Family Plan Changes
            </DialogTitle>
            <DialogDescription className="text-sm">
              Review the changes below. Stripe will automatically prorate any differences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {changeSummary.map((change: any, i: number) => (
              <div key={i} className="bg-secondary/50 border border-border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{change.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {change.from} → <span className="text-primary font-medium">{change.to}</span>
                  </p>
                </div>
                <span className={`text-sm font-mono font-bold ${change.priceDiff > 0 ? "text-destructive" : "text-primary"}`}>
                  {change.priceDiff > 0 ? "+" : ""}${change.priceDiff.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-muted p-4 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">New Monthly Total</span>
            <span className="text-xl font-mono font-bold text-primary">${projectedTotal.toFixed(2)}</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={updating}
              className="bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
              Confirm Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Athlete Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <UserPlus size={18} className="text-primary" />
              Link an Athlete
            </DialogTitle>
            <DialogDescription className="text-sm">
              Create a login for your athlete and add them to your family plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
                Athlete Name
              </label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
                Email for Login
              </label>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                type="email"
                placeholder="athlete@email.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
                Password
              </label>
              <Input
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                type="password"
                placeholder="At least 6 characters"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setAddOpen(false)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAthlete}
              disabled={addLoading || !addName.trim() || !addEmail.trim() || !addPassword.trim()}
              className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {addLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Create & Link
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FamilyBilling;
