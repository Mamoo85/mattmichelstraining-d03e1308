import { ShieldCheck, Phone, Mail } from "lucide-react";

const LocalGuaranteeBlock = () => (
  <section className="py-20">
    <div className="container max-w-4xl mx-auto px-4">
      <div className="rounded-2xl p-8 md:p-12" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.1)" }}>
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Photo */}
          <div className="shrink-0">
            <div className="w-32 h-32 rounded-full overflow-hidden" style={{ border: "3px solid rgba(34,211,238,0.3)", boxShadow: "0 0 30px rgba(34,211,238,0.1)" }}>
              <img src="/images/matt-boat.jpg" alt="Matt Michels — Lead Web Agent" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5" style={{ color: "#22d3ee" }} />
              <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#22d3ee" }}>The Local Guarantee</span>
            </div>

            <blockquote className="text-lg md:text-xl font-semibold leading-relaxed mb-6" style={{ color: "#e2e8f0" }}>
              "I'm not an overseas agency. I'm a local engineer in Grosse Pointe building systems for Michigan businesses. If it doesn't work, I fix it — in person."
            </blockquote>

            <div className="mb-4">
              <div className="text-sm font-bold" style={{ color: "#cbd5e1" }}>Matt Michels</div>
              <div className="text-xs" style={{ color: "#64748b" }}>Lead Web Agent · Detroit Web Agency</div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a href="tel:+13138064952" className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: "#22d3ee" }}>
                <Phone className="h-3.5 w-3.5" /> (313) 806-4952
              </a>
              <a href="mailto:matt@detroitwebagent.com" className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: "#22d3ee" }}>
                <Mail className="h-3.5 w-3.5" /> matt@detroitwebagent.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LocalGuaranteeBlock;
