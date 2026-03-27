import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Shield, Dumbbell, Users, BarChart3, Video, MessageCircle, Apple, ChevronRight, Star, CheckCircle } from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

const stats = [
  { value: "20+", label: "Years Coaching" },
  { value: "5,000+", label: "Clients Trained" },
  { value: "Multiple", label: "National Champions" },
  { value: "Zero", label: "Injury Record" },
];

const steps = [
  { num: "1", title: "Book Your Free Intro", desc: "A quick call to understand your goals, history, and what's holding you back." },
  { num: "2", title: "Get Your Custom Program", desc: "Science-backed programming built around your body, schedule, and equipment." },
  { num: "3", title: "Train With Expert Guidance", desc: "Daily accountability, form checks, and a real coach in your corner — every rep." },
];

const features = [
  { icon: Dumbbell, title: "Custom Programs", desc: "Periodized training built for your goals — not cookie-cutter templates." },
  { icon: BarChart3, title: "Progress Tracking", desc: "Log every lift, track PRs, and see your gains over time." },
  { icon: Video, title: "Exercise Video Library", desc: "Hundreds of coached demos so you never guess on form." },
  { icon: MessageCircle, title: "Direct Coach Access", desc: "Ask questions, get form checks reviewed, and stay on track." },
  { icon: Users, title: "Community & Challenges", desc: "Monthly challenges and leaderboards to keep you motivated." },
  { icon: Apple, title: "Nutrition Tools", desc: "AI-powered meal tracking and macro guidance to fuel your training." },
];

const testimonials = [
  { quote: "I came in at 42 with bad knees and zero confidence. A year later I'm deadlifting 315 and my knees feel better than they did at 30.", name: "Mike R.", tag: "Adult Strength" },
  { quote: "Coach Matt trained my son from 8th grade through his senior year. He earned a D1 scholarship and never missed a game to injury.", name: "Sarah T.", tag: "Youth Athlete Parent" },
  { quote: "I travel 40 weeks a year. Having a real coach who adjusts my program on the fly — not just an app — changed everything.", name: "James K.", tag: "Remote Coaching" },
];

const certs = ["CPT", "FMS", "CES", "IYCA"];

const DemoHomepage = () => (
  <>
    <SEOHead title="TEST — Demo Homepage" description="Test homepage for conversion optimization." path="/demo-home" />

    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background pt-24 pb-16 px-4">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-xs font-semibold px-3 py-1 rounded-full">
            <Trophy size={14} /> 20 Years. Thousands of Athletes. Real Results.
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
            Get Stronger. Stay Healthy.{" "}
            <span className="text-primary">Train With a Coach Who's Done It 10,000 Times.</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Science-backed programs, real coaching accountability, and a proven system that's produced national champions — now available to you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto gap-2 font-bold text-base">
                Start Your Transformation <ChevronRight size={18} />
              </Button>
            </Link>
            <Link to="/results">
              <Button size="lg" variant="outline" className="w-full sm:w-auto font-bold text-base">
                See the Results
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-border bg-card py-8 px-4">
        <div className="max-w-xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-black text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black">How It Works</h2>
            <p className="text-muted-foreground text-sm">Three steps. No guesswork. Just results.</p>
          </div>
          <div className="space-y-6">
            {steps.map((s) => (
              <div key={s.num} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-lg">
                  {s.num}
                </div>
                <div>
                  <h3 className="font-bold text-base">{s.title}</h3>
                  <p className="text-muted-foreground text-sm mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof of Expertise */}
      <section className="bg-card border-y border-border py-16 px-4">
        <div className="max-w-xl mx-auto space-y-8 text-center">
          <div className="space-y-2">
            <Shield className="mx-auto text-primary" size={32} />
            <h2 className="text-2xl font-black">Why Coach Matt?</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Two decades of in-the-trenches coaching. Not influencer hype — real expertise backed by real credentials and real athletes.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {certs.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                <CheckCircle size={12} /> {c} Certified
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground italic">
            "I built this coaching system myself — 20 years of programming knowledge, injury prevention protocols, and athlete development. No generic internet fluff. I guarantee its effectiveness."
          </p>
        </div>
      </section>

      {/* App & Coaching Features */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black">Your Complete Coaching Platform</h2>
            <p className="text-muted-foreground text-sm">Everything you need to train smart — in one app.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="bg-card border-border">
                <CardContent className="p-5 space-y-2">
                  <f.icon className="text-primary" size={22} />
                  <h3 className="font-bold text-sm">{f.title}</h3>
                  <p className="text-muted-foreground text-xs">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card border-y border-border py-16 px-4">
        <div className="max-w-xl mx-auto space-y-8">
          <h2 className="text-2xl font-black text-center">What Clients Say</h2>
          <div className="space-y-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-background rounded-lg border border-border p-5 space-y-3">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm italic text-foreground">"{t.quote}"</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">{t.name}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{t.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-black">Ready to Train With a Real Coach?</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Stop guessing. Stop program-hopping. Get a proven system and a coach who actually watches your lifts.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2 font-bold text-base">
              Start Your Transformation <ChevronRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center">
        <p className="text-xs text-muted-foreground">⚠️ TEST PAGE — Not linked to live site</p>
        <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} M² Training. All rights reserved.</p>
      </footer>
    </div>
  </>
);

export default DemoHomepage;
