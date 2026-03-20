import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gift, Dumbbell, Camera, Loader2, ArrowRight, Sparkles } from "lucide-react";

const PostureCapture = lazy(() => import("./PostureCapture"));

const PROMO_CODE = "WELCOME-M2";

interface WelcomeGiftModalProps {
  open: boolean;
  onClose: () => void;
}

type Screen = "gift" | "posture-offer" | "posture-capture" | "promo";

const WelcomeGiftModal = ({ open, onClose }: WelcomeGiftModalProps) => {
  const [screen, setScreen] = useState<Screen>("gift");
  const navigate = useNavigate();

  const handleDismiss = () => {
    localStorage.setItem("m2-welcome-gift-seen", "1");
    onClose();
  };

  const goToPromo = () => setScreen("promo");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-background border-border overflow-hidden [&>button]:hidden">
        {/* Screen 1: Gift announcement */}
        {screen === "gift" && (
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 mx-auto bg-primary/10 flex items-center justify-center">
              <Gift size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground uppercase tracking-widest">Welcome to M²</h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Coach Matt just dropped <strong>2 free workouts</strong> into your portal. No strings attached.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-start gap-3 bg-card border border-border p-3">
                <Dumbbell size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Death by Hang Cleans</p>
                  <p className="text-[10px] text-muted-foreground">4 rounds of hang clean combos + burpees. 10 reps each. No mercy.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-card border border-border p-3">
                <Dumbbell size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Matt's Mountain Workout</p>
                  <p className="text-[10px] text-muted-foreground">Pyramid-style: 6 exercises, each round adds one more. Beginner-friendly.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setScreen("posture-offer")}
              className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              Let's Go <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Screen 2: Posture analysis offer */}
        {screen === "posture-offer" && (
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 mx-auto bg-primary/10 flex items-center justify-center">
              <Camera size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground uppercase tracking-widest">Free Posture Analysis</h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Take a quick front and side photo — Coach Matt will analyze your posture and send you a personalized breakdown. <strong>100% free.</strong>
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setScreen("posture-capture")}
                className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={12} /> Let's Do It
              </button>
              <button
                onClick={goToPromo}
                className="w-full h-11 border-2 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:border-primary/40 hover:text-foreground transition-all flex items-center justify-center gap-2"
              >
                No, I'm Scared 😅
              </button>
            </div>
          </div>
        )}

        {/* Screen 2b: Camera capture */}
        {screen === "posture-capture" && (
          <div className="p-4">
            <Suspense fallback={
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            }>
              <PostureCapture
                onComplete={goToPromo}
                onSkip={goToPromo}
              />
            </Suspense>
          </div>
        )}

        {/* Screen 3: Promo */}
        {screen === "promo" && (
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 mx-auto bg-primary/10 flex items-center justify-center">
              <Sparkles size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground uppercase tracking-widest">One More Thing</h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Get <strong>50% off your first month</strong> of Basic membership. Real coaching, real programs, real results — for less than a protein shake.
              </p>
            </div>

            <div className="bg-card border-2 border-primary/30 p-4 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Your code</p>
              <p className="text-lg font-bold text-primary tracking-widest font-mono">{PROMO_CODE}</p>
              <p className="text-[10px] text-muted-foreground">Valid for 14 days · Basic plan only</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  handleDismiss();
                  navigate(`/pricing?promo=${PROMO_CODE}`);
                }}
                className="w-full h-11 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Claim 50% Off <ArrowRight size={12} />
              </button>
              <button
                onClick={handleDismiss}
                className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeGiftModal;
