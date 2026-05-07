import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    // Add noindex so search engines don't surface this page.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    // ONE-CLICK UNSUB (CAN-SPAM / RFC 8058 best practice).
    // Previously this was a 2-step flow (validate → confirm) which caused ~76% of
    // people who landed here to never confirm — leaving us thinking they unsubbed
    // when they actually didn't. Now the visit itself unsubscribes.
    const unsubscribeImmediately = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
          body: { token },
        });
        if (error) throw error;
        if (data?.success) {
          setStatus("success");
        } else if (data?.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data?.valid === false) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    unsubscribeImmediately();
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
          alt="M2 Training"
          className="w-12 h-12 mx-auto"
        />

        {status === "loading" && (
          <p className="text-muted-foreground">Validating...</p>
        )}

        {status === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Unsubscribe</h1>
            <p className="text-muted-foreground">
              Are you sure you want to unsubscribe from M2 Training emails?
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
