import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import AppNavbar from "@/components/layout/AppNavbar";
import {
  MessageSquare, Bell, CalendarX, FileText, Receipt, UserPlus, Megaphone, Clock,
  CheckCircle, ArrowRight, Loader2, Shield, Zap,
} from "lucide-react";

const PRODUCTS = [
  { icon: Bell, name: "Review Monitor", desc: "Monitors Google reviews every 6 hours, alerts you instantly to new reviews so you can respond fast.", price: "$25/mo" },
  { icon: MessageSquare, name: "Weekly SMS Blast", desc: "AI writes and sends a promotional text to your customer list every Tuesday.", price: "$19/mo" },
  { icon: CalendarX, name: "No-Show Re-Booker", desc: "Auto-texts no-shows 30 min after missed appointment with a rebooking link.", price: "$25/mo" },
  { icon: FileText, name: "Estimate Follow-Up Drip", desc: "5-step automated SMS sequence for every open quote you send.", price: "$39/mo" },
  { icon: Receipt, name: "Invoice Chaser", desc: "Day 7, 14, 21 payment reminders — polite, persistent, automated.", price: "$29/mo" },
  { icon: UserPlus, name: "After-Job Drip", desc: "3-touch post-job sequence: thank you → review request → referral ask.", price: "$29/mo" },
  { icon: Megaphone, name: "Seasonal Promo Blaster", desc: "6 pre-built seasonal campaigns per year, auto-sent to your list.", price: "$29/mo" },
  { icon: Clock, name: "Slow Day SMS", desc: "Text a keyword when it's slow — instant promo blast goes out to fill your schedule.", price: "$25/mo" },
];

const TOTAL_STANDALONE = "$221";

export default function BundleRevenueSuite() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const sessionId = searchParams.get("session_id");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!email || !businessName) {
      toast.error("Email and business name are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-bundle-revenue-suite-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ email, business_name: businessName, phone, city }),
        }
      );
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
      else throw new Error(data?.error || "Checkout failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Revenue Suite — 8 Automated Revenue Tools | M² Development</title>
        <meta name="description" content="Stop losing revenue. 8 automated SMS & monitoring tools in one bundle for $299/mo instead of $221+ standalone." />
      </Helmet>
      <AppNavbar />
      <div className="min-h-screen bg-background pt-20 pb-24">
        <div className="container max-w-4xl mx-auto px-4">
          {isSuccess && (
            <div className="mb-8 space-y-4">
              <ReceiptStatusBanner sessionId={sessionId} productLabel="Revenue Suite" />
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="text-primary mx-auto mb-3" size={36} />
                  <h2 className="text-2xl font-bold mb-2">You're in. All 8 tools activating.</h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Welcome email is on its way. Matt will text you within 24 hours to finish setup.
                  </p>
                  <a href="sms:+13139921219" className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
                    Text Matt now <ArrowRight size={14} />
                  </a>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Hero */}
          <div className="text-center mb-12">
            <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">Save $100+/mo vs standalone</Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              8 Automated Revenue Tools.<br />One Monthly Price.
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every tool a local business needs to capture, convert, and keep customers — running 24/7 without you lifting a finger.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-muted-foreground line-through text-sm">{TOTAL_STANDALONE}/mo standalone</p>
                <p className="text-3xl font-bold text-primary">$299<span className="text-lg text-muted-foreground">/mo</span></p>
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {PRODUCTS.map((p) => (
              <Card key={p.name} className="border-border/40 hover:border-primary/30 transition-colors">
                <CardContent className="p-5 flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0">{p.price}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Benefits */}
          <div className="bg-muted/30 border border-border/40 rounded-xl p-6 mb-12">
            <h2 className="text-lg font-bold mb-4 text-center">Why the bundle?</h2>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">One Setup</p>
                <p className="text-xs text-muted-foreground">We configure all 8 tools for your business in one onboarding call.</p>
              </div>
              <div>
                <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">One Invoice</p>
                <p className="text-xs text-muted-foreground">$299/mo for everything. No nickel-and-diming.</p>
              </div>
              <div>
                <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">Cancel Anytime</p>
                <p className="text-xs text-muted-foreground">No contracts. If it doesn't pay for itself, walk away.</p>
              </div>
            </div>
          </div>

          {/* CTA form */}
          <Card className="border-primary/30 bg-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-bold mb-6 text-center">Get Started with the Revenue Suite</h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs">Business Name *</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(313) 555-0100" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Grosse Pointe" className="mt-1" />
                </div>
              </div>
              <Button onClick={handleCheckout} disabled={loading} className="w-full h-12 text-base font-bold" size="lg">
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
                Start Revenue Suite — $299/mo
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">Secure checkout via Stripe. Cancel anytime.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
