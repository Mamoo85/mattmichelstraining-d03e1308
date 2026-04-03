import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle, Mail, Loader2, Lock, Eye, FileText } from "lucide-react";

export default function EmployeeCredentialAudit() {
  const [companyName, setCompanyName] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailList = emailsText
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError("Please enter your company name.");
      return;
    }
    if (emailList.length === 0) {
      setError("Please enter at least one employee email address.");
      return;
    }
    if (emailList.length > 100) {
      setError("Maximum 100 employee emails per audit. Please split into batches.");
      return;
    }
    if (!customerEmail.trim()) {
      setError("Please enter your email address to receive the report.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-employee-audit-checkout",
        {
          body: {
            company_name: companyName.trim(),
            employee_emails: emailList,
            customer_email: customerEmail.trim().toLowerCase(),
          },
        }
      );

      if (fnError || !data?.url) {
        throw new Error(fnError?.message || "Failed to create checkout session.");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    }
  };

  const isSuccess = new URLSearchParams(window.location.search).get("success") === "true";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-slate-900 border-slate-700 text-center">
          <CardContent className="pt-12 pb-10 px-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="text-green-400" size={36} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Audit Underway</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Your employee credential audit is processing. We're checking every email against HaveIBeenPwned's database of over 13 billion breached accounts.
            </p>
            <div className="bg-slate-800 rounded-lg p-4 text-left space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Shield size={14} className="text-green-400 shrink-0" />
                Scanning each email against known data breaches
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <FileText size={14} className="text-blue-400 shrink-0" />
                AI generating executive summary &amp; per-person recommendations
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Mail size={14} className="text-orange-400 shrink-0" />
                Full color-coded report delivered to your inbox within minutes
              </div>
            </div>
            <p className="text-xs text-slate-500">Check your email. If you don't see it within 10 minutes, check spam or reply to your receipt.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Shield className="text-orange-400" size={30} />
            </div>
          </div>
          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs mb-4">
            $149 one-time · Results in minutes
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Employee Credential Audit
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Find out which of your employees' emails have been exposed in data breaches — before attackers use them against you.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-2xl mx-auto text-left">
            {[
              { icon: Eye, title: "Per-Employee Results", desc: "Every email checked individually against 13B+ breached accounts" },
              { icon: AlertTriangle, title: "Risk-Scored Report", desc: "Color-coded by severity — critical, high, medium, clean" },
              { icon: Lock, title: "Actionable Next Steps", desc: "AI-generated recommendations for each exposed employee" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <Icon size={18} className="text-orange-400 mb-2" />
                <p className="text-sm font-bold text-white mb-1">{title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">Run Your Credential Audit</CardTitle>
              <Badge className="bg-green-500/10 text-green-400 border-green-500/30">$149 one-time</Badge>
            </div>
            <p className="text-slate-400 text-sm">Enter up to 100 employee emails. Report delivered to your inbox within minutes.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Company Name <span className="text-orange-400">*</span>
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Your Email (report delivered here) <span className="text-orange-400">*</span>
                </label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Employee Email Addresses <span className="text-orange-400">*</span>
                  {emailList.length > 0 && (
                    <span className="ml-2 text-xs text-slate-500">({emailList.length} / 100 emails)</span>
                  )}
                </label>
                <Textarea
                  value={emailsText}
                  onChange={(e) => setEmailsText(e.target.value)}
                  placeholder={"john.smith@company.com\njane.doe@company.com\nbob.jones@company.com"}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 font-mono text-sm min-h-[180px]"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1.5">One email per line. Up to 100 employees per audit.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || emailList.length === 0 || !companyName.trim() || !customerEmail.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base h-12 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Creating secure checkout...
                  </>
                ) : (
                  <>
                    <Shield size={16} className="mr-2" />
                    Get My Report — $149
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-slate-500">
                Secure checkout via Stripe. Your employee data is never stored after the audit completes.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="mt-10 space-y-4">
          <h2 className="text-lg font-bold text-white">Frequently Asked Questions</h2>
          {[
            {
              q: "How does this work?",
              a: "We check each email address against HaveIBeenPwned's database of 13+ billion breached accounts. After payment, our system scans every address and emails you a full color-coded report within minutes.",
            },
            {
              q: "Does this mean my employees were hacked?",
              a: "Not necessarily. It means their email/password combination appeared in a known data breach (like LinkedIn, Adobe, or similar). They may have changed their password since — but if they reuse passwords, they could still be at risk.",
            },
            {
              q: "What's in the report?",
              a: "An executive summary with overall risk score, a table showing every employee's breach status and severity, the specific breaches each person appeared in, what data was exposed, and a 1-sentence recommended action per person.",
            },
            {
              q: "Is my employee data secure?",
              a: "Email addresses are only used to check against HIBP's API. We do not store, sell, or share employee email lists after the audit completes.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <p className="text-sm font-bold text-white mb-2">{q}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
