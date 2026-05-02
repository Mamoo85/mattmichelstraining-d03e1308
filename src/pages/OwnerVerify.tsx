import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

export default function OwnerVerify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing token.");
      return;
    }
    (async () => {
      const { data, error: invokeError } = await supabase.functions.invoke("owner-magic-link-verify", { body: { token } });
      if (invokeError || !data?.ok) {
        setError(data?.error === "token_expired" ? "Link expired. Request a new one." : data?.error === "token_used" ? "Link already used." : "Invalid link.");
        return;
      }
      localStorage.setItem("owner_session", data.session);
      localStorage.setItem("owner_email", data.email);
      navigate("/owner/dashboard", { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-semibold mb-2">Sign-in failed</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href="/owner/login" className="text-primary text-sm underline">Request a new link</a>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </Card>
    </div>
  );
}
