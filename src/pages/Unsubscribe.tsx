import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src="/images/m2-development-logo.png"
          alt="M² Training"
          className="w-12 h-12 mx-auto"
        />

        {status === "loading" && (
          <p className="text-muted-foreground">Validating...</p>
        )}

        {status === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Unsubscribe</h1>
            <p className="text-muted-foreground">
              Are you sure you want to unsubscribe from M² Training emails?
            </p>
            <button
              onClick={handleUnsubscribe}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">You're Unsubscribed</h1>
            <p className="text-muted-foreground">
              You won't receive any more app emails from us. We'll miss you in the community of badassness. 💪
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Already Unsubscribed</h1>
            <p className="text-muted-foreground">
              You've already unsubscribed from these emails.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Something Went Wrong</h1>
            <p className="text-muted-foreground">
              We couldn't process your request. Please try again later.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
