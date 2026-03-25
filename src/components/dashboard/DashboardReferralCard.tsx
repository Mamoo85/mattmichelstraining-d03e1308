import { useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";

const DashboardReferralCard = memo(() => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralLink = `https://mattmichelstraining.com?ref=${user?.id || ""}`;

  const { data: referralCount = 0 } = useQuery({
    queryKey: ["referral-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("profiles")
        .select("referral_count")
        .eq("user_id", user.id)
        .single();
      return (data as any)?.referral_count ?? 0;
    },
    enabled: !!user?.id,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-3">
        <p className="font-bold text-foreground">🤝 Refer a Friend</p>
        <p className="text-sm text-muted-foreground">Get 1 free week of coaching when they sign up.</p>
        <Input readOnly value={referralLink} className="text-xs truncate" />
        <Button className="w-full gap-2" onClick={handleCopy}>
          {copied ? <><Check size={14} className="text-green-400" /> Copied ✓</> : <><Copy size={14} /> Copy Link</>}
        </Button>
        <p className="text-xs text-muted-foreground text-center">You've referred {referralCount} friends</p>
      </CardContent>
    </Card>
  );
});

DashboardReferralCard.displayName = "DashboardReferralCard";
export default DashboardReferralCard;
