import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import m2Logo from "@/assets/m2-logo.jpg";
import { ArrowRight, Loader2, Gift, Users, Mail } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const inviteToken = searchParams.get("invite");

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
      // silent in production
    }
    navigate(searchParams.get("redirect") || "/dashboard", { replace: true });
  };

  const [mode, setMode] = useState<"login" | "signup" | "magic">(inviteToken ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else setSuccess("Check your inbox — tap the link to log in instantly.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
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
      else if (!inviteToken) {
        navigate(searchParams.get("redirect") || "/dashboard");
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

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        setError(result.error.message || "Apple sign-in failed");
      }
    } catch (e: any) {
      setError(e.message || "Apple sign-in failed");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 overflow-y-auto pb-safe">
      <div className="max-w-sm w-full my-8">
        <div className="text-center mb-8">
          <img src={m2Logo} alt="M² Training" className="w-20 h-20 object-contain rounded-md mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-display text-foreground">
            {mode === "signup" ? "JOIN M² TRAINING" : "ATHLETE LOGIN"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real training. Real results.</p>
        </div>

        {inviteToken && (
          <div className="bg-accent/20 border border-accent/40 p-4 mb-5">
            <div className="flex items-start gap-2">
              <Users size={16} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-foreground mb-1">You've been invited!</p>
                <p className="text-xs text-muted-foreground">
                  Create an account or sign in to link with your parent's M² Training account.
                </p>
              </div>
            </div>
          </div>
        )}

        {mode === "signup" && !inviteToken && (
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
          className="w-full flex items-center justify-center gap-3 bg-card border-2 border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors mb-3 disabled:opacity-50"
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

        {/* Apple Sign In */}
        <button
          onClick={handleAppleSignIn}
          disabled={appleLoading}
          className="w-full flex items-center justify-center gap-3 bg-card border-2 border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors mb-3 disabled:opacity-50"
        >
          {appleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          Continue with Apple
        </button>
        {mode !== "magic" && (
          <button
            onClick={() => { setMode("magic"); setError(""); setSuccess(""); }}
            className="w-full flex items-center justify-center gap-3 bg-card border-2 border-border px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors mb-4"
          >
            <Mail size={18} />
            Sign in with Email Link
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {mode === "magic" ? "magic link" : "or use password"}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
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

          {mode !== "magic" && (
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
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-primary">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : mode === "magic" ? <Mail size={15} /> : <ArrowRight size={15} />}
            {mode === "magic" ? "Send Login Link" : mode === "signup" ? "Create Free Account" : "Sign In"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-4">
          {mode === "magic" ? (
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="text-sm text-muted-foreground hover:text-primary transition-m2"
            >
              Use password instead
            </button>
          ) : (
            <button
              onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setSuccess(""); }}
              className="text-sm text-muted-foreground hover:text-primary transition-m2"
            >
              {mode === "signup" ? "Already have an account? Sign in" : "New athlete? Create a free account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
