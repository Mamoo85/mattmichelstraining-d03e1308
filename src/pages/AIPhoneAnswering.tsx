import WaitlistGate from "@/components/WaitlistGate";

export default function AIPhoneAnswering() {
  const searchParams = new URLSearchParams(window.location.search);
  const status = searchParams.get("status");

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0a0a0f" }}>
        <div className="max-w-md w-full rounded-xl text-center p-8" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <div className="text-5xl mb-4">📞</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#f8fafc" }}>You're in!</h2>
          <p style={{ color: "#94a3b8" }}>
            Your 7-day free trial has started. Matt will reach out within 24 hours to set up your
            custom greeting and get your calls routing through the system.
          </p>
          <p className="mt-4 text-sm" style={{ color: "#64748b" }}>Questions? Text (313) 806-4952</p>
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

      {/* Benefits */}
      <section className="py-12 px-4" style={{ background: "rgba(6,182,212,0.02)", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: "🕐", title: "24/7 Coverage", desc: "Evenings, weekends, holidays — no call goes to voicemail." },
            { icon: "🤖", title: "Automated System", desc: "Intelligent call routing understands context and responds naturally to callers." },
            { icon: "📋", title: "Instant Transcripts", desc: "Every call transcript hits your email and phone within seconds." },
          ].map((b) => (
            <div key={b.title} className="text-center">
              <div className="text-4xl mb-3">{b.icon}</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#f1f5f9" }}>{b.title}</h3>
              <p style={{ color: "#64748b" }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10" style={{ color: "#f1f5f9" }}>How It Works</h2>
          <div className="space-y-6">
            {[
              { step: "1", title: "Sign up & get your number", desc: "We assign you a local phone number that your system answers." },
              { step: "2", title: "Forward your calls", desc: "Set your business line to forward unanswered calls to your routing number — takes 2 minutes." },
              { step: "3", title: "System answers & transcribes", desc: "Every call gets a professional greeting. Caller's message is emailed and texted to you instantly." },
              { step: "4", title: "You call back the hot ones", desc: "Review transcripts, prioritize, call back. No more playing voicemail tag." },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="w-10 h-10 rounded-full font-bold flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
                  {s.step}
                </div>
                <div>
                  <h4 className="font-semibold" style={{ color: "#e2e8f0" }}>{s.title}</h4>
                  <p style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign up form */}
      <section className="py-16 px-4" style={{ background: "rgba(6,182,212,0.02)", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-md mx-auto">
          <WaitlistGate productName="24/7 Call Routing Engine" description="Automated phone answering for your business — takes messages, answers FAQs, and routes urgent calls." price="See pricing" />
        </div>
      </section>
    </div>
  );
}
