import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIERS, TierKey } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Users, Crown, Loader2, AlertTriangle } from "lucide-react";
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

const FamilyBilling = () => {
  const { user, checkSubscription } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    member: FamilyMember;
    newTier: TierKey;
  } | null>(null);

  const fetchFamily = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get parent profile + all linked children
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

      // Add self
      if (profileRes.data) {
        familyMembers.push({
          user_id: profileRes.data.user_id,
          name: profileRes.data.athlete_name || profileRes.data.full_name || "You",
          email: profileRes.data.email || "",
          tier: (profileRes.data.subscription_tier as TierKey) || "free",
          is_self: true,
        });
      }

      // Add children
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
    } catch (err: any) {
      toast({ title: "Error loading family", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [user]);

  const handleTierSelect = (member: FamilyMember, newTier: string) => {
    if (newTier === member.tier) return;
    setPendingChange({ member, newTier: newTier as TierKey });
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingChange) return;
    setUpdating(true);
    setConfirmOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("update-family-tier", {
        body: {
          memberUserId: pendingChange.member.user_id,
          newTier: pendingChange.newTier,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Tier updated!",
        description: `${pendingChange.member.name}'s access updated to ${TIERS[pendingChange.newTier].name}. New family total: $${data.familyTotal}/mo.`,
      });

      // Refresh data
      await Promise.all([fetchFamily(), checkSubscription()]);
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
      setPendingChange(null);
    }
  };

  // Calculate family total
  const familyTotal = members.reduce((sum, m) => {
    const opt = TIER_OPTIONS.find((t) => t.key === m.tier);
    return sum + (opt?.price || 0);
  }, 0);

  // Calculate projected total if pending change
  const projectedTotal = pendingChange
    ? members.reduce((sum, m) => {
        const tier = m.user_id === pendingChange.member.user_id ? pendingChange.newTier : m.tier;
        const opt = TIER_OPTIONS.find((t) => t.key === tier);
        return sum + (opt?.price || 0);
      }, 0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="animate-spin text-primary" size={18} />
      </div>
    );
  }

  // Only show if there are linked children (family account)
  if (members.length <= 1) return null;

  return (
    <>
      <div className="bg-card border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Users size={12} /> Family Billing
          </h2>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Monthly Total</p>
            <p className="text-lg font-mono font-bold text-primary">${familyTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between bg-muted p-3 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {member.name[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {member.name}
                    {member.is_self && (
                      <span className="text-[9px] ml-1.5 text-muted-foreground font-normal uppercase tracking-widest">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                </div>
              </div>

              <Select
                value={member.tier === "free" ? undefined : member.tier}
                onValueChange={(val) => handleTierSelect(member, val)}
                disabled={updating}
              >
                <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-xs shrink-0">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      <span className="flex items-center gap-1.5">
                        <Crown size={10} className="text-primary" />
                        {opt.label} · ${opt.price}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground mt-3">
          Changes are prorated automatically. You only pay the difference for the rest of the billing cycle.
        </p>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle size={18} className="text-primary" />
              Confirm Tier Change
            </DialogTitle>
            <DialogDescription>
              This will update{" "}
              <strong className="text-foreground">
                {pendingChange?.member.name}
              </strong>
              's access to{" "}
              <strong className="text-primary">
                {pendingChange ? TIERS[pendingChange.newTier].name : ""}
              </strong>{" "}
              and adjust your monthly family total to{" "}
              <strong className="text-primary">${projectedTotal.toFixed(2)}/mo</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Current total</span>
              <span className="font-mono font-bold text-foreground">${familyTotal.toFixed(2)}/mo</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">New total</span>
              <span className="font-mono font-bold text-primary">${projectedTotal.toFixed(2)}/mo</span>
            </div>
            <div className="flex justify-between text-xs border-t border-border pt-2">
              <span className="text-muted-foreground">Difference</span>
              <span className={`font-mono font-bold ${projectedTotal > familyTotal ? "text-destructive" : "text-primary"}`}>
                {projectedTotal > familyTotal ? "+" : ""}${(projectedTotal - familyTotal).toFixed(2)}/mo
              </span>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setConfirmOpen(false); setPendingChange(null); }}
              className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={updating}
              className="bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {updating ? <Loader2 size={12} className="animate-spin" /> : <Crown size={12} />}
              Confirm Change
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FamilyBilling;
