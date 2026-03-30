import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

const SERVICES = [
  "Web Design ($499-$3,499)",
  "Contractor Lead Generation ($399/mo)",
  "Google Business Profile Automation ($49-99/mo)",
  "Social Media AI Posting ($149-299/mo)",
  "Review Response Automation ($99/mo)",
  "Monthly SEO Reports ($69/mo)",
  "Field Rep AI Tools ($29/mo)",
  "B2B Sales Database ($49/mo)",
  "Other / Not Sure",
];

type FormState = {
  name: string;
  business_name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
};

const INITIAL: FormState = {
  name: "",
  business_name: "",
  email: "",
  phone: "",
  service: "",
  message: "",
};

export default function GetStarted() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.business_name.trim() || !form.email.trim() || !form.service) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("submit-intake", {
        body: form,
      });
      if (error) throw error;
      setSubmittedName(form.name.split(" ")[0]);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1";
  const inputCls =
    "w-full bg-[#0f1a26] border border-slate-700 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-[#e8621a] transition-colors placeholder:text-slate-600";

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">
            Got it, {submittedName}.
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Matt will text or email you back within a few hours.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            Or reach out directly:{" "}
            <a href="tel:+13138064952" className="text-[#e8621a] font-semibold">
              (313) 806-4952
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Get Started | M² Training"
        description="Book a free consultation with Matt Michels. No sales pitch, no pressure — just a quick conversation about what you need."
        path="/get-started"
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#e8621a] mb-3">
            M² Performance Training
          </p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            Let's talk about what you need.
          </h1>
          <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
            Fill out the form and Matt will get back to you personally — usually within a few hours.
          </p>
        </div>

        <div className="max-w-lg mx-auto px-6 py-12">
          {/* Trust block */}
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-8">
            <img
              src="https://www.mattmichelstraining.com/images/matt-boat.jpg"
              alt="Matt Michels"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-[#e8621a]"
            />
            <div>
              <p className="font-bold text-sm text-foreground">Matt Michels — Grosse Pointe, MI</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                No sales pitch. No pressure. Just a quick conversation about what you need.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Name *</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Your name"
                  value={form.name}
                  onChange={set("name")}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Business Name *</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Your business"
                  value={form.business_name}
                  onChange={set("business_name")}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email *</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set("email")}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="(555) 000-0000"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Service Interested In *</label>
              <select
                className={inputCls}
                value={form.service}
                onChange={set("service")}
                required
              >
                <option value="" disabled>Select a service...</option>
                {SERVICES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Message / Question</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Tell Matt a bit about your situation or what you're looking to accomplish..."
                value={form.message}
                onChange={set("message")}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#e8621a] hover:bg-[#d45616] disabled:opacity-60 text-white font-black text-sm uppercase tracking-widest py-3.5 rounded transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                "Send My Info"
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Or call/text Matt directly:{" "}
              <a href="tel:+13138064952" className="text-[#e8621a] font-semibold">
                (313) 806-4952
              </a>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
