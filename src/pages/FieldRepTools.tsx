import { useState, useEffect } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle,
  Loader2,
  ArrowRight,
  Mail,
  Phone,
  Shield,
  Map,
  Copy,
  Lock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolKey = "cold_email" | "voicemail" | "objection" | "territory";

interface ToolConfig {
  key: ToolKey;
  icon: React.ElementType;
  label: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; required?: boolean }[];
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: ToolConfig[] = [
  {
    key: "cold_email",
    icon: Mail,
    label: "Cold Email Generator",
    description: "Enter the prospect's info → get a personalized 5-sentence email with a subject line, ready to send.",
    fields: [
      { key: "prospect_name", label: "Prospect Name", placeholder: "Sarah Johnson", required: true },
      { key: "company", label: "Company", placeholder: "Acme Manufacturing", required: true },
      { key: "role", label: "Role / Title", placeholder: "VP of Operations", required: true },
      { key: "pain_point", label: "Pain Point (optional)", placeholder: "Struggling with downtime / supplier delays…" },
    ],
  },
  {
    key: "voicemail",
    icon: Phone,
    label: "Voicemail Script Builder",
    description: "20 seconds, sounds natural, creates curiosity, ends with a clear callback ask.",
    fields: [
      { key: "prospect_name", label: "Prospect Name", placeholder: "Mike Rivera", required: true },
      { key: "company", label: "Company", placeholder: "Rivera Distribution", required: true },
      { key: "your_name", label: "Your Name", placeholder: "Matt Michels", required: true },
      { key: "your_product", label: "Your Product / Service", placeholder: "Fleet safety software", required: true },
    ],
  },
  {
    key: "objection",
    icon: Shield,
    label: "Objection Handler",
    description: "Paste any pushback → get 3 confident, non-pushy responses using different approaches.",
    fields: [
      { key: "objection", label: "The Objection", placeholder: "We already have a vendor for that.", required: true },
      { key: "product", label: "Your Product / Service", placeholder: "Industrial cleaning supplies", required: true },
    ],
  },
  {
    key: "territory",
    icon: Map,
    label: "Territory Planner",
    description: "Enter your ZIP and territory notes → get a weekly routing plan that cuts drive time and maximizes call density.",
    fields: [
      { key: "zip_code", label: "Primary ZIP Code", placeholder: "48201", required: true },
      { key: "territory_description", label: "Territory Description", placeholder: "Southeast Michigan, mostly manufacturing and distribution hubs", required: true },
      { key: "days_available", label: "Days Available", placeholder: "Monday, Tuesday, Thursday, Friday", required: true },
    ],
  },
];

