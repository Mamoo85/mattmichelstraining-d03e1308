import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Droplets, Sparkles, Stethoscope, Shield, Lock, Star, Clock, Award, User, Phone, ArrowRight } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&q=80";
const BRAND = "[NAME]";
const GOLD = "#b8a064";
const PHONE = "(313) 806-4952";

const services = [
  { title: "IV Hydration Therapy", desc: "Customized vitamin & nutrient infusions administered in a private suite—because wellness should feel like a retreat.", Icon: Droplets, price: "$150–$350" },
  { title: "Medical Aesthetics", desc: "Botox, dermal fillers, and skin rejuvenation performed by board-certified professionals. Subtle, natural results.", Icon: Sparkles, price: "$250–$800" },
  { title: "Concierge Wellness Plans", desc: "Comprehensive health optimization tailored to your life. Annual physicals, bloodwork, and ongoing care.", Icon: Stethoscope, price: "$199/mo" },
];

const team = [
  { name: "Dr. [Last Name], MD", role: "Medical Director", credential: "Board-Certified Internal Medicine" },
  { name: "[First Name], RN, BSN", role: "Aesthetic Nurse", credential: "Advanced Injector Certified" },
  { name: "[First Name], NP", role: "Wellness Provider", credential: "Functional Medicine Specialist" },
];

const experience = [
  { step: "01", title: "Book", desc: "Schedule online or call. Same-week availability." },
  { step: "02", title: "Arrive", desc: "Private suite, warm towels, no waiting room." },
  { step: "03", title: "Glow", desc: "Walk out looking and feeling your best." },
];

const testimonials = [
  { text: "The most relaxing medical experience I've ever had. Nothing like a typical doctor's office.", initials: "A.L." },
  { text: "Finally found a provider who listens. My wellness plan has genuinely changed how I feel day-to-day.", initials: "M.R." },
  { text: "Discreet, professional, and the results speak for themselves. Highly recommend.", initials: "J.C." },
];

