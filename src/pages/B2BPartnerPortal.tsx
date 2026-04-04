import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, DollarSign, Copy, Check,
  ArrowRight, Briefcase, Loader2,
} from "lucide-react";

interface PartnerStats {
  code: string;
  referral_link: string;
  active_referrals: number;
  pending_payout: number;
  total_paid: number;
  is_new: boolean;
}

const TOOLS = [
  {
    name: "GoHighLevel CRM",
    desc: "All-in-one CRM for agencies and contractors. Automates follow-up, booking, and client communications.",
    price: "From $97/mo",
    href: "https://www.gohighlevel.com/?fp_ref=matt",
    badge: "Most Popular",
  },
  {
    name: "Jobber",
    desc: "Field service management for HVAC, plumbing, landscaping, and more. Scheduling, invoicing, payments.",
    price: "From $49/mo",
    href: "https://www.getjobber.com/?fp_ref=matt",
    badge: null,
  },
];

export default function B2BPartnerPortal() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<PartnerStats | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email to get your partner link");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-partner-stats", {
        body: { email },
      });
      if (error) throw error;
      if (data?.code) {
        setPartner(data as PartnerStats);
        if (data.is_new) {
          toast.success("Partner account created! Share your link to start earning.");
        }
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!partner) return;
    try {
      await navigator.clipboard.writeText(partner.referral_link);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed — select and copy the link manually");
    }
  };

  return (
    <>
      <SEOHead
        title="Partner Program — Earn $100 Per Referral | M2 Local Marketing"
        description="Refer a local business to M2 and earn $100 cash for every business that signs up. No cap. Simple tracking. Paid monthly."
        path="/partners"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <Users size={11} /> Partner Program
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Earn $100 for Every<br />
              <span className="text-[#f97316]">Business You Refer.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">
              Know a contractor, shop owner, or local business struggling with their Google presence or lead flow? Send them our way. When they sign up, you get $100 — no cap, paid monthly.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 pb-14">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-5 text-center">
            {[
              { icon: Users, title: "Share Your Link", desc: "Send your unique referral link to any local business owner." },
              { icon: Briefcase, title: "They Sign Up", desc: "When they sign up for any paid service, we track it to your link." },
              { icon: DollarSign, title: "You Get $100", desc: "Matt sends payment via Venmo, PayPal, or Zelle. No minimum." },
            ].map((item) => (
              <div key={item.title} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-5">
                <div className="w-10 h-10 rounded-lg bg-[#f97316]/15 flex items-center justify-center mx-auto mb-3">
                  <item.icon size={16} className="text-[#f97316]" />
                </div>
                <h3 className="font-bold text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-[#888] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content: Lookup + Stats */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto grid lg:grid-cols-5 gap-8">

            {/* Lookup / Stats Panel */}
            <div className="lg:col-span-3">
              {!partner ? (
                <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 sm:p-8">
                  <h2 className="text-lg font-bold mb-1">Get Your Partner Link</h2>
                  <p className="text-sm text-[#888] mb-6">Enter your email — we'll create your unique referral link or pull up your existing one.</p>
                  <form onSubmit={handleLookup} className="space-y-4">
                    <div>
                      <Label className="text-[#aaa] text-xs">Your Email Address</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@yourcompany.com"
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl"
                      disabled={loading}
                    >
                      {loading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up...</>
                        : "Get My Partner Link →"}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1a1a2e] border border-white/8 rounded-xl p-5 text-center">
                      <div className="text-3xl font-black text-white mb-1">{partner.active_referrals}</div>
                      <div className="text-xs text-[#888]">Active Referrals</div>
                    </div>
                    <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-5 text-center">
                      <div className="text-3xl font-black text-[#f97316] mb-1">
                        ${Number(partner.pending_payout).toFixed(0)}
                      </div>
                      <div className="text-xs text-[#888]">Pending Payout</div>
                    </div>
                  </div>

                  {/* Referral Link */}
                  <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
                    <h3 className="font-bold text-sm mb-3">Your Referral Link</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#aaa] font-mono truncate">
                        {partner.referral_link}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10 shrink-0"
                        onClick={copyLink}
                      >
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-[#555] mt-2">Share this link via text, email, or social. When they sign up, it's tracked to you.</p>
                  </div>

                  {/* Total paid */}
                  {partner.total_paid > 0 && (
                    <div className="bg-[#1a1a2e] border border-white/8 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-sm text-[#aaa]">Total paid out to you</span>
                      <span className="font-bold text-white">${Number(partner.total_paid).toFixed(0)}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-[#555] text-center">
                    Questions about your referrals? Text Matt at (313) 806-4952
                  </p>
                </div>
              )}
            </div>

            {/* Recommended Tools Sidebar */}
            <div className="lg:col-span-2">
              <h3 className="font-bold text-sm text-[#aaa] uppercase tracking-widest mb-4">Recommended Tools</h3>
              <div className="space-y-4">
                {TOOLS.map((tool) => (
                  <div key={tool.name} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-bold text-sm">{tool.name}</span>
                      {tool.badge && (
                        <span className="text-[9px] bg-[#f97316]/20 text-[#f97316] px-2 py-0.5 rounded-full font-bold">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#888] leading-relaxed mb-3">{tool.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#555]">{tool.price}</span>
                      <a
                        href={tool.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#f97316] hover:underline flex items-center gap-1"
                      >
                        Learn more <ArrowRight size={10} />
                      </a>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-[#555] leading-relaxed">
                  Affiliate disclosure: M2 earns a commission on referrals to these tools. We only recommend what we'd use ourselves.
                </p>
              </div>
            </div>

          </div>
        </section>

      </div>
    </>
  );
}
