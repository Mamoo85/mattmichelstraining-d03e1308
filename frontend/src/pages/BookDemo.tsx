import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Calendar, Clock, Phone, Mail, Building2, ArrowRight, Zap, BarChart3, Users } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

const benefits = [
  { icon: Zap, title: "See results in 30 days", desc: "Real leads, real pipeline — no fluff." },
  { icon: BarChart3, title: "Live dashboard demo", desc: "We'll show you your market in real time." },
  { icon: Users, title: "Custom to your trade", desc: "Radar built for your specific industry." },
];

const services = [
  "Trade Radar (HVAC, Plumbing, Electrical, etc.)",
  "Talent Radar (Hiring alerts)",
  "Demand Radar (Market intelligence)",
  "Missed-Call Catch",
  "Dead Lead Reactivation",
  "Social Media Captions",
  "Church Newsletter Automation",
  "Other / Not sure yet",
];

const BookDemo = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    business: "",
    service: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production this would POST to a Supabase function or email
    setSubmitted(true);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (submitted) {
    return (
      <>
        <SEOHead
          title="Demo Booked — Detroit Web Agency"
          description="We'll be in touch within 1 business day."
          path="/book-demo"
        />
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-10 pb-8 space-y-4">
              <CheckCircle className="text-green-500 mx-auto" size={56} />
              <h1 className="text-2xl font-bold">You're on the list!</h1>
              <p className="text-muted-foreground">
                We'll reach out to <strong>{form.email}</strong> within 1 business day to schedule your live demo.
              </p>
              <p className="text-sm text-muted-foreground">
                Questions? Call us at{" "}
                <a href="tel:+13135550100" className="underline">
                  (313) 555-0100
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Book a Free Demo — Detroit Web Agency"
        description="See how Detroit Web Agency's AI-powered lead radar works for your trade business. Book a free 20-minute demo today."
        path="/book-demo"
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <section className="bg-gradient-to-b from-primary/10 to-background pt-16 pb-10 px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-xs font-semibold px-3 py-1 rounded-full">
              <Calendar size={13} /> Free 20-Minute Demo
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
              Book Your Free Demo with{" "}
              <span className="text-primary">Detroit Web Agency</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-base">
              See your market's live lead data in real time. No pressure, no pitch decks — just a working demo of
              the radar built for your industry.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-8 px-4">
          <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-4">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <Icon className="text-primary mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Form */}
        <section className="py-8 px-4 pb-20">
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Schedule Your Demo</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="Matt Michels"
                        required
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="business">Business Name</Label>
                      <Input
                        id="business"
                        placeholder="Michels HVAC"
                        value={form.business}
                        onChange={(e) => handleChange("business", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        <Mail size={13} className="inline mr-1" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">
                        <Phone size={13} className="inline mr-1" />
                        Phone (optional)
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(313) 555-0100"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="service">
                      <Building2 size={13} className="inline mr-1" />
                      Which service interests you?
                    </Label>
                    <Select onValueChange={(v) => handleChange("service", v)}>
                      <SelectTrigger id="service">
                        <SelectValue placeholder="Select a service…" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message">Anything we should know?</Label>
                    <Textarea
                      id="message"
                      placeholder="e.g. We're a 5-person HVAC company in Detroit looking to grow our service territory..."
                      rows={3}
                      value={form.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full font-bold gap-2">
                    Book My Free Demo <ArrowRight size={16} />
                  </Button>

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> 20 min, no obligation
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle size={12} /> No credit card required
                    </span>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
};

export default BookDemo;