const ClinicMockup = () => {
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderVisible(y < 80 || y < lastY);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#3a3a3a", background: "#ffffff" }}>
      <style>{`
        @keyframes clinic-float { 0%,100%{transform:translateY(0) scale(1);opacity:.15} 50%{transform:translateY(-30px) scale(1.1);opacity:.25} }
        .clinic-orb { position:absolute; border-radius:50%; background:radial-gradient(circle, rgba(184,160,100,.3), transparent 70%); animation: clinic-float ease-in-out infinite; }
      `}</style>

      <Helmet>
        <title>MedSpa & Clinic Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a premium MedSpa or concierge clinic website looks when built by M² Web Design. Luxury aesthetic, HIPAA-aware design for healthcare providers." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-clinic" />
        <meta property="og:title" content="MedSpa & Clinic Website Demo | M² Web Design Detroit" />
        <meta property="og:description" content="Professional MedSpa website mockup by M² Web Design. Luxury branding, patient portal CTA, board-certified trust signals." />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-clinic" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage", "name": "MedSpa Website Demo",
          "description": "Demo MedSpa website built by M² Web Design for healthcare providers in Metro Detroit.",
          "url": "https://www.mattmichelstraining.com/demo-clinic",
          "provider": { "@type": "ProfessionalService", "name": "M² Web Design", "url": "https://www.mattmichelstraining.com/detroit-web-design" }
        })}</script>
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed bottom-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: GOLD, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Announcement + Header */}
      <div className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300" style={{ transform: headerVisible ? "translateY(0)" : "translateY(-100%)", fontFamily: "'Inter', sans-serif" }}>
        <div className="text-center text-xs tracking-[.2em] uppercase py-2" style={{ background: GOLD, color: "#fff" }}>
          Now Accepting New Patients — Limited Availability
        </div>
        <header className="flex items-center justify-between px-4 md:px-8 py-3" style={{ background: "rgba(255,255,255,.97)", backdropFilter: "blur(10px)", borderBottom: "1px solid #eee" }}>
          <span className="text-sm font-semibold tracking-[.15em]" style={{ color: "#1a1a1a" }}>{BRAND} <span style={{ color: GOLD }}>AESTHETICS</span></span>
          <a href="#portal" className="text-xs font-semibold px-4 py-2 rounded tracking-wider uppercase" style={{ background: GOLD, color: "#fff" }}>
            Patient Portal
          </a>
        </header>
      </div>

      {/* Hero with bokeh */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 overflow-hidden" style={{ minHeight: "94vh", paddingTop: "5rem" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Modern aesthetic clinic" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,.75), rgba(255,255,255,.92))" }} />
        </div>
        {/* Bokeh orbs */}
        <div className="clinic-orb" style={{ width: 200, height: 200, top: "15%", left: "10%", animationDuration: "6s" }} />
        <div className="clinic-orb" style={{ width: 120, height: 120, top: "60%", right: "15%", animationDuration: "8s", animationDelay: "2s" }} />
        <div className="clinic-orb" style={{ width: 160, height: 160, bottom: "10%", left: "40%", animationDuration: "7s", animationDelay: "1s" }} />

        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="text-xs tracking-[.4em] uppercase mb-5" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>
            Grosse Pointe &amp; Metro Detroit
          </p>
          <h1 className="text-4xl md:text-6xl font-normal tracking-tight leading-[1.15] mb-2" style={{ color: "#1a1a1a" }}>
            {BRAND}
          </h1>
          <h2 className="text-2xl md:text-3xl mb-6" style={{ color: "#666" }}>AESTHETICS &amp; WELLNESS</h2>
          <div className="w-14 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <p className="text-base md:text-lg leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: "#666", fontFamily: "'Inter', sans-serif" }}>
            Premium, personalized care without the clinical feel.
          </p>
          <a href="#services" className="inline-block text-sm tracking-[.15em] uppercase font-semibold px-10 py-4 rounded transition-transform hover:scale-105" style={{ background: GOLD, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
            View Our Services &amp; Pricing
          </a>
        </div>
      </section>

      {/* Trust Badges */}
      <RevealSection className="py-8 px-6" style={{ background: "#fafaf8", borderTop: "1px solid #eee" }}>
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
          {[
            { Icon: Shield, label: "Board-Certified" },
            { Icon: Lock, label: "HIPAA Compliant" },
            { Icon: Clock, label: "Flexible Scheduling" },
            { Icon: Award, label: "5-Star Rated" },
          ].map(b => (
            <span key={b.label} className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: "#888" }}>
              <b.Icon size={14} style={{ color: GOLD }} /> {b.label}
            </span>
          ))}
        </div>
      </RevealSection>

      {/* The Experience */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>The Experience</h2>
          <div className="w-12 h-px mx-auto mb-14" style={{ background: GOLD }} />
          <div className="grid md:grid-cols-3 gap-8">
            {experience.map((e, i) => (
              <div key={e.step} className="relative text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold" style={{ background: "rgba(184,160,100,.1)", color: GOLD, border: `1px solid rgba(184,160,100,.25)` }}>
                  {e.step}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#1a1a1a" }}>{e.title}</h3>
                <p className="text-sm" style={{ color: "#777", fontFamily: "'Inter', sans-serif" }}>{e.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-7 right-[-20px]">
                    <div className="w-10 border-t border-dashed" style={{ borderColor: GOLD }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Services with Pricing */}
      <RevealSection id="services" className="py-24 px-6" style={{ background: "#fafaf8" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>Our Services</h2>
          <div className="w-12 h-px mx-auto mb-16" style={{ background: GOLD }} />
          <div className="space-y-6">
            {services.map(s => (
              <div key={s.title} className="group flex flex-col md:flex-row gap-6 rounded-xl overflow-hidden transition-shadow hover:shadow-lg" style={{ background: "#fff", border: "1px solid #eee" }}>
                <div className="md:w-64 flex-shrink-0 flex items-center justify-center py-10 md:py-0" style={{ background: "linear-gradient(135deg, #f5f0e8, #fafaf8)" }}>
                  <s.Icon size={48} strokeWidth={1} style={{ color: GOLD }} />
                </div>
                <div className="p-8 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold" style={{ color: "#1a1a1a" }}>{s.title}</h3>
                    <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(184,160,100,.1)", color: GOLD, fontFamily: "'Inter', sans-serif" }}>{s.price}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#777", fontFamily: "'Inter', sans-serif" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Promise */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-px mx-auto mb-8" style={{ background: GOLD }} />
          <blockquote className="text-xl md:text-2xl italic leading-relaxed mb-4" style={{ color: "#2a2a2a" }}>
            "Board-Certified. Discreet. Built around your schedule, not our waiting room."
          </blockquote>
          <p className="text-sm tracking-[.2em] uppercase" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>Our Promise</p>
        </div>
      </RevealSection>

      {/* Meet the Team */}
      <RevealSection className="py-20 px-6" style={{ background: "#fafaf8" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>Meet the Team</h2>
          <div className="w-12 h-px mx-auto mb-14" style={{ background: GOLD }} />
          <div className="grid md:grid-cols-3 gap-8">
            {team.map(t => (
              <div key={t.name} className="group text-center p-6 rounded-xl transition-shadow hover:shadow-lg" style={{ background: "#fff", border: "1px solid #eee" }}>
                <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: "#f5f0e8", border: `2px solid ${GOLD}` }}>
                  <User size={32} strokeWidth={1} style={{ color: GOLD }} />
                </div>
                <h3 className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>{t.name}</h3>
                <p className="text-sm mb-1" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>{t.role}</p>
                <p className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#999", fontFamily: "'Inter', sans-serif" }}>{t.credential}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>What Our Patients Say</h2>
          <div className="w-12 h-px mx-auto mb-12" style={{ background: GOLD }} />
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.initials} className="rounded-xl p-8 text-center" style={{ background: "#fafaf8", border: "1px solid #eee" }}>
                <div className="text-4xl mb-4" style={{ color: GOLD }}>"</div>
                <p className="text-sm italic leading-relaxed mb-5" style={{ color: "#555", fontFamily: "'Inter', sans-serif" }}>{t.text}</p>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={GOLD} color={GOLD} />)}
                </div>
                <span className="text-xs font-semibold" style={{ color: "#aaa", fontFamily: "'Inter', sans-serif" }}>— {t.initials}</span>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Footer */}
      <footer id="portal" className="py-20 px-6" style={{ background: "#f5f5f0", borderTop: "1px solid #e8e8e3" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-normal mb-4" style={{ color: "#1a1a1a" }}>Ready to Begin?</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#777", fontFamily: "'Inter', sans-serif" }}>
              Schedule your consultation or access your records through our HIPAA-compliant patient portal.
            </p>
            <button
              className="inline-flex items-center gap-2 text-sm tracking-[.15em] uppercase font-semibold px-8 py-4 rounded transition-transform hover:scale-105 cursor-pointer"
              style={{ background: GOLD, color: "#fff", border: "none", fontFamily: "'Inter', sans-serif" }}
              onClick={() => alert("This would link to a HIPAA-compliant patient portal (e.g. Jane App, SimplePractice).")}
            >
              <Lock size={14} /> Access the Secure Patient Portal
            </button>
          </div>
          <div className="text-center md:text-right" style={{ fontFamily: "'Inter', sans-serif" }}>
            <p className="text-sm mb-1" style={{ color: "#888" }}>Grosse Pointe, Michigan</p>
            <p className="text-sm mb-1" style={{ color: "#888" }}>By Appointment Only</p>
            <p className="text-sm mb-4" style={{ color: "#888" }}>Mon–Fri: 9am–5pm | Sat: 10am–2pm</p>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="text-sm font-semibold" style={{ color: GOLD }}>{PHONE}</a>
            <div className="flex items-center justify-center md:justify-end gap-2 text-xs mt-4" style={{ color: "#aaa" }}>
              <Shield size={12} style={{ color: GOLD }} /> HIPAA Compliant
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid #e8e8e3" }}>
          <p className="text-xs" style={{ color: "#bbb", fontFamily: "'Inter', sans-serif" }}>
            © 2026 {BRAND} Aesthetics & Wellness. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "#ccc", fontFamily: "'Inter', sans-serif" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ClinicMockup;
