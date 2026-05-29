import { useEffect, useState } from "react";
import { podSupabase } from "@/integrations/supabase/podClient";

const STORAGE_KEY = "gng_exit_shown";

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setVisible(true);
        sessionStorage.setItem(STORAGE_KEY, "1");
        document.removeEventListener("mouseleave", handleMouseLeave);
      }
    };

    // Small delay so it doesn't fire on initial page load
    const timer = setTimeout(() => {
      document.addEventListener("mouseleave", handleMouseLeave);
    }, 3000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");

    try {
      const { error } = await podSupabase.from("etsy_email_signups").insert({
        email: email.trim().toLowerCase(),
        source: "exit_popup",
      });

      if (error && error.code !== "23505") {
        // 23505 = unique violation = already signed up (treat as success)
        console.warn("[ExitPopup] insert error", error.message);
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {status !== "done" ? (
          <>
            <div className="text-5xl mb-3">🎁</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Wait — get 10% off!
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              Subscribe and we'll send you a{" "}
              <strong>10% off coupon</strong> for your first order — plus new
              drops and gift ideas every week.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
              >
                {status === "loading" ? "Sending…" : "Get My 10% Off Code"}
              </button>
              {status === "error" && (
                <p className="text-red-500 text-xs">Something went wrong — please try again.</p>
              )}
            </form>

            <p className="text-xs text-gray-400 mt-4">
              No spam. Unsubscribe anytime.
            </p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're in!</h2>
            <p className="text-gray-600 text-sm">
              Check your email for your <strong>WELCOME10</strong> coupon code. Use
              it on any Etsy order — free US shipping always included.
            </p>
            <button
              onClick={() => setVisible(false)}
              className="mt-6 text-orange-500 underline text-sm"
            >
              Continue shopping
            </button>
          </>
        )}
      </div>
    </div>
  );
}
