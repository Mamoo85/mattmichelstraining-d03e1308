import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Search, BarChart3, Bell, FileText, Smartphone, CheckCircle } from "lucide-react";

const FEATURES = [
  { icon: Search, title: "JavaScript Visibility Check", desc: "We compare what Google sees vs. what your customers see. If there's a gap, you'll know." },
  { icon: BarChart3, title: "Keyword Rank Alerts", desc: "SMS the moment a keyword drops more than 3 spots so you can act fast." },
  { icon: Shield, title: "Citation Health", desc: "Monthly check that your name, address, and phone match everywhere online." },
  { icon: Bell, title: "Indexation Monitor", desc: "Instant alert if Google removes a page from search results." },
  { icon: FileText, title: "Monthly AI Report", desc: "Plain-English summary of your biggest SEO issues + how to fix them." },
  { icon: Smartphone, title: "7-Day Free Trial", desc: "Try it risk-free. First report arrives Monday morning. Cancel anytime." },
];

export default function SeoGuard() {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const isSuccess = params.get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !websiteUrl) {
      toast({ title: "Missing fields", description: "Email and website URL are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seo-guard-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ email, business_name: businessName, website_url: websiteUrl, keywords, phone }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">SEO Guard is Active!</h2>
            <p className="text-muted-foreground">Your 7-day free trial has started. Your first SEO report will arrive Monday morning.</p>
            <p className="text-sm text-muted-foreground">If we detect any issues, you'll get an SMS alert immediately.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-6 text-sm">
            7-Day Free Trial · No Credit Card to Start
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Is Google Actually Finding<br />Your Website?
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            Most local business websites have at least one indexation problem they don't know about. We check every week — and text you if something's wrong.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
            <span>✅ Weekly scans</span>
            <span>✅ SMS alerts</span>
            <span>✅ AI reports</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">Everything We Monitor</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="bg-card border-border hover:border-orange-500/30 transition-colors">
              <CardContent className="pt-6 space-y-3">
                <f.icon className="h-8 w-8 text-orange-500" />
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Signup Form */}
      <section className="max-w-lg mx-auto px-4 py-16">
        <Card className="border-orange-500/20">
          <CardContent className="pt-8 pb-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Start Your Free Trial</h2>
              <p className="text-muted-foreground">$29/mo after 7 days · Cancel anytime · No contracts</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" required />
              </div>
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input id="business_name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Plumbing" />
              </div>
              <div>
                <Label htmlFor="website_url">Website URL *</Label>
                <Input id="website_url" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://acmeplumbing.com" required />
              </div>
              <div>
                <Label htmlFor="keywords">Keywords to Track (up to 5, comma-separated)</Label>
                <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="plumber near me, emergency plumbing, drain cleaning" />
              </div>
              <div>
                <Label htmlFor="phone">Phone (for SMS alerts)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(313) 555-1234" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-orange-500 hover:bg-orange-600 text-white">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : "Start Free 7-Day Trial → $29/mo after"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">No contracts. Cancel anytime. First report arrives Monday.</p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-muted-foreground border-t border-border">
        <p>M² Development · Grosse Pointe, MI · <a href="tel:+13138064952" className="text-orange-500">(313) 806-4952</a></p>
      </footer>
    </div>
  );
}
