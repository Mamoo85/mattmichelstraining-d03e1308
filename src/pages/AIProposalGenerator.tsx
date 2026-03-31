import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, FileText, Clock, Zap, Users, ArrowRight } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Construction", "Auto Repair", "Web Design", "Marketing Agency",
  "Consulting", "IT Services", "Cleaning Services", "Other",
];

const FEATURES = [
  { icon: FileText, title: "Unlimited Proposals", desc: "Generate as many proposals as you need — one client or one hundred, same price." },
  { icon: Zap, title: "Professional Format", desc: "Clean, structured layout with scope of work, pricing, timeline, and payment terms built in." },
  { icon: CheckCircle, title: "Client-Ready HTML", desc: "Copy and paste directly into an email or your CRM. No reformatting required." },
];

const STEPS = [
  { num: "1", title: "Sign up", desc: "Create your account and get instant access to your proposal portal." },
  { num: "2", title: "Submit project details", desc: "Fill out a short form: client name, project type, scope, and budget." },
  { num: "3", title: "Get a ready-to-send proposal in 2 minutes", desc: "AI writes a polished proposal with scope, pricing, timeline, and terms — download or copy with one click." },
];

export default function AIProposalGenerator() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    industry: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const success = new URLSearchParams(window.location.search).get("status") === "success";

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Access granted!</h1>
          <p className="text-slate-300 leading-relaxed">
            Your AI Proposal Generator account is being set up. Check your email for login instructions within the next few minutes.
          </p>
          <p className="mt-6 text-sm text-slate-400">
            Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.businessName || !form.email) {
      setError("Business name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-proposal-checkout", {
        body: form,
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-orange-500/20">
          <FileText size={14} />
          AI Proposal Generator
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Professional Proposals <span className="text-orange-500">in 2 Minutes</span>
        </h1>
        <p className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
          Submit your project details and AI generates a polished, client-ready proposal — complete
          with scope, pricing, timeline, and terms. Unlimited proposals included.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> $49/mo</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Unlimited proposals</span>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-10">How It Works</h2>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {STEPS.map(({ num, title, desc }, idx) => (
            <div key={num} className="flex-1 flex sm:flex-col items-start sm:items-center sm:text-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-black">{num}</div>
                {idx < STEPS.length - 1 && (
                  <ArrowRight size={20} className="text-slate-600 hidden sm:hidden" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sample proposal preview */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-3">Sample Output</h2>
        <p className="text-slate-400 text-center text-sm mb-8">What your clients receive — clean, professional, ready to sign.</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-slate-400 text-xs ml-2">proposal-riverside-dental.html</span>
          </div>
          <div className="px-8 py-6 text-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Proposal</p>
                <p className="font-black text-xl text-slate-900">Website Redesign</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Prepared for: Riverside Dental</p>
                <p>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-bold text-slate-700 mb-1">Scope of Work</p>
                <ul className="text-slate-600 space-y-1 list-disc list-inside">
                  <li>5-page responsive website (Home, Services, About, FAQ, Contact)</li>
                  <li>Online appointment booking integration</li>
                  <li>Google Business Profile optimization</li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-bold text-slate-700 text-xs mb-1">Investment</p>
                  <p className="text-lg font-black text-orange-600">$1,499</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="font-bold text-slate-700 text-xs mb-1">Timeline</p>
                  <p className="text-lg font-black text-slate-800">10 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <Icon size={28} className="text-orange-500 mb-4" />
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timer callout */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-8 py-6 flex items-center gap-6 flex-wrap">
          <Clock size={36} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-white font-bold text-lg mb-1">From submission to sent — under 2 minutes</p>
            <p className="text-slate-300 text-sm">The average contractor spends 45–90 minutes writing a proposal. AI cuts that to 2 minutes and produces a better result every time.</p>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="px-6 pb-20 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl font-black">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">$49/mo after 7 days. Unlimited proposals included.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Smith"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="businessName" className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Smith HVAC LLC"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email <span className="text-orange-500">*</span></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="john@smithhvac.com"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="industry" className="text-slate-300 text-sm">Industry</Label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-base"
              >
                {submitting ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                {submitting ? "Processing…" : "Start Writing Proposals Free →"}
              </Button>
              <p className="text-center text-xs text-slate-500">No credit card needed to start. $49/mo after 7 days.</p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <section className="border-t border-slate-800 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Users size={18} className="text-orange-500" />
          <span className="text-slate-400 text-sm">Built by Matt Michels — Grosse Pointe, MI</span>
        </div>
        <p className="text-slate-500 text-xs">Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a> · <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500 hover:underline">matt@mattmichelstraining.com</a></p>
      </section>
    </div>
  );
}
