import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AcceptTeamInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const accept = async () => {
    setState("working");
    const { data, error } = await supabase.functions.invoke("team-seat-manager?action=accept", {
      body: { token },
    });
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error || error?.message || "Couldn't accept invite");
      setState("error");
    } else {
      setState("ok");
      setTimeout(() => navigate("/my-team"), 1500);
    }
  };

  useEffect(() => {
    if (!authLoading && user && token && state === "idle") accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <Helmet>
        <title>Accept Team Invite · DWA</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Card className="p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold mb-3">Team Invitation</h1>
        {!token && <p className="text-sm text-destructive">Missing or invalid invite link.</p>}
        {token && authLoading && (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </p>
        )}
        {token && !authLoading && !user && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in or create an account with the email this invite was sent to.
            </p>
            <Button asChild className="w-full">
              <Link to={`/auth?redirect=${encodeURIComponent(`/accept-team-invite?token=${token}`)}`}>
                Sign in to accept
              </Link>
            </Button>
          </>
        )}
        {token && user && state === "working" && (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Accepting…
          </p>
        )}
        {state === "ok" && (
          <div className="space-y-2">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm">You're in! Redirecting…</p>
          </div>
        )}
        {state === "error" && (
          <div className="space-y-3">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">
              {errorMsg === "email_mismatch"
                ? "This invite was sent to a different email. Sign in with that email to accept."
                : errorMsg === "revoked"
                  ? "This invitation has been revoked."
                  : errorMsg === "invalid_token"
                    ? "Invitation not found."
                    : "Couldn't accept the invitation."}
            </p>
            <Button asChild variant="outline">
              <Link to="/">Back home</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
