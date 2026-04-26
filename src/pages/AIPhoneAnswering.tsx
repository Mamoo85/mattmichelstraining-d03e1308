import { Link } from "react-router-dom";
import { ArrowRight, Phone, Mail, FileText, Clock, Headphones, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import callDiagram from "@/assets/call-routing-diagram.png";
import WaitlistGate from "@/components/WaitlistGate";
import PostCheckoutClaim from "@/components/checkout/PostCheckoutClaim";
import StickyMobileCTA from "@/components/shared/StickyMobileCTA";

export default function AIPhoneAnswering() {
  const searchParams = new URLSearchParams(window.location.search);
  const status = searchParams.get("status");

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0a0a0f" }}>
        <div className="max-w-md w-full rounded-xl text-center p-8" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <PostCheckoutClaim product="AI Phone Answering" />
          <div className="text-5xl mb-4">📞</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#f8fafc" }}>You're in!</h2>
          <p style={{ color: "#94a3b8" }}>
            Your 7-day free trial has started. Matt will reach out within 24 hours to set up your
            custom greeting and get your calls routing through the system.
          </p>
          <p className="mt-4 text-sm" style={{ color: "#64748b" }}>Questions? Text (313) 992-1219</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block text-sm font-semibold px-4 py-2 rounded-full mb-6" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}>
            24/7 Call Routing Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: "#f8fafc" }}>
            Never Miss a Call.<br />Never Lose a Lead.
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: "#94a3b8" }}>
            Our automated system answers every call to your business 24/7 — greets callers, answers common questions,
            takes detailed messages, and sends you an instant transcript. You only call back the warm leads.
          </p>
          <div className="text-3xl font-bold mb-2" style={{ color: "#22d3ee" }}>$149/mo</div>
          <p className="mb-8" style={{ color: "#64748b" }}>7-day free trial — cancel anytime</p>
        </div>
      </section>

      {/* System Diagram */}
      <section className="px-4 pb-12">
        <div className="max-w-3xl mx-auto">
          <img
            src={callDiagram}
            alt="Call routing system diagram showing phone → automated hub → email and text notifications"
            className="w-full rounded-xl"
            loading="lazy"
            width={1200}
            height={600}
          />
          <p className="text-center text-xs mt-3 font-mono" style={{ color: "#475569" }}>
            CALL FLOW: Incoming → Automated System → Instant Transcript Delivery
          </p>
        </div>
      </section>

      {/* Benefits with icons */}
      <section className="py-12 px-4" style={{ background: "rgba(6,182,212,0.02)", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "24/7 Coverage", desc: "Evenings, weekends, holidays — no call goes to voicemail. Your system never sleeps." },
            { icon: Headphones, title: "Automated System", desc: "Intelligent call routing understands context, responds naturally, and qualifies leads for you." },
            { icon: FileText, title: "Instant Transcripts", desc: "Every call transcript hits your email and phone within seconds. Review and prioritize on the go." },
          ].map((b) => (
            <div key={b.title} className="text-center p-6 rounded-xl" style={{ background: "rgba(15,23,42,0.4)", border: "1px solid rgba(148,163,184,0.06)" }}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)" }}>
                <b.icon className="h-6 w-6" style={{ color: "#22d3ee" }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#f1f5f9" }}>{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — visual steps */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ color: "#f1f5f9" }}>How It Works</h2>
          <p className="text-center mb-12 max-w-xl mx-auto" style={{ color: "#64748b" }}>
            Four simple steps. You'll be up and running in under 10 minutes.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                step: "1",
                icon: Phone,
                title: "Sign up & get your number",
                desc: "We assign you a dedicated local phone number. Your system answers it 24/7 with a professional greeting customized to your business.",
                detail: "Takes 2 minutes to set up"
              },
              {
                step: "2",
                icon: ArrowRight,
                title: "Forward your calls",
                desc: "Set your existing business line to forward unanswered calls to your new routing number. Works with any carrier — Verizon, AT&T, T-Mobile, landline.",
                detail: "One-time phone setting change"
              },
              {
                step: "3",
                icon: MessageSquare,
                title: "System answers & transcribes",
                desc: "Every call gets a professional greeting. The system asks the right questions, captures the caller's name, number, and reason for calling. Full transcript sent instantly.",
                detail: "Email + SMS transcript delivery"
              },
              {
                step: "4",
                icon: Mail,
                title: "You call back the hot ones",
                desc: "Review transcripts on your phone. See exactly who called, what they need, and how urgent it is. Call back the leads that matter — skip the spam.",
                detail: "Prioritize by urgency & intent"
              },
            ].map((s) => (
              <div key={s.step} className="relative rounded-xl p-7 transition-all duration-300 group" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full font-bold flex items-center justify-center flex-shrink-0 text-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg mb-2" style={{ color: "#e2e8f0" }}>{s.title}</h4>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "#94a3b8" }}>{s.desc}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
                      <s.icon className="h-3.5 w-3.5" style={{ color: "#22d3ee" }} />
                      <span className="text-xs font-semibold" style={{ color: "#22d3ee" }}>{s.detail}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Web Design CTA — primary service push */}
      <section className="py-16 px-4" style={{ background: "rgba(6,182,212,0.03)", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: "#22d3ee" }}>Need More Than Call Routing?</p>
          <h2 className="text-3xl font-bold mb-4" style={{ color: "#f1f5f9" }}>
            Get a Complete Lead Machine
          </h2>
          <p className="text-base mb-8" style={{ color: "#64748b" }}>
            Pair your 24/7 Call Routing Engine with a custom-built website designed to convert visitors into paying customers. Web design is our specialty.
          </p>
          <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg transition-all duration-300 uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}>
            <Link to="/web-design-services">
              Explore Web Design Services <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Sign up form */}
      <section className="py-16 px-4" style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-md mx-auto">
          <WaitlistGate productName="24/7 Call Routing Engine" description="Automated phone answering for your business — takes messages, answers FAQs, and routes urgent calls." price="See pricing" />
        </div>
      </section>
    </div>
  );
}
