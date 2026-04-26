import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

/**
 * /reset-password — public route.
 * Handles the recovery callback from password reset emails. Supabase parses the
 * URL hash and fires PASSWORD_RECOVERY; we then let the user set a new password
 * via supabase.auth.updateUser({ password }) and redirect to /dashboard.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"checking" | "ready" | "saving" | "done" | "error">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setPhase("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setPhase("ready");
      } else {
        timeoutId = window.setTimeout(() => {
          if (!active) return;
          setPhase((prev) => {
            if (prev === "checking") {
              setError("Reset link expired or invalid. Request a new one from the sign-in page.");
              return "error";
            }
            return prev;
          });
        }, 1800);
      }
    });

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPhase("saving");
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setPhase("ready");
      return;
    }
    setPhase("done");
    setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="text-primary" size={20} />
          <h1 className="text-xl font-bold text-foreground">Reset your password</h1>
        </div>

        {phase === "checking" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm">Verifying your reset link…</span>
          </div>
        )}

        {phase === "error" && (
          <div className="bg-destructive/10 border border-destructive/30 p-4 rounded">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">Can't reset password</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <button
                  onClick={() => navigate("/auth")}
                  className="mt-3 text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Back to sign in →
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="bg-primary/10 border border-primary/30 p-4 rounded">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">Password updated</p>
                <p className="text-xs text-muted-foreground mt-1">Redirecting you to your dashboard…</p>
              </div>
            </div>
          </div>
        )}

        {(phase === "ready" || phase === "saving") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a new password for your account. Min 8 characters.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none rounded"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full bg-card border border-border px-3 py-3 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none rounded"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={phase === "saving"}
              className="w-full bg-primary text-primary-foreground px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 rounded"
            >
              {phase === "saving" ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
