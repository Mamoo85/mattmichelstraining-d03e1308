import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import m2Logo from "@/assets/m2-logo.jpg";
import { ArrowRight, Loader2, Gift, Users, Mail, User, UserPlus, AlertTriangle } from "lucide-react";
import NutritionSneakPeek from "@/components/auth/NutritionSneakPeek";

type SignupRole = "self" | "parent";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const inviteToken = searchParams.get("invite");
  const ipToken = searchParams.get("ip");

  useEffect(() => {
    if (authLoading || !user) return;

    const handlePostAuth = async () => {
      // Redeem in-person invite token if present
      if (ipToken) {
        try {
          const { data, error } = await supabase.functions.invoke("admin-user-manage", {
            body: { action: "redeem_ip_invite", token: ipToken },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast({ title: "You're in!", description: "Welcome to M2 Training — your portal is ready." });
        } catch (err: any) {
          console.warn("[IP-INVITE] Redeem error:", err.message);
        }
        navigate("/dashboard", { replace: true });
        return;
      }

      // Redeem parent invite token if present
      if (inviteToken) {
        await redeemInvite(inviteToken);
        return;
      }

      const redirect = searchParams.get("redirect") || "/dashboard";
      navigate(redirect, { replace: true });
    };

    handlePostAuth();
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
  const [signupRole, setSignupRole] = useState<SignupRole>("self");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [athleteName, setAthleteName] = useState("");
  // Parent flow: child fields
  const [childEmail, setChildEmail] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const isMinor = dateOfBirth ? (calculateAge(dateOfBirth) ?? 99) < 18 : false;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const buildAuthRedirectUrl = useCallback((fallbackPath: string) => {
    const redirect = searchParams.get("redirect") || fallbackPath;
    const url = new URL("/auth", window.location.origin);

    url.searchParams.set("redirect", redirect);

    if (inviteToken) {
      url.searchParams.set("invite", inviteToken);
    }

    if (ipToken) {
      url.searchParams.set("ip", ipToken);
    }

    return url.toString();
  }, [inviteToken, ipToken, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: buildAuthRedirectUrl("/dashboard") },
      });
      if (error) setError(error.message);
      else setSuccess("Check your inbox — tap the link to log in instantly.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      // Parent flow: create parent first, then child via edge function
      const accountRole = signupRole === "parent" ? "parent" : "independent_adult";
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildAuthRedirectUrl("/welcome"),
          data: { full_name: `${firstName.trim()} ${lastName.trim()}`, athlete_name: signupRole === "self" ? athleteName : "", account_role: accountRole, date_of_birth: dateOfBirth || null },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // If parent flow and child details provided, create child account
      if (signupRole === "parent" && childEmail && childPassword && childName) {
        setSuccess("Parent account created! Now setting up your athlete's account…");
        try {
          const { error: childError } = await supabase.functions.invoke("create-child-account", {
            body: { childEmail, childPassword, childName },
          });
          if (childError) {
            setSuccess("Parent account created! Check your email to confirm. You can invite your athlete later from your profile.");
          } else {
            setSuccess("Both accounts created! Check both email inboxes to confirm, then sign in.");
          }
        } catch {
          setSuccess("Parent account created! Check your email to confirm. You can invite your athlete later from your profile.");
        }
      } else {
        setSuccess("Check your email to confirm your account.");
      }

      // Fire welcome email (fire-and-forget)
      if (signUpData?.user?.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome",
            recipientEmail: signUpData.user.email,
            idempotencyKey: `welcome-${signUpData.user.id}`,
            templateData: { name: firstName.trim() },
          },
        }).catch(() => {});
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Login successful. Redirecting...");
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    setSuccess("");
    console.log("[GOOGLE-AUTH] Starting Google sign-in, origin:", window.location.origin);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      console.log("[GOOGLE-AUTH] Result:", JSON.stringify(result, null, 2));
      if (result?.error) {
        const msg = result.error.message || "Google sign-in failed";
        console.error("[GOOGLE-AUTH] Error:", msg);
        if (msg.toLowerCase().includes("interrupted") || msg.toLowerCase().includes("popup")) {
          setError("Sign-in was interrupted. Please try again — make sure popups aren't blocked.");
        } else {
          setError(msg);
        }
      }
    } catch (e: any) {
      console.error("[GOOGLE-AUTH] Catch:", e);
      const msg = e.message || "Google sign-in failed";
      if (msg.toLowerCase().includes("interrupted") || msg.toLowerCase().includes("popup")) {
        setError("Connection interrupted. Check your internet and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 overflow-y-auto pb-safe">
      <div className="max-w-sm w-full my-8">
        <div className="text-center mb-8">
          <img src={m2Logo} alt="M2 Training" className="w-20 h-20 object-contain rounded-md mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-display text-foreground">
            {mode === "signup" ? "JOIN M2 TRAINING" : "ATHLETE LOGIN"}
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
                  Create an account or sign in to link with your parent's M2 Training account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Signup Role Toggle — only on signup, not invite flow */}
        {mode === "signup" && !inviteToken && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSignupRole("self")}
                className={`flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest border-2 transition-all ${
                  signupRole === "self"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <User size={14} />
                For Myself
              </button>
              <button
                type="button"
                onClick={() => setSignupRole("parent")}
                className={`flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest border-2 transition-all ${
                  signupRole === "parent"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <UserPlus size={14} />
                Parent + Athlete
              </button>
            </div>

            <div className="bg-primary/10 border border-primary/20 p-4 mb-5">
              <div className="flex items-start gap-2">
                <Gift size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  {signupRole === "parent" ? (
                    <>
                      <p className="text-xs font-bold text-foreground mb-1">Parent + Athlete Account</p>
                      <p className="text-xs text-muted-foreground">
                        Create your parent account and your athlete's account together. One subscription covers both. After trial, defaults to Foundation ($19.99/mo).
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-foreground mb-1">Free with your account:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>✓ Monthly focus plans</li>
                        <li>✓ Member challenges & leaderboard</li>
                        <li>✓ Random awesome workouts that literally nobody could think of except Matt</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
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


        {/* Magic Link */}
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                    required
                  />
                </div>
              </div>
              {signupRole === "self" && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete Name (optional)</label>
                  <input
                    type="text"
                    value={athleteName}
                    onChange={(e) => setAthleteName(e.target.value)}
                    className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  required
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              {isMinor && signupRole === "self" && (
                <div className="bg-destructive/10 border border-destructive/30 p-4 rounded">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground mb-1">Athletes under 18 need a parent account</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Michigan law requires parental consent for users under 18 on interactive platforms. Switch to "Parent + Athlete" to create both accounts together.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSignupRole("parent")}
                        className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                      >
                        Switch to Parent Signup →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
              {mode === "signup" && signupRole === "parent" ? "Parent Email" : "Email"}
            </label>
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
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                {mode === "signup" && signupRole === "parent" ? "Parent Password" : "Password"}
              </label>
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

          {/* Child account fields for parent signup */}
          {mode === "signup" && signupRole === "parent" && (
            <div className="border-t border-border pt-3 mt-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-mono">Athlete's Account</p>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Name</label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Email</label>
                <input
                  type="email"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Password</label>
                <input
                  type="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 accent-primary w-4 h-4 shrink-0"
              />
              <span className="text-[11px] text-muted-foreground leading-tight">
                I agree to the{" "}
                <a href="/about#terms" target="_blank" className="text-primary hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="/about#privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>
              </span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-primary">{success}</p>}

          <button
            type="submit"
            disabled={loading || (mode === "signup" && !termsAccepted) || (mode === "signup" && signupRole === "self" && isMinor)}
            className="w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : mode === "magic" ? <Mail size={15} /> : <ArrowRight size={15} />}
            {mode === "magic" ? "Send Login Link" : mode === "signup" ? (signupRole === "parent" ? "Create Both Accounts" : "Create Free Account") : "Sign In"}
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

        {/* Trouble signing in helper — addresses iCloud prefetch issue */}
        {mode === "login" && (
          <div className="bg-accent/10 border border-accent/30 p-3 mt-4">
            <p className="text-[11px] font-bold text-foreground mb-1">Trouble signing in?</p>
            <p className="text-[10px] text-muted-foreground mb-2">
              iCloud and some email providers can block verification links. Use a <strong>Magic Link</strong> or <strong>Google</strong> to sign in instantly.
            </p>
            <button
              onClick={() => { setMode("magic"); setError(""); setSuccess(""); }}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              Send me a Magic Link →
            </button>
          </div>
        )}

        {/* Nutrition AI Sneak Peek */}
        <NutritionSneakPeek />
      </div>
    </div>
  );
};

export default Auth;
