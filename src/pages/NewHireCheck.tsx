import { useState } from "react";
import { Shield, CheckCircle, Clock, Database, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function NewHireCheck() {
  const [form, setForm] = useState({
    candidate_name: "",
    candidate_email: "",
    requester_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("success") === "true";
  const isTest = params.get("test") === "true";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.candidate_name.trim() || !form.candidate_email.trim() || !form.requester_email.trim()) {
      setError("All three fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-new-hire-check-checkout", {
        body: {
          candidate_name: form.candidate_name.trim(),
          candidate_email: form.candidate_email.trim().toLowerCase(),
          requester_email: form.requester_email.trim().toLowerCase(),
        },
      });
      if (fnError || !data?.url) {
        throw new Error(fnError?.message || "Unable to create checkout session.");
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (isSuccess || isTest) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Report On Its Way</h1>
          <p className="text-slate-400 mb-6">
            Payment confirmed. We're running the credential check now — your report will arrive in your inbox within 5 minutes.
          </p>
          {isTest && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4">
              Test mode — check matt@mattmichelstraining.com
            </Badge>
          )}
          <a href="/new-hire-check" className="text-primary hover:underline text-sm">
            Run another check
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <Badge className="bg-primary/20 text-primary border-primary/30 mb-6 text-xs tracking-widest uppercase">
          HR Security Tool
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
          New Hire Credential Check
        </h1>
        <p className="text-slate-400 text-lg sm:text-xl max-w-xl mx-auto mb-8">
          Before you onboard, know if their email has been exposed in a data breach.
          One search. One report. One decision.
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-4xl font-black text-white">$9.99</span>
          <span className="text-slate-500">per check</span>
        </div>
        <p className="text-slate-500 text-sm">No subscription. No setup. Report in minutes.</p>
      </div>

      {/* Form Card */}
      <div className="max-w-lg mx-auto px-4 pb-16">
        <Card className="bg-slate-900 border-slate-700 shadow-2xl">
          <CardContent className="p-8">
            <h2 className="text-lg font-bold text-white mb-6">Run a Credential Check</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Candidate Full Name
                </label>
                <Input
                  name="candidate_name"
                  type="text"
                  placeholder="Jane Smith"
                  value={form.candidate_name}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Candidate Email Address
                </label>
                <Input
                  name="candidate_email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.candidate_email}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
                <p className="text-slate-500 text-xs mt-1">The email address you'll be giving them at your company.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Your Email (report delivered here)
                </label>
                <Input
                  name="requester_email"
                  type="email"
                  placeholder="you@yourcompany.com"
                  value={form.requester_email}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Opening checkout...
                  </span>
                ) : (
                  "Get Instant Report — $9.99"
                )}
              </Button>
            </form>

            {/* Trust badges */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  { icon: Database, label: "14 billion records checked" },
                  { icon: Clock, label: "Report in under 5 minutes" },
                  { icon: Shield, label: "Powered by HaveIBeenPwned" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <Icon size={12} className="text-slate-600" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What you get */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: "Full Breach History",
              desc: "Every known breach where the email appeared — name, date, and what was exposed.",
            },
            {
              icon: AlertTriangle,
              title: "Risk Level Rating",
              desc: "Clean, Low, Medium, High, or Critical — based on breach count and data types.",
            },
            {
              icon: CheckCircle,
              title: "AI Risk Summary",
              desc: "A plain-English recommendation from our AI — what it means and what to do next.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <Icon size={18} className="text-primary mb-3" />
              <p className="text-white font-semibold text-sm mb-1.5">{title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-slate-600 text-xs text-center mt-8 leading-relaxed max-w-md mx-auto">
          This tool checks the candidate's personal email against publicly known breach databases.
          A clean result does not guarantee absence of unreported breaches.
          A breach result does not disqualify a candidate — it informs your security onboarding.
        </p>
      </div>
    </div>
  );
}
