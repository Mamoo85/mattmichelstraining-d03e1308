import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Lock, UserPlus, CreditCard } from "lucide-react";

interface BlurGateProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const BlurGate = ({ children, requireSubscription = false }: BlurGateProps) => {
  const { user, loading, subscribed } = useAuth();
  const navigate = useNavigate();

  // While auth is resolving, just render children — no overlay, no flash
  if (loading) return <>{children}</>;

  const needsAuth = !user;
  const needsSub = user && requireSubscription && !subscribed;
  const showBlur = needsAuth || needsSub;

  if (!showBlur) return <>{children}</>;

  return (
    <div className="relative">
      {children}

      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-background/60">
        <div className="mx-4 max-w-sm w-full bg-card border-2 border-primary/30 p-6 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {needsAuth ? <Lock size={24} className="text-primary" /> : <CreditCard size={24} className="text-primary" />}
          </div>

          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
            {needsAuth ? "Sign Up to Unlock" : "Subscribe to Access"}
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {needsAuth
              ? "Create a free account to browse the M² portal. Subscribe to unlock all features."
              : "You need an active subscription to access this content. Plans start at $9.99/mo."}
          </p>

          <div className="space-y-2 pt-2">
            {needsAuth ? (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  <UserPlus size={14} /> Sign Up Free
                </button>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full py-2.5 border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  Already have an account? Log In
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/pricing")}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  <CreditCard size={14} /> View Plans
                </button>
                <p className="text-[10px] text-muted-foreground">
                  Launch Special: Foundation tier 50% off for 6 months
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlurGate;