const FEATURES = [
  "Cold email generator (enter company → get personalized email)",
  "Voicemail script builder (20 seconds, creates curiosity)",
  "Objection handler (3 responses to any pushback)",
  "Territory planner (weekly routing by ZIP)",
  "Cancel anytime — no contracts",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolCard({
  tool,
  userEmail,
}: {
  tool: ToolConfig;
  userEmail: string;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const Icon = tool.icon;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = tool.fields
      .filter((f) => f.required && !inputs[f.key]?.trim())
      .map((f) => f.label);
    if (missing.length) {
      toast.error(`Required: ${missing.join(", ")}`);
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("field-rep-ai-tool", {
        body: { tool: tool.key, inputs, user_email: userEmail },
      });
      if (error) throw error;
      if (data?.error === "subscription_required") {
        toast.error("Active subscription required.");
        return;
      }
      setResult(data?.result || "");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => toast.success("Copied!"));
  };

  return (
    <div className="bg-card border border-border p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div>
          <p className="font-black text-sm text-foreground">{tool.label}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{tool.description}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerate} className="space-y-2.5">
        {tool.fields.map((field) => (
          <div key={field.key}>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
              {field.label}{field.required && " *"}
            </label>
            <input
              value={inputs[field.key] || ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-2.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="relative">
          <textarea
            readOnly
            value={result}
            rows={8}
            className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground resize-y focus:ring-1 focus:ring-primary outline-none font-mono leading-relaxed"
          />
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="absolute top-2 right-2 bg-card border border-border px-2 py-1 rounded text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Copy size={11} /> Copy
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FieldRepTools() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Checkout form state
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  // ── Auth + subscription check ──
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;

        if (!user?.email) {
          setCheckingAuth(false);
          return;
        }

        setUserEmail(user.email);

        const { data } = await supabase
          .from("b2b_subscribers" as any)
          .select("id")
          .eq("email", user.email)
          .eq("niche", "field_rep_tools")
          .eq("active", true)
          .maybeSingle();

        if (mounted) {
          setIsSubscribed(!!data);
          setCheckingAuth(false);
        }
      } catch {
        if (mounted) setCheckingAuth(false);
      }
    };

    check();
    return () => { mounted = false; };
  }, []);

  // ── Checkout handler ──
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutEmail) { toast.error("Email is required"); return; }
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-field-rep-checkout", {
        body: { email: checkoutEmail, name: checkoutName },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubscribing(false);
    }
  };

  // ── Success screen ──
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">You're in!</h1>
          <p className="text-muted-foreground leading-relaxed">
            Check your email for login info. Once you're signed in, come back here and your tools will be ready.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions?{" "}
            <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="AI Tools for Field Sales Reps — $29/mo | M² Training"
        description="Cold email generator, voicemail scripts, objection handlers, and territory planning — AI tools built for B2B field reps. $29/mo, cancel anytime."
        path="/field-rep-tools"
        type="product"
        product={{
          name: "M² Field Rep AI Tools",
          price: 29,
          currency: "USD",
          availability: "https://schema.org/InStock",
        }}
      />

      <div className="min-h-screen bg-background text-foreground">

        {/* ── Hero ── */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² Field Rep AI Tools</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            AI tools built for field reps.<br />
            Cold emails, voicemails, and objection handlers — written in seconds.
          </h1>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            Stop staring at a blank screen before calls. Let AI do the heavy lifting.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">

          {/* ── Spinner while checking auth ── */}
          {checkingAuth && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          )}

          {!checkingAuth && (
            <>
              {/* ── Subscribed: show tool cards ── */}
              {isSubscribed && userEmail ? (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Logged in as <span className="font-bold text-foreground">{userEmail}</span>. Your tools are below.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {TOOLS.map((tool) => (
                      <ToolCard key={tool.key} tool={tool} userEmail={userEmail} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Tool preview cards (locked) ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                    {TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <div key={tool.key} className="bg-card border border-border p-5 opacity-80">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon size={16} className="text-primary" />
                            </div>
                            <div>
                              <p className="font-black text-sm text-foreground">{tool.label}</p>
                              <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{tool.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                            <Lock size={10} />
                            Subscribe to unlock
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Price / subscribe card ── */}
                  <div className="bg-card border border-border p-6 mb-10">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Field Rep AI Tools</p>
                        <p className="text-3xl font-black text-foreground">
                          $29<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">Cancel anytime. No contracts.</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      {FEATURES.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-[13px] text-foreground">
                          <CheckCircle size={13} className="text-primary flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSubscribe} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name</label>
                          <input
                            value={checkoutName}
                            onChange={(e) => setCheckoutName(e.target.value)}
                            placeholder="Matt Michels"
                            className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
                          <input
                            type="email"
                            required
                            value={checkoutEmail}
                            onChange={(e) => setCheckoutEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={subscribing}
                        className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {subscribing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        {subscribing ? "Redirecting to checkout…" : "Get Access — $29/mo →"}
                      </button>
                      <p className="text-[11px] text-muted-foreground text-center">Secure checkout via Stripe. Cancel anytime.</p>
                    </form>
                  </div>
                </>
              )}

              {/* ── Matt credibility block ── */}
              <div className="bg-card border border-border p-5 mb-10 flex items-start gap-4">
                <img
                  src="/images/matt-family-cornfield.jpg"
                  alt="Matt Michels"
                  className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
                />
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground">Matt Michels — B2B Sales Trainer, Grosse Pointe, MI.</span>{" "}
                  I built these because I kept getting asked by reps how to find more leads and write better emails. These are the exact tools I use. For $29 a month, there's no reason to waste another hour staring at a blank screen.
                </p>
              </div>

              {/* ── Footer ── */}
              <p className="text-[12px] text-muted-foreground text-center">
                Questions? Email{" "}
                <a href="mailto:matt@mattmichelstraining.com" className="text-primary">matt@mattmichelstraining.com</a>{" "}
                or text{" "}
                <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
