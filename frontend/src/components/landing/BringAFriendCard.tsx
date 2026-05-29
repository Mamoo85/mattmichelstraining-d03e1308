import { memo } from "react";
import { Link } from "react-router-dom";
import { Users, ArrowRight, Heart } from "lucide-react";

/**
 * Parent-to-parent referral card for /for-parents page.
 * Promotes 20% off for both families when they sign up together.
 */
const BringAFriendCard = memo(() => (
  <div className="bg-card border-2 border-primary/30 p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
        <Users size={20} className="text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-tight text-foreground">
            Bring Another Family
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5">
            20% Off Each
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Parent-to-Parent Referral
        </p>
      </div>
    </div>

    <p className="text-xs text-muted-foreground leading-relaxed">
      Know another family whose kid needs real coaching? When you both sign up using each other's referral code, 
      <strong className="text-foreground"> both families get 20% off their first month</strong>. Talk about it at the game, 
      send a text from the bleachers — it's that easy.
    </p>

    <div className="bg-primary/5 border border-primary/15 p-3 flex items-start gap-2">
      <Heart size={14} className="text-primary mt-0.5 shrink-0" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">How it works:</strong> Both families sign up with each other's referral links. 
        The 20% discount is automatically applied to both first bills. No code needed — just share your link from your dashboard.
      </p>
    </div>

    <div className="flex flex-col sm:flex-row gap-2">
      <Link
        to="/auth?redirect=/trial-welcome?path=parent"
        className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        Start Your Free Trial <ArrowRight size={12} />
      </Link>
      <Link
        to="/pricing"
        className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-primary/40 text-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
      >
        View All Plans
      </Link>
    </div>
  </div>
));

BringAFriendCard.displayName = "BringAFriendCard";

export default BringAFriendCard;
