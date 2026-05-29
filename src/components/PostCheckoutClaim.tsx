import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "idle" | "loading" | "done" | "error";

const CLAIMED_KEY = "pcc_claimed_sessions";

function getClaimedSessions(): Set<string> {
  try {
    const raw = localStorage.getItem(CLAIMED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markClaimed(sessionId: string) {
  const sessions = getClaimedSessions();
  sessions.add(sessionId);
  try {
    localStorage.setItem(CLAIMED_KEY, JSON.stringify([...sessions].slice(-20)));
  } catch {}
}

/**
 * Drop this on any DWA post-checkout success page.
 * Reads ?session_id= from URL, calls claim-session to email the customer
 * a magic login link. Renders a status card; returns null if no session_id.
 */
export default function PostCheckoutClaim({ productName = "Detroit Web Agency" }: { productName?: string }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<State>("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    if (getClaimedSessions().has(sessionId)) {
      setState("done");
      return;
    }

    setState("loading");
    supabase.functions
      .invoke("claim-session", { body: { session_id: sessionId } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          console.error("[PostCheckoutClaim]", error ?? data?.error);
          setState("error");
        } else {
          markClaimed(sessionId);
          setSentTo(data?.email ?? null);
          setState("done");
        }
      })
      .catch((e) => {
        console.error("[PostCheckoutClaim]", e);
        setState("error");
      });
  }, [sessionId]);

  if (!sessionId || state === "idle") return null;

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-900/60 p-4 sm:p-5 w-full max-w-md mx-auto">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-300 shrink-0">
          {state === "loading" ? (
            <Loader2 size={20} className="animate-spin" />
          ) : state === "done" ? (
            <CheckCircle2 size={20} className="text-emerald-400" />
          ) : (
            <AlertCircle size={20} className="text-amber-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {state === "loading" && (
            <>
              <div className="text-base font-bold text-slate-100">Setting up your account…</div>
              <div className="mt-1 text-sm text-slate-400">Generating your login link — takes a second.</div>
            </>
          )}

          {state === "done" && (
            <>
              <div className="text-base font-bold text-slate-100">Check your email for the login link</div>
              <div className="mt-1 text-sm text-slate-400">
                {sentTo ? (
                  <>
                    We sent a one-click login link to{" "}
                    <span className="font-semibold text-slate-200">{sentTo}</span>. No password needed.
                  </>
                ) : (
                  <>
                    We sent a one-click login link to the email you used at checkout. No password needed.
                  </>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Can't find it? Check spam, or text{" "}
                <a
                  href="sms:+13139921219"
                  className="text-cyan-400 hover:underline"
                >
                  (313) 992-1219
                </a>{" "}
                and we'll sort it out.
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="text-base font-bold text-slate-100">Couldn't send the login link</div>
              <div className="mt-1 text-sm text-slate-400">
                Your payment went through. Text{" "}
                <a href="sms:+13139921219" className="text-cyan-400 hover:underline">
                  (313) 992-1219
                </a>{" "}
                and we'll get you set up manually — usually within a few minutes.
              </div>
            </>
          )}
        </div>

        {state === "done" && (
          <Mail size={18} className="text-cyan-500 shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}
