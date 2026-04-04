import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Shield, AlertTriangle, Eye, Lock, CheckCircle, Zap, Users, Globe } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

const STATS = [
  { icon: AlertTriangle, value: "24B+", label: "Credentials leaked in 2024", color: "#ef4444" },
  { icon: Eye, value: "83%", label: "Of breaches go undetected for months", color: "#f97316" },
  { icon: Lock, value: "$4.9M", label: "Average cost of a data breach", color: "#eab308" },
];

const STEPS = [
  {
    num: "01",
    title: "Enter Your Domain",
    body: "Tell us the domain you want monitored — your company email domain (e.g. yourcompany.com).",
  },
  {
    num: "02",
    title: "We Scan Continuously",
    body: "We cross-reference your domain against the HaveIBeenPwned database and dark web sources weekly.",
  },
  {
    num: "03",
    title: "You Get Alerted Instantly",
    body: "The moment a breach is detected, you receive an email with severity, data types, and AI-generated remediation steps.",
  },
];

// Static demo data — marketing element only, not a real API call
const DEMO_FINDINGS = [
  {
    title: "LinkedIn 2021",
    date: "2021-06-22",
    severity: "high",
    types: "Email addresses, Passwords, Professional experience",
    count: "700,000,000",
  },
  {
    title: "Adobe 2013",
    date: "2013-10-04",
    severity: "critical",
    types: "Emails, Encrypted passwords, Credit card data",
    count: "153,000,000",
  },
  {
    title: "DropBox 2012",
    date: "2012-07-01",
    severity: "medium",
    types: "Email addresses, Salted hashes",
    count: "68,648,009",
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function DarkWebMonitor() {
  const [form, setForm] = useState({
    company_name: "",
    monitored_domain: "",
    customer_name: "",
    customer_email: "",
    plan_type: "direct",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Demo checker state
  const [demoEmail, setDemoEmail] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<"idle" | "scanning" | "found">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-dark-web-monitor-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const runDemo = () => {
    if (!demoEmail.trim()) return;
    setDemoRunning(true);
    setDemoResult("scanning");
    setTimeout(() => {
      setDemoResult("found");
      setDemoRunning(false);
    }, 2000);
  };

  return (
    <>
      <SEOHead
        title="AI Dark Web Credential Monitor — Know Before Hackers Act | M2 Development"
        description="Monitor your company domain on the dark web. Get instant alerts when employee credentials are breached. AI-powered remediation steps. $49/mo."
      />
      <div className="min-h-screen bg-gray-950 text-white">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#0a0f1e] border-b border-[#1e2d4a]">
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(#00d4ff 1px,transparent 1px),linear-gradient(90deg,#00d4ff 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
            <div className="inline-flex items-center gap-2 bg-[#00d4ff15] border border-[#00d4ff30] text-[#00d4ff] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
              <Shield size={12} /> M2 Development · AI Security
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              Your Company Credentials<br />
              <span className="text-[#00d4ff]">May Already Be Compromised</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              Employee email and password combinations from your domain are likely sitting on dark web marketplaces right now.
              We monitor continuously and alert you the moment we find anything — with AI-generated remediation steps.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#signup"
                className="bg-[#00d4ff] text-[#0a0f1e] font-black px-8 py-4 text-base hover:bg-[#00b8e0] transition-colors"
              >
                Start Monitoring — $49/mo
              </a>
              <a
                href="#signup"
                onClick={() => setForm((p) => ({ ...p, plan_type: "reseller" }))}
                className="border border-[#00d4ff] text-[#00d4ff] font-bold px-8 py-4 text-base hover:bg-[#00d4ff15] transition-colors"
              >
                MSP Reseller — $199/mo (10 Domains)
              </a>
            </div>
          </div>
        </section>

        {/* ── Urgency Stats ─────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[#0d1526] border border-[#1e2d4a] p-6 text-center">
                <s.icon size={28} style={{ color: s.color }} className="mx-auto mb-3" />
                <div className="text-3xl font-black mb-2" style={{ color: s.color }}>{s.value}</div>
                <div className="text-slate-400 text-sm leading-relaxed">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Demo Checker ──────────────────────────────────────────────────── */}
        <section className="max-w-2xl mx-auto px-6 pb-14">
          <div className="bg-[#0d1526] border border-[#1e2d4a] p-8">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Eye size={20} className="text-[#00d4ff]" /> Free Demo Scan
            </h2>
            <p className="text-slate-400 text-sm mb-6">Enter a domain to see how our scan works. This is a simulated demo.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={demoEmail}
                onChange={(e) => { setDemoEmail(e.target.value); setDemoResult("idle"); }}
                placeholder="yourcompany.com"
                className="flex-1 bg-[#0a0f1e] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff] placeholder-slate-600"
              />
              <button
                onClick={runDemo}
                disabled={demoRunning || !demoEmail.trim()}
                className="bg-[#00d4ff] text-[#0a0f1e] font-bold px-6 py-3 text-sm disabled:opacity-50 hover:bg-[#00b8e0] transition-colors"
              >
                {demoRunning ? "Scanning…" : "Run Scan"}
              </button>
            </div>

            {demoResult === "scanning" && (
              <div className="mt-6 flex items-center gap-3 text-[#00d4ff] text-sm">
                <div className="w-4 h-4 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                Scanning dark web databases…
              </div>
            )}

            {demoResult === "found" && (
              <div className="mt-6">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-4">
                  <AlertTriangle size={16} /> 3 breaches found for <span className="text-white">{demoEmail}</span>
                </div>
                <div className="space-y-3">
                  {DEMO_FINDINGS.map((f) => (
                    <div key={f.title} className="bg-[#0a0f1e] border border-[#1e2d4a] p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">{f.title}</span>
                        <span
                          className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                          style={{
                            color: SEVERITY_COLOR[f.severity],
                            background: SEVERITY_COLOR[f.severity] + "20",
                            border: `1px solid ${SEVERITY_COLOR[f.severity]}40`,
                          }}
                        >
                          {f.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{f.date} · {f.count} records</div>
                      <div className="text-xs text-slate-400 mt-1">{f.types}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-[#00d4ff10] border border-[#00d4ff30] p-4 text-sm text-[#00d4ff]">
                  This is simulated demo data. Subscribe to run a real scan on your actual domain.
                </div>
                <a href="#signup" className="block mt-4 text-center bg-[#00d4ff] text-[#0a0f1e] font-black py-3 text-sm hover:bg-[#00b8e0] transition-colors">
                  Get Real Results — Start Monitoring $49/mo →
                </a>
              </div>
            )}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section className="bg-[#0a0f1e] border-y border-[#1e2d4a] py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-black text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((s) => (
                <div key={s.num} className="text-center">
                  <div className="text-5xl font-black text-[#00d4ff] opacity-40 mb-4">{s.num}</div>
                  <h3 className="font-bold text-white text-base mb-3">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-black text-center mb-12">Simple, Transparent Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct plan */}
            <div className="bg-[#0d1526] border border-[#1e2d4a] p-8">
              <div className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-3">Direct</div>
              <div className="text-4xl font-black text-white mb-1">$49<span className="text-xl font-normal text-slate-400">/mo</span></div>
              <p className="text-slate-400 text-sm mb-6">Perfect for small businesses and individual companies</p>
              <ul className="space-y-3 mb-8">
                {[
                  "1 domain monitored",
                  "Weekly breach reports",
                  "Instant email alerts on new findings",
                  "AI-generated remediation steps per breach",
                  "Severity classification (critical / high / medium / low)",
                  "Cancel anytime",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-[#00d4ff] mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a href="#signup" onClick={() => setForm((p) => ({ ...p, plan_type: "direct" }))} className="block text-center bg-[#00d4ff] text-[#0a0f1e] font-black py-3 text-sm hover:bg-[#00b8e0] transition-colors">
                Get Started — $49/mo
              </a>
            </div>

            {/* Reseller plan */}
            <div className="bg-[#0d1526] border border-[#00d4ff] p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4ff] text-[#0a0f1e] text-xs font-black uppercase tracking-widest px-4 py-1">
                Best for MSPs
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-3">MSP Reseller</div>
              <div className="text-4xl font-black text-white mb-1">$199<span className="text-xl font-normal text-slate-400">/mo</span></div>
              <p className="text-slate-400 text-sm mb-6">For managed service providers and IT consultants</p>
              <ul className="space-y-3 mb-8">
                {[
                  "Up to 10 domains monitored",
                  "Weekly breach reports per domain",
                  "Instant email alerts on any finding",
                  "AI-generated remediation steps",
                  "Severity classification on all findings",
                  "White-label available (contact us)",
                  "Cancel anytime",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-[#00d4ff] mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a href="#signup" onClick={() => setForm((p) => ({ ...p, plan_type: "reseller" }))} className="block text-center bg-[#00d4ff] text-[#0a0f1e] font-black py-3 text-sm hover:bg-[#00b8e0] transition-colors">
                Get Started — $199/mo
              </a>
            </div>
          </div>
        </section>

        {/* ── Signup Form ───────────────────────────────────────────────────── */}
        <section id="signup" className="bg-[#0a0f1e] border-t border-[#1e2d4a] py-16">
          <div className="max-w-xl mx-auto px-6">
            <h2 className="text-2xl font-black text-center mb-3">Start Monitoring Your Domain</h2>
            <p className="text-slate-400 text-sm text-center mb-10">Setup takes 60 seconds. First scan runs immediately after signup.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className="w-full bg-[#0d1526] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff] placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Domain to Monitor <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  name="monitored_domain"
                  value={form.monitored_domain}
                  onChange={handleChange}
                  required
                  placeholder="yourcompany.com"
                  className="w-full bg-[#0d1526] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff] placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Name</label>
                <input
                  type="text"
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="w-full bg-[#0d1526] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff] placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  name="customer_email"
                  value={form.customer_email}
                  onChange={handleChange}
                  required
                  placeholder="jane@yourcompany.com"
                  className="w-full bg-[#0d1526] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff] placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plan</label>
                <select
                  name="plan_type"
                  value={form.plan_type}
                  onChange={handleChange}
                  className="w-full bg-[#0d1526] border border-[#1e2d4a] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#00d4ff]"
                >
                  <option value="direct">Direct — 1 Domain · $49/mo</option>
                  <option value="reseller">MSP Reseller — 10 Domains · $199/mo</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-800/50 text-red-300 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00d4ff] text-[#0a0f1e] font-black py-4 text-base hover:bg-[#00b8e0] transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? "Redirecting to Checkout…" : `Start Monitoring — ${form.plan_type === "reseller" ? "$199" : "$49"}/mo`}
              </button>
              <p className="text-center text-xs text-slate-500 mt-3">
                Secure checkout via Stripe · Cancel anytime · No setup fees
              </p>
            </form>
          </div>
        </section>

        {/* ── Footer strip ──────────────────────────────────────────────────── */}
        <div className="border-t border-[#1e2d4a] py-8">
          <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/images/matt-boat.jpg" alt="Matt Michels" className="w-10 h-10 rounded-full object-cover border-2 border-[#1e2d4a]" />
              <div className="text-sm">
                <div className="font-bold text-white">Matt Michels</div>
                <div className="text-slate-500">M2 Development · (313) 806-4952</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <a href="/privacy-policy" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-slate-300 transition-colors">Terms</a>
              <a href="mailto:matt@mattmichelstraining.com" className="hover:text-slate-300 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
