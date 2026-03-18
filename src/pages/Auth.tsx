import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import m2Logo from "@/assets/m2-logo.jpg";
import { ArrowRight, Loader2, Gift, Users } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const inviteToken = searchParams.get("invite");

  // Redeem invite after login/signup
  useEffect(() => {
    if (!authLoading && user && inviteToken) {
      redeemInvite(inviteToken);
    } else if (!authLoading && user) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      navigate(redirect, { replace: true });
    }
  }, [user, authLoading]);

  const redeemInvite = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("redeem-parent-invite", {
        body: { token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Account linked!", description: "You're now connected to your parent's account." });
    } catch (err: any) {
      console.error("Invite redeem error:", err);
      // Don't block navigation on error
    }
    navigate(searchParams.get("redirect") || "/dashboard", { replace: true });
  };

  const [isSignUp, setIsSignUp] = useState(!!inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, athlete_name: athleteName },
        },
      });
      if (error) setError(error.message);
      else setSuccess("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        const params = new URLSearchParams(window.location.search);
        navigate(params.get("redirect") || "/dashboard");
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        setError(result.error.message || "Google sign-in failed");
      }
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-contain rounded-md mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-display text-foreground">
            {isSignUp ? "JOIN M² TRAINING" : "ATHLETE LOGIN"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real training. Real results.</p>
        </div>

        {isSignUp && (
          <div className="bg-primary/10 border border-primary/20 p-4 mb-5">
            <div className="flex items-start gap-2">
              <Gift size={16} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-foreground mb-1">Free with your account:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>✓ Monthly focus plans</li>
                  <li>✓ Member challenges & leaderboard</li>
                  <li>✓ Random awesome workouts that literally nobody could think of except Matt</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-card border-2 border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors mb-4 disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Parent / Guardian Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Name</label>
                <input
                  type="text"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-primary">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {isSignUp ? "Create Free Account" : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccess(""); }}
          className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-primary transition-m2"
        >
          {isSignUp ? "Already have an account? Sign in" : "New athlete? Create a free account"}
        </button>
      </div>
    </div>
  );
};

export default Auth;
