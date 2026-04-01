import { useState } from "react";
import { Gift, DollarSign, ArrowRight, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import SEOHead from "@/components/layout/SEOHead";

const ReferWebDesign = () => {
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendBusiness, setFriendBusiness] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrerEmail || !friendEmail || !referrerName) {
      toast({ title: "Please fill out all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-web-design-referral", {
        body: {
          referrer_name: referrerName,
          referrer_email: referrerEmail,
          friend_name: friendName,
          friend_email: friendEmail,
          friend_business: friendBusiness,
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Referral submitted! You'll get $50 when they sign up." });
    } catch (err) {
      toast({ title: "Something went wrong. Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Refer a Client — Get $50 | M² Web Design"
        description="Know a business that needs a website? Refer them to M² Development and earn $50 cash when they sign up."
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/15 via-background to-primary/5 py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-1.5 mb-6">
              <Gift size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Referral Program</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground leading-tight">
              Refer a Client.<br />
              <span className="text-primary">Get $50 Cash.</span>
            </h1>
            <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
              Know a business that needs a website? Send them our way. When they sign up for any web design package, you get <strong className="text-primary">$50</strong> — paid via Venmo, PayPal, or check. No limit.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Submit Their Info", desc: "Fill out the form below with your friend's name and email." },
              { step: "2", title: "We Reach Out", desc: "Matt personally contacts them with a free consultation offer." },
              { step: "3", title: "Get Paid", desc: "When they purchase any web design package, you get $50 cash." },
            ].map((item) => (
              <div key={item.step} className="bg-card border border-border p-6 text-center space-y-3">
                <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center font-black text-lg mx-auto">
                  {item.step}
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="max-w-lg mx-auto px-4 pb-20">
          {submitted ? (
            <div className="bg-primary/10 border border-primary/20 p-8 text-center space-y-4">
              <CheckCircle size={48} className="text-primary mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-widest text-foreground">Referral Submitted!</h3>
              <p className="text-sm text-muted-foreground">
                Matt will reach out to your friend within 24 hours. You'll receive $50 when they purchase any web design package.
              </p>
              <button
                onClick={() => { setSubmitted(false); setFriendName(""); setFriendEmail(""); setFriendBusiness(""); }}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Refer Another →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <DollarSign size={14} className="text-primary" /> Submit a Referral
              </h3>

              <div className="space-y-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Your Info</span>
                <input
                  type="text" placeholder="Your Name *" value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)} required
                  className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <input
                  type="email" placeholder="Your Email *" value={referrerEmail}
                  onChange={(e) => setReferrerEmail(e.target.value)} required
                  className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Their Info</span>
                <input
                  type="text" placeholder="Their Name" value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <input
                  type="email" placeholder="Their Email *" value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)} required
                  className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <input
                  type="text" placeholder="Their Business Name" value={friendBusiness}
                  onChange={(e) => setFriendBusiness(e.target.value)}
                  className="w-full bg-background border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {submitting ? "Submitting..." : <><Send size={14} /> Submit Referral — Earn $50</>}
              </button>

              <p className="text-[10px] text-muted-foreground text-center">
                $50 paid via Venmo, PayPal, or check within 7 days of purchase. No limit on referrals.
              </p>
            </form>
          )}
        </div>

        {/* Pricing reminder */}
        <div className="max-w-3xl mx-auto px-4 pb-20">
          <div className="bg-muted p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground text-center">Web Design Packages</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {[
                { name: "Standard", price: "$499", desc: "5-page professional site" },
                { name: "Professional", price: "$1,499", desc: "Custom design + SEO" },
                { name: "Business", price: "$3,499", desc: "Full-stack web application" },
              ].map((pkg) => (
                <div key={pkg.name} className="bg-card border border-border p-4 space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{pkg.name}</span>
                  <p className="text-2xl font-black text-primary">{pkg.price}</p>
                  <p className="text-[10px] text-muted-foreground">{pkg.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You earn $50 for every referral, regardless of which package they choose.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReferWebDesign;
