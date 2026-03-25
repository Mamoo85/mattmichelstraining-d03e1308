import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Dumbbell, MapPin, Clock, Users, Car, Bath, Volume2,
  Mail, Send, Handshake, Building2, HeartPulse,
} from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const MAILTO = "mailto:matthew.michels4@gmail.com";

const AMENITIES = [
  { icon: Dumbbell, label: "Full barbell & rack setup" },
  { icon: Dumbbell, label: "Dumbbells (full set)" },
  { icon: Users, label: "Turf / open training floor" },
  { icon: Volume2, label: "Private setting — no gym noise" },
  { icon: Bath, label: "Restroom / changing area" },
  { icon: Car, label: "Parking available" },
];

const PRICING_CARDS = [
  {
    title: "Hourly",
    rate: "Contact for Rate",
    description: "For occasional use. Bring your clients, use the space.",
    subject: "Studio%20Rental%20Inquiry%20-%20Hourly",
  },
  {
    title: "Weekly Block",
    rate: "Contact for Rate",
    description: "Reserved recurring hours. Build a consistent schedule.",
    subject: "Studio%20Rental%20Inquiry%20-%20Weekly",
  },
  {
    title: "Partnership",
    rate: "Let's Talk",
    description: "For PTs and nutritionists who want an ongoing professional home base.",
    subject: "Partnership%20Inquiry",
  },
];

const StudioRental = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke("notify-coach-question", {
        body: { name, email, message, subject: `Studio Rental Inquiry: ${name}` },
      });
      toast({ title: "Got it — Matt will be in touch within 24 hours." });
      setName(""); setEmail(""); setMessage("");
    } catch {
      toast({ title: "Something went wrong. Try emailing directly.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Training Studio Space for Rent — Grosse Pointe Park, MI"
        description="Professional training studio available for rent by the hour or week in Grosse Pointe Park. Ideal for personal trainers, physical therapists, and wellness professionals."
        path="/studio-rental"
      />
      <AppNavbar />

      <div className="container pt-20 pb-16 max-w-4xl">
        {/* HERO */}
        <motion.section {...fade(0)} className="mb-14">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 px-3 py-1 mb-4">
            Studio Space · Grosse Pointe Park, MI
          </span>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-3">
            A Professional Space to Train Your Clients.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mb-6">
            Fully equipped private studio available hourly, daily, or on a recurring schedule.
            Bring your clients. Use the equipment. Keep your business.
          </p>
          <a
            href={`${MAILTO}?subject=Studio%20Rental%20Inquiry`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Mail size={14} /> Check Availability
          </a>
        </motion.section>

        {/* WHAT'S INCLUDED */}
        <motion.section {...fade(0.1)} className="mb-14">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">What's Included</span>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-5">
            Everything You Need. Nothing You Don't.
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AMENITIES.map((a) => (
              <div key={a.label} className="flex items-center gap-3 bg-card border border-border p-3">
                <div className="w-9 h-9 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <a.icon size={16} className="text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">{a.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* PRICING */}
        <motion.section {...fade(0.15)} className="mb-14">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Pricing</span>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground mb-5">
            Flexible Options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PRICING_CARDS.map((card) => (
              <Card key={card.title} className="bg-card border-border">
                <CardContent className="p-5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">{card.title}</h3>
                  <p className="text-lg font-black text-primary font-mono mb-2">{card.rate}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{card.description}</p>
                  <a
                    href={`${MAILTO}?subject=${card.subject}`}
                    className="inline-flex items-center gap-1.5 border border-primary text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
                  >
                    <Mail size={12} /> Inquire
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* WHO THIS IS FOR */}
        <motion.section {...fade(0.2)} className="mb-14">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Who This Is For</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={18} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Trainers</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Independent personal trainers who need a professional environment without a gym's
                commission cut. Bring your existing clients. Build your own brand. No long-term commitment required.
              </p>
            </div>
            <div className="bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={18} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Health Professionals</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Physical therapists, sports chiropractors, and nutritionists looking for a clinical-feel
                space in a fitness environment. Ideal for post-rehab and return-to-sport clients.
              </p>
            </div>
          </div>
        </motion.section>

        {/* PARTNERSHIP */}
        <motion.section {...fade(0.25)} className="mb-14 bg-card border border-primary/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Handshake size={20} className="text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">More Than Just Space</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-2xl">
            If you're a PT or nutritionist interested in a referral partnership — sending clients
            back and forth — let's talk. I'm actively looking for health professionals to build a
            small integrated wellness hub in Grosse Pointe.
          </p>
          <a
            href={`${MAILTO}?subject=Partnership%20Inquiry`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Mail size={13} /> Let's Talk Partnership
          </a>
        </motion.section>

        {/* CONTACT FORM */}
        <motion.section {...fade(0.3)} className="mb-8">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Contact</span>
          <h2 className="text-lg font-black uppercase tracking-tight text-foreground mb-5">Get in Touch</h2>
          <form onSubmit={handleSubmit} className="space-y-3 max-w-lg">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Textarea placeholder="Tell me what you're looking for…" value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} />
            <Button type="submit" disabled={sending} className="gap-2">
              <Send size={14} /> {sending ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </motion.section>

        {/* FOOTER */}
        <div className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} M² Training · Grosse Pointe Park, MI ·{" "}
            <Link to="/" className="text-primary hover:opacity-80 transition-all">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudioRental;
