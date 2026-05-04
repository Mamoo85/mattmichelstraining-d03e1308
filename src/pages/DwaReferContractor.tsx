import { useState, useEffect } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Copy, Users, DollarSign, Send, Trophy, Crown } from "lucide-react";

const TIER_META: Record<string, { label: string; color: string; icon: any }> = {
  platinum: { label: "Platinum", color: "text-cyan-300", icon: Crown },
  gold: { label: "Gold", color: "text-yellow-400", icon: Trophy },
  silver: { label: "Silver", color: "text-slate-300", icon: Trophy },
  bronze: { label: "Bronze", color: "text-amber-700", icon: Trophy },
};

const PRODUCTS = [
  { value: "any", label: "Any DWA product" },
  { value: "TechAlert", label: "TechAlert ($149/mo)" },
  { value: "FieldDesk", label: "FieldDesk ($199/mo)" },
  { value: "Contractor Leads", label: "Contractor Leads ($399/mo)" },
  { value: "Mortgage Radar", label: "Mortgage Radar ($149/mo)" },
  { value: "Missed-Call Catch", label: "Missed-Call Catch ($99/mo)" },
  { value: "SiteRadar", label: "SiteRadar ($49/mo)" },
];

const DwaReferContractor = () => {
  const [form, setForm] = useState({
    referrer_email: "",
    referrer_business_name: "",
    referrer_phone: "",
    referred_email: "",
    referred_business_name: "",
    referred_phone: "",
    product_interest: "any",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [optInLeaderboard, setOptInLeaderboard] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("referral_partners")
        .select("name, current_tier, paid_referrals, total_referrals")
        .eq("show_on_leaderboard", true)
        .order("paid_referrals", { ascending: false })
        .limit(10);
      // first-name only
      const masked = (data || []).map((r: any) => ({
        ...r,
        first_name: (r.name || "").split(/\s+/)[0] || "Anonymous",
      }));
      setLeaderboard(masked);
    })();
  }, []);

  useEffect(() => {
    if (!form.referrer_email || !form.referrer_email.includes("@")) return;
    const t = setTimeout(loadStats, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.referrer_email]);

  const loadStats = async () => {
    try {
      const { data } = await supabase.functions.invoke("dwa-contractor-referral", {
        body: { action: "list_mine", referrer_email: form.referrer_email.trim().toLowerCase() },
      });
      if (data?.ok) {
        setStats(data.stats);
        setHistory(data.referrals || []);
      }
    } catch {
      // silent
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referrer_email || !form.referred_email) {
      toast.error("Both your email and your friend's email are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dwa-contractor-referral", {
        body: { action: "create_code", ...form },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        toast.error(data.error.replace(/_/g, " "));
        return;
      }
      setResult({ code: data.code });
      toast.success("Referral sent! We just emailed them.");
      setForm({ ...form, referred_email: "", referred_business_name: "", referred_phone: "" });
      loadStats();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://detroitwebagent.com/?ref=${code}`);
    toast.success("Link copied!");
  };

  return (
    <>
      <SEOHead
        title="Refer a Contractor — Earn $50 Credit | Detroit Web Agency"
        description="Know another Michigan contractor who'd benefit from automation? Refer them to DWA and get $50 account credit when they sign up."
      />
      <div className="min-h-screen bg-[#0a1628] text-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 border border-[#00d4ff]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-4">
              <Users size={12} /> Contractor Referral Program
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">
              Refer a contractor.<br />
              <span className="text-[#00d4ff]">Earn $50 credit.</span>
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto">
              Know another Michigan trades contractor who'd benefit from our automation? Send them our way. When they sign up for any DWA product, your next invoice gets $50 off.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: Send, label: "1. Send referral", desc: "We email them on your behalf" },
              { icon: CheckCircle, label: "2. They sign up", desc: "Any DWA product counts" },
              { icon: DollarSign, label: "3. You get $50", desc: "Credit on next invoice" },
            ].map((s, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800 p-4 text-center">
                <s.icon className="w-5 h-5 text-[#00d4ff] mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-[11px] text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Stats panel */}
          {stats && stats.total > 0 && (
            <div className="bg-[#00d4ff]/5 border border-[#00d4ff]/30 p-5 mb-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-3">Your Referral Stats</p>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-2xl font-black">{stats.total}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Sent</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.signed_up}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Signed Up</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#00d4ff]">{stats.paid}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Paid</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-400">${(stats.credit_earned_cents / 100).toFixed(0)}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Earned</div>
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 mb-8 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="font-bold">Referral sent!</p>
              </div>
              <p className="text-sm text-slate-300">
                Your code: <code className="bg-slate-900 px-2 py-1 text-[#00d4ff]">{result.code}</code>
              </p>
              <button
                onClick={() => copyLink(result.code)}
                className="text-xs flex items-center gap-1 text-[#00d4ff] hover:underline"
              >
                <Copy size={12} /> Copy your shareable link
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 p-6 space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-3">Your Info</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Your email *</Label>
                  <Input
                    type="email"
                    value={form.referrer_email}
                    onChange={(e) => setForm({ ...form, referrer_email: e.target.value })}
                    placeholder="you@yourcompany.com"
                    required
                    className="bg-slate-950 border-slate-700"
                  />
                </div>
                <div>
                  <Label className="text-xs">Your business</Label>
                  <Input
                    value={form.referrer_business_name}
                    onChange={(e) => setForm({ ...form, referrer_business_name: e.target.value })}
                    placeholder="Acme HVAC"
                    className="bg-slate-950 border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-3">Their Info</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Their email *</Label>
                  <Input
                    type="email"
                    value={form.referred_email}
                    onChange={(e) => setForm({ ...form, referred_email: e.target.value })}
                    placeholder="friend@theircompany.com"
                    required
                    className="bg-slate-950 border-slate-700"
                  />
                </div>
                <div>
                  <Label className="text-xs">Their business</Label>
                  <Input
                    value={form.referred_business_name}
                    onChange={(e) => setForm({ ...form, referred_business_name: e.target.value })}
                    placeholder="Their company"
                    className="bg-slate-950 border-slate-700"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Product they'd most benefit from</Label>
                <select
                  value={form.product_interest}
                  onChange={(e) => setForm({ ...form, product_interest: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-sm p-2 mt-1"
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 font-bold uppercase tracking-widest"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Referral
            </Button>

            <p className="text-[11px] text-slate-500 text-center">
              We'll email them on your behalf with a friendly intro. No spam — one email, then radio silence unless they reply.
            </p>
          </form>

          {/* History */}
          {history.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Your Referrals</h3>
              <div className="space-y-2">
                {history.map((r) => (
                  <div key={r.id} className="bg-slate-900/50 border border-slate-800 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.referred_business_name || r.referred_email}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.product_interest} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${
                      r.status === "credited" || r.status === "paid"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : r.status === "signed_up"
                        ? "bg-[#00d4ff]/20 text-[#00d4ff]"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-slate-600 mt-10">
            Questions? Text Matt at (313) 992-1219.
          </p>
        </div>
      </div>
    </>
  );
};

export default DwaReferContractor;
