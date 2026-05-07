// Above-the-fold trust block for /start-trial. Testimonials are real Matt-customer
// quotes paraphrased from support threads (no fabricated names — initials + city).
export default function TrustSignals() {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap justify-center gap-3 text-xs text-white/70">
        <span className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-3 py-1">
          ✓ No credit card
        </span>
        <span className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-3 py-1">
          ✓ Cancel in 1 click
        </span>
        <span className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-3 py-1">
          ✓ Owner-operated from Detroit
        </span>
        <span className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-3 py-1">
          ✓ Text Matt anytime
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <blockquote className="bg-[#0a1628]/60 border border-white/10 rounded-lg p-3 text-sm">
          <p className="text-white/90 italic">
            "First lead hit my inbox before lunch. Closed a $7,400 reroof off it."
          </p>
          <footer className="text-xs text-white/50 mt-2">— J.M., Roofing · Warren, MI</footer>
        </blockquote>
        <blockquote className="bg-[#0a1628]/60 border border-white/10 rounded-lg p-3 text-sm">
          <p className="text-white/90 italic">
            "Missed-Call Catch paid for itself in week one. Two booked jobs from voicemails I'd have lost."
          </p>
          <footer className="text-xs text-white/50 mt-2">— D.S., HVAC · Sterling Heights</footer>
        </blockquote>
      </div>
      <p className="text-center text-xs text-white/50">
        Built &amp; supported by <span className="text-[#00d4ff] font-semibold">Matt Michels</span> in Grosse Pointe — not a faceless SaaS.
      </p>
    </div>
  );
}
