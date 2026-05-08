import { ReactNode, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const KEY = "dj_sandbox_session";
const ALLOWED = ["pmichels@djconley.com", "matt@detroitwebagent.com", "pat@djconley.com"];
// Demo passcode — change before pitch day. Easy for Pat to type.
const PASSCODE = "boiler1948";

export function isLoggedIn() {
  try { return Boolean(localStorage.getItem(KEY)); } catch { return false; }
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(isLoggedIn());
  if (!ok) return <LoginScreen onSuccess={() => setOk(true)} />;
  return <>{children}</>;
}

export function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const lower = email.trim().toLowerCase();
    if (!ALLOWED.includes(lower)) {
      setErr("Email not authorized for this sandbox.");
      return;
    }
    if (pass !== PASSCODE) {
      setErr("Incorrect passcode.");
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ email: lower, at: Date.now() }));
    if (onSuccess) onSuccess(); else nav("/sandbox/djconley/admin");
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
          <p className="text-slate-400 text-sm">Sandbox preview — by invitation only.</p>
        </div>

        <form onSubmit={submit} className="bg-[#111d2b] border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0b1622] border border-white/10 rounded-md px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#27CCC0]"
              placeholder="pmichels@djconley.com"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">Passcode</label>
            <input
              type="password"
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full bg-[#0b1622] border border-white/10 rounded-md px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#27CCC0]"
              placeholder="••••••••"
            />
          </div>
          {err && <div className="text-xs text-[#c12a3b]">{err}</div>}
          <button type="submit" className="w-full bg-[#27CCC0] hover:bg-[#1fa89d] text-[#0b1622] font-bold py-2.5 rounded-md transition">
            Enter Command Center
          </button>
          <Link to="/sandbox/djconley" className="block text-center text-xs text-slate-500 hover:text-slate-300">
            ← Back to djconley.com preview
          </Link>
        </form>
      </div>
    </div>
  );
}
