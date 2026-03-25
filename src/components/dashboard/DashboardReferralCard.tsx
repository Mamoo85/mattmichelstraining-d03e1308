import { useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Users } from "lucide-react";

const DashboardReferralCard = memo(() => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralLink = `https://mattmichelstraining.com?ref=${user?.id || ""}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <p className="font-bold text-foreground text-lg">Refer a Friend</p>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-3 py-2 text-center">
          <span className="text-xs font-black uppercase tracking-widest text-primary">Free for now</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Know someone who should be training with M²? Send them your link — it's completely free to join right now.
        </p>
        <Input readOnly value={referralLink} className="text-xs truncate" />
        <Button className="w-full gap-2" onClick={handleCopy}>
          {copied ? <><Check size={14} className="text-green-400" /> Copied ✓</> : <><Copy size={14} /> Copy Link</>}
        </Button>
      </CardContent>
    </Card>
  );
});

DashboardReferralCard.displayName = "DashboardReferralCard";
export default DashboardReferralCard;
