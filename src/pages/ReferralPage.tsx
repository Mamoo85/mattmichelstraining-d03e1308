import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Gift, ArrowLeft } from "lucide-react";

const SERVICE_CATEGORIES = [
  "Web Design",
  "GBP SaaS (Google Business Posts)",
  "AI Social Media",
  "AI Blog Post Service",
  "AI Press Release",
  "AI Local SEO Pages",
  "AI Website Copy Refresh",
  "AI Ads Copy Generator",
  "AI Social Caption Pack",
  "AI Direct Mail Copy",
  "AI Video Script Writer",
  "Seasonal Promo Planner",
  "Missed Call Text-Back",
  "AI Phone Answering",
  "Text Message Marketing",
  "Review Request SMS",
  "Quote Follow-Up SMS",
  "Win-Back SMS",
  "Holiday SMS Blast",
  "Appointment Reminder SMS",
  "Speed-to-Lead SMS",
  "AI Thank You Text",
  "Warranty Reminder SMS",
  "Satisfaction Survey SMS",
  "AI Reputation Dashboard",
  "Google Review Auto-Responder",
  "Review Alert SMS",
  "AI Google Q&A Manager",
  "AI Competitor Watch",
  "AI Proposal Generator",
  "AI Estimate Generator",
  "AI Hiring Assistant",
  "AI Sales Script Generator",
  "AI Weekly Business Digest",
  "Business KPI Weekly Email",
  "Staff Internal Newsletter",
  "AI Email Welcome Drip",
  "AI Customer Reactivation",
  "Late Payment Chaser",
  "Contractor Lead Gen",
  "B2B Dental Database",
  "Field Rep AI Tools",
  "Contractor Chatbot",
  "Field Rep Weekly Newsletter",
  "Web Design Services",
  "SEO Audit Report",
  "Not sure — let Matt decide",
];

interface FormData {
  yourName: string;
  yourEmail: string;
  friendName: string;
  friendBusiness: string;
  friendEmail: string;
  service: string;
}

const EMPTY_FORM: FormData = {
  yourName: "",
  yourEmail: "",
  friendName: "",
  friendBusiness: "",
  friendEmail: "",
  service: "",
};

export default function ReferralPage() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedFriendName, setSubmittedFriendName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const referralLink = form.yourEmail
    ? `https://www.mattmichelstraining.com/all-services?ref=${encodeURIComponent(form.yourEmail)}`
    : "https://www.mattmichelstraining.com/all-services?ref=your-email";

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input text
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.yourName || !form.yourEmail || !form.friendName || !form.friendBusiness || !form.friendEmail || !form.service) {
      setError("Please fill out all fields before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await supabase.functions.invoke("send-referral", { body: form });
      setSubmittedFriendName(form.friendName);
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch {
      setError("Something went wrong. Please try again or text Matt at (313) 806-4952.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="py-16 px-4 text-center border-b border-slate-800">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1 text-orange-400 text-sm font-medium mb-6">
            <Gift className="w-4 h-4" />
            Referral Program
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Send a friend.<br />
            <span className="text-orange-500">Get $50.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-lg mx-auto">
            Know a business owner who could use any of these services? Send them Matt's way. When they sign up, you both get $50 off your next month.
          </p>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* Form card */}
        {submitted ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto">
                <Gift className="w-7 h-7 text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">You're all set!</h2>
              <p className="text-slate-300 max-w-sm mx-auto">
                Done! We'll reach out to{" "}
                <span className="text-orange-400 font-semibold">{submittedFriendName}</span> and
                credit both of you $50 when they sign up.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Refer someone else
                </Button>
                <Link to="/all-services">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto">
                    Browse all services
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-xl">Refer a business owner</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Your info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="yourName" className="text-slate-300 text-sm">Your Name *</Label>
                    <Input
                      id="yourName"
                      placeholder="Jane Smith"
                      value={form.yourName}
                      onChange={(e) => handleChange("yourName", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="yourEmail" className="text-slate-300 text-sm">Your Email *</Label>
                    <Input
                      id="yourEmail"
                      type="email"
                      placeholder="jane@example.com"
                      value={form.yourEmail}
                      onChange={(e) => handleChange("yourEmail", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-5 space-y-4">
                  <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Your Friend's Info</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="friendName" className="text-slate-300 text-sm">Friend's Name *</Label>
                      <Input
                        id="friendName"
                        placeholder="John Doe"
                        value={form.friendName}
                        onChange={(e) => handleChange("friendName", e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="friendBusiness" className="text-slate-300 text-sm">Friend's Business *</Label>
                      <Input
                        id="friendBusiness"
                        placeholder="Doe Roofing LLC"
                        value={form.friendBusiness}
                        onChange={(e) => handleChange("friendBusiness", e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="friendEmail" className="text-slate-300 text-sm">Friend's Email *</Label>
                    <Input
                      id="friendEmail"
                      type="email"
                      placeholder="john@doeroofing.com"
                      value={form.friendEmail}
                      onChange={(e) => handleChange("friendEmail", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="service" className="text-slate-300 text-sm">Which service fits them? *</Label>
                    <Select value={form.service} onValueChange={(val) => handleChange("service", val)}>
                      <SelectTrigger
                        id="service"
                        className="bg-slate-700 border-slate-600 text-white focus:border-orange-500 data-[placeholder]:text-slate-500"
                      >
                        <SelectValue placeholder="Select a service..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-white max-h-72">
                        {SERVICE_CATEGORIES.map((svc) => (
                          <SelectItem
                            key={svc}
                            value={svc}
                            className="text-slate-200 focus:bg-slate-700 focus:text-white"
                          >
                            {svc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 text-base disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Send Referral — Get $50"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Referral link section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Your referral link</CardTitle>
            <p className="text-slate-400 text-sm">
              Share this link directly — anyone who signs up through it gets tracked to you.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                readOnly
                value={referralLink}
                className="bg-slate-700 border-slate-600 text-slate-300 text-sm font-mono flex-1 select-all cursor-text"
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                onClick={handleCopy}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            {!form.yourEmail && (
              <p className="text-slate-500 text-xs mt-2">
                Enter your email above to personalize your referral link.
              </p>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Send the referral", desc: "Fill out the form or share your link." },
            { step: "2", title: "Friend signs up", desc: "Matt reaches out and they choose a service." },
            { step: "3", title: "You both get $50", desc: "$50 off your next month, automatically." },
          ].map((item) => (
            <div key={item.step} className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">
                {item.step}
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
              <p className="text-slate-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-slate-500 text-sm pb-4">
          Questions? Text Matt directly at{" "}
          <a href="sms:3138064952" className="text-orange-400 hover:text-orange-300">
            (313) 806-4952
          </a>
        </p>
      </main>
    </div>
  );
}
