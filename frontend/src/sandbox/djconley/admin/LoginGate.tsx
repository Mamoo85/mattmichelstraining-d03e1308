import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { djPath } from "../links";

// Emails authorized for the DJ Conley Command Center.
const ALLOWED = ["pmichels@djconley.com", "pat@djconley.com", "matt@detroitwebagent.com"];
// Offline-demo fallback (no email delivery needed). Magic-link is the primary path.
const PASSCODE = "boiler1948";
const PASS_KEY = "dj_sandbox_session";

const isAllowed = (email?: string | null) =>
  !!email && ALLOWED.includes(email.trim().toLowerCase());

export function hasPasscodeSession() {
  try { return Boolean(localStorage.getItem(PASS_KEY)); } catch { return false; }
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");

  const evaluate = useCallback(async () => {
    if (hasPasscodeSession()) { setState("in"); return; }
    const { data } = await supabase.auth.getSession();
    setState(isAllowed(data.session?.user?.email) ? "in" : "out");
  }, []);

  useEffect(() => {
    evaluate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => evaluate());
    return () => sub.subscription.unsubscribe();
  }, [evaluate]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#0b1622] flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading Command Center…</p>
      </div>
    );
  }
  if (state === "out") return <LoginScreen onSuccess={() => setState("in")} />;
  return <>{children}</>;
}

export function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // If the user lands here already authenticated via a magic link, let them in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (isAllowed(data.session?.user?.email)) onSuccess?.();
    });
  }, [onSuccess]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const lower = email.trim().toLowerCase();
    if (!ALLOWED.includes(lower)) {
      setErr("That email isn't authorized for this command center. Contact Detroit Web Agency for access.");
      return;
    }
    setBusy(true);
    const redirectTo = `${window.location.origin}${djPath("/admin")}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: lower,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  };

  const submitPass = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const lower = email.trim().toLowerCase();
    if (!ALLOWED.includes(lower)) { setErr("Email not authorized for this sandbox."); return; }
    if (pass !== PASSCODE) { setErr("Incorrect passcode."); return; }
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ email: lower, at: Date.now() })); } catch { /* ignore */ }
    onSuccess?.();
  };

  return (
    <div className="min-h-screen bg-[#0b1622] flex items-center justify-center px-5" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#27CCC0] to-[#1fa89d] flex items-center justify-center text-[#0b1622] font-black">🔥</div>
            <div className="text-left leading-tight">
              <div className="text-white font-bold">D.J. Conley</div>
              <div className="text-[10px] uppercase tracking-widest text-[#27CCC0]">Command Center</div>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Secure access — by invitation only.</p>
        </div>

        {sent ? (
          <div className="bg-[#111d2b] border border-white/10 rounded-xl p-6 text-center space-y-3">
            <div className="text-3xl">📧</div>
            <div className="text-white font-bold">Check your inbox</div>
            <p className="text-slate-400 text-sm">
              We sent a one-click secure login link to <span className="text-[#27CCC0]">{email.trim().toLowerCase()}</span>.
              Open it on this device to enter the command center.
            </p>
            <button onClick={() => { setSent(false); setErr(""); }} className="text-xs text-slate-500 hover:text-slate-300">
              ← Use a different email
            </button>
          </div>
        ) : showPass ? (
          <form onSubmit={submitPass} className="bg-[#111d2b] border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b1622] border border-white/10 rounded-md px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#27CCC0]"
                placeholder="pmichels@djconley.com" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">Access code</label>
              <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)}
                className="w-full bg-[#0b1622] border border-white/10 rounded-md px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#27CCC0]"
                placeholder="••••••••" />
            </div>
            {err && <div className="text-xs text-[#c12a3b]">{err}</div>}
            <button type="submit" className="w-full bg-[#27CCC0] hover:bg-[#1fa89d] text-[#0b1622] font-bold py-2.5 rounded-md transition">
              Enter Command Center
            </button>
            <button type="button" onClick={() => { setShowPass(false); setErr(""); }} className="block w-full text-center text-xs text-slate-500 hover:text-slate-300">
              ← Use email login link instead
            </button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="bg-[#111d2b] border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">Work email</label>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0b1622] border border-white/10 rounded-md px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#27CCC0]"
                placeholder="pmichels@djconley.com" />
            </div>
            {err && <div className="text-xs text-[#c12a3b]">{err}</div>}
            <button type="submit" disabled={busy} className="w-full bg-[#27CCC0] hover:bg-[#1fa89d] disabled:opacity-60 text-[#0b1622] font-bold py-2.5 rounded-md transition">
              {busy ? "Sending…" : "Email me a login link"}
            </button>
            <p className="text-[11px] text-slate-500 text-center">No password to remember — we email you a secure one-click link.</p>
            <button type="button" onClick={() => { setShowPass(true); setErr(""); }} className="block w-full text-center text-xs text-slate-600 hover:text-slate-400">
              Have an access code? Use it instead
            </button>
          </form>
        )}

        <Link to={djPath()} className="block text-center text-xs text-slate-500 hover:text-slate-300 mt-5">
          ← Back to djconley.com
        </Link>
      </div>
    </div>
  );
}
