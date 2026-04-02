import WaitlistGate from "@/components/WaitlistGate";

export default function TextMessageMarketing() {
  const searchParams = new URLSearchParams(window.location.search);
  const status = searchParams.get("status");

  if (status === "success") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl text-center p-8">
          <div className="text-5xl mb-4">📱</div>
          <h2 className="text-2xl font-bold text-white mb-3">Welcome aboard!</h2>
          <p className="text-slate-300">
            Your 7-day free trial has started. Matt will reach out within 24 hours to set up
            your dedicated SMS number and get your first contact list imported.
          </p>
          <p className="text-slate-400 mt-4 text-sm">Questions? Text (313) 806-4952</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-orange-500/10 text-orange-400 text-sm font-semibold px-4 py-2 rounded-full mb-6">
            Text Message Marketing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            SMS Marketing.<br />Done For You.
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            We write it. We send it. Every month, AI crafts a personalized SMS campaign for your customer
            list and sends it automatically. 98% open rates. Zero effort on your end.
          </p>
          <div className="text-3xl font-bold text-orange-400 mb-2">$79/mo</div>
          <p className="text-slate-400 mb-8">7-day free trial — cancel anytime</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 bg-slate-800/50">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          {[
            { stat: "98%", label: "SMS open rate vs 20% for email" },
            { stat: "45%", label: "Average click-through rate on SMS" },
            { stat: "3×", label: "More revenue per customer with SMS" },
          ].map((s) => (
            <div key={s.stat}>
              <div className="text-4xl font-bold text-orange-400 mb-2">{s.stat}</div>
              <p className="text-slate-300">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">What You Get</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: "✍️", title: "AI-Written Campaigns", desc: "Claude writes custom SMS copy for your business every month — no templates, no fluff." },
              { icon: "📤", title: "Automated Sending", desc: "Campaigns go out on the 1st of every month automatically. Set it and forget it." },
              { icon: "📊", title: "Delivery Reports", desc: "Monthly email report shows exactly how many messages were sent and delivered." },
              { icon: "🚫", title: "Opt-Out Management", desc: "STOP replies are handled automatically. Stay CAN-SPAM compliant without lifting a finger." },
              { icon: "📱", title: "Dedicated Number", desc: "Your own local SMS number — customers see a real local area code, not a short code." },
              { icon: "📋", title: "Easy List Management", desc: "Send us a spreadsheet of customer numbers and we handle the rest." },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 p-4 bg-slate-800 rounded-lg">
                <div className="text-2xl">{f.icon}</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{f.title}</h4>
                  <p className="text-slate-400 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign up form */}
      <section className="py-16 px-4 bg-slate-800/50">
        <div className="max-w-md mx-auto">
          <WaitlistGate productName="Text Message Marketing" description="Done-for-you SMS campaigns to your customer list — promotions, reminders, and re-engagement sequences." price="See pricing" />
        </div>
      </section>
    </div>
  );
}
