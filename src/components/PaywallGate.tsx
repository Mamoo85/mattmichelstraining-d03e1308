import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth, TierKey } from "@/hooks/useAuth";

const TIER_LEVEL: Record<string, number> = {
  basic: 1,
  pro: 2,
  elite: 3,
  team: 4,
};

interface PaywallGateProps {
  requiredTier: TierKey;
  featureName: string;
  children: React.ReactNode;
}

const PaywallGate = ({ requiredTier, featureName, children }: PaywallGateProps) => {
  const { subscriptionTier, user } = useAuth();

  const userLevel = subscriptionTier ? (TIER_LEVEL[subscriptionTier] ?? 0) : 0;
  const requiredLevel = TIER_LEVEL[requiredTier] ?? 0;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  const tierNames: Record<string, string> = {
    basic: "M² Basic ($14.99/mo)",
    pro: "M² Pro ($29.99/mo)",
    elite: "M² Elite ($49.99/mo)",
    team: "M² Team ($99.99/mo)",
  };

  return (
    <div className="bg-card shadow-m2 p-8 text-center">
      <Lock size={32} className="text-muted-foreground mx-auto mb-4" />
      <h3 className="text-base font-bold text-foreground mb-2">{featureName}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        {user
          ? `This feature requires ${tierNames[requiredTier] || requiredTier} or higher. Upgrade your plan to unlock it.`
          : "Sign in and subscribe to access this feature."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {user ? (
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            View Plans
          </Link>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
};

export default PaywallGate;
