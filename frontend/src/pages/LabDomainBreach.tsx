import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Shield, AlertTriangle, Lock, Search } from "lucide-react";

export default function LabDomainBreach() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("success") === "1";
  const [form, setForm] = useState({ customer_email: "", domain: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.domain) { toast.error("Email and domain are required."); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-domain-breach-checkout", {
        body: { customer_email: form.customer_email, domain: form.domain },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Text Matt: (313) 992-1219");
    } finally { setSubmitting(false); }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <div className="text-center space-y-4 p-8 max-w-sm">
          <CheckCircle size={52} className="mx-auto text-cyan-400" />
          <h1 className="text-2xl font-black text-white">Report Incoming</h1>
          <p className="text-slate-300 text-sm">Your domain breach report will arrive within 2 minutes. Check spam if you don't see it.</p>
          <p className="text-slate-500 text-xs">Questions? Text Matt: (313) 992-1219</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a1628", fontFamily: "system-ui, sans-serif" }}>
      <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
        <div className="text-center mb-8">
          <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff44" }}>
            Instant · $19 One-Time · No Subscription
          </span>
          <h1 className="text-3xl font-black text-white leading-tight mb-4">
            Are Your Employees'<br />Credentials For Sale?
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Enter your company domain. We scan 12+ billion compromised accounts across 600+ data breaches and email you every exposure — with exact remediation steps.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {[
            { icon: <Search size={15} />, text: "Every breach your domain has appeared in — since 2007" },
            { icon: <AlertTriangle size={15} />, text: "Exactly which data types were exposed (passwords, emails, SSNs)" },
            { icon: <Shield size={15} />, text: "AI-written remediation steps for each critical breach" },
            { icon: <Lock size={15} />, text: "Same database used by 1Password, Firefox, and the UK NCSC" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="shrink-0" style={{ color: "#00d4ff" }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" required placeholder="yourcompany.com"
            value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <input type="email" required placeholder="Your email (report delivered here)"
            value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "#00d4ff" }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {submitting ? "Processing…" : "Scan My Domain — $19"}
          </button>
          <p className="text-center text-xs text-slate-500">Secure checkout · Report in ~60 sec · One-time payment</p>
        </form>
      </div>

      <div className="max-w-lg mx-auto px-5 pb-12">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4ff88" }}>Sample Output</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-500 ml-2">Domain Breach Report — yourcompany.com</span>
          </div>
          <div className="p-5 space-y-3" style={{ background: "#060c18" }}>
            <div className="p-3 rounded-lg" style={{ background: "#ef444415", border: "1px solid #ef444430" }}>
              <span className="text-xs text-red-300">⚠️ <strong>3 breaches found</strong> for yourcompany.com · <strong>41 email addresses exposed</strong> · 1 critical</span>
            </div>
            {[
              { name: "LinkedIn 2012", sev: "CRITICAL", sc: "#ef4444", data: "Passwords, Emails, Usernames" },
              { name: "Adobe 2013", sev: "HIGH", sc: "#f97316", data: "Emails, Password hints, Passwords" },
              { name: "Dropbox 2012", sev: "HIGH", sc: "#f97316", data: "Emails, Passwords" },
            ].map(b => (
              <div key={b.name} className="p-3 rounded-lg" style={{ background: "#0d1526", border: "1px solid #1e2d4a" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-white">{b.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-bold"
                    style={{ background: b.sc + "22", color: b.sc, border: `1px solid ${b.sc}44` }}>{b.sev}</span>
                </div>
                <p className="text-xs text-slate-400">{b.data}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center pb-8">
        <p className="text-xs text-slate-600">Detroit Web Agency · (313) 992-1219 · matt@detroitwebagent.com</p>
      </div>
    </div>
  );
}
