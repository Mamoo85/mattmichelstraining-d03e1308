import { useState, useEffect, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, X, Share2, Copy, Check } from "lucide-react";

const DashboardReferralCard = memo(() => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [shared, setShared] = useState(false);

  const referralUrl = `https://mattmichelstraining.com?ref=${user?.id || ""}`;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("invite_card_dismissed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setDismissed((data as any)?.invite_card_dismissed ?? false);
      });
  }, [user]);

  const handleDismiss = async () => {
    setDismissed(true);
    if (user) {
      await supabase.from("profiles").update({ invite_card_dismissed: true } as any).eq("user_id", user.id);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Train with me on M²",
      text: "I've been using this training app — try it free for 14 days:",
      url: referralUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(referralUrl);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  if (!user || dismissed === null) return null;

  // Compact link when dismissed
  if (dismissed) {
    return (
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 text-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
      >
        <Users size={12} /> Invite a Friend →
      </button>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <p className="font-bold text-foreground text-lg">Train with Someone You Know</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite a training partner to the app. You'll push each other, compete on the leaderboard, and keep each other accountable.
        </p>
        <Button className="w-full gap-2" onClick={handleShare}>
          {shared ? (
            <>
              <Check size={14} className="text-green-400" /> Copied ✓
            </>
          ) : (
            <>
              <Share2 size={14} /> Send an Invite
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
});

DashboardReferralCard.displayName = "DashboardReferralCard";
export default DashboardReferralCard;
