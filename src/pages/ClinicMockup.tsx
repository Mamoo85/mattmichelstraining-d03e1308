import { Helmet } from "react-helmet-async";
import { Droplets, Sparkles, Stethoscope, Shield, Lock, Star, Clock, Award, User } from "lucide-react";
import heroImg from "@/assets/demo-clinic-hero.jpg";
import { RevealSection } from "@/hooks/useInView";

const BRAND = "[NAME]";
const GOLD = "#b8a064";

const services = [
  { title: "IV Hydration Therapy", desc: "Customized vitamin & nutrient infusions administered in a private suite—because wellness should feel like a retreat, not a hospital visit.", Icon: Droplets },
  { title: "Medical Aesthetics", desc: "Botox, dermal fillers, and skin rejuvenation performed by board-certified professionals. Subtle, natural results every time.", Icon: Sparkles },
  { title: "Concierge Wellness Plans", desc: "Comprehensive health optimization tailored to your life. Annual physicals, bloodwork, and ongoing care—on your schedule.", Icon: Stethoscope },
];

const team = [
  { name: "Dr. [Last Name], MD", role: "Medical Director", credential: "Board-Certified Internal Medicine" },
  { name: "[First Name], RN, BSN", role: "Aesthetic Nurse", credential: "Advanced Injector Certified" },
  { name: "[First Name], NP", role: "Wellness Provider", credential: "Functional Medicine Specialist" },
];

const testimonials = [
  { text: "The most relaxing medical experience I've ever had. Nothing like a typical doctor's office.", initials: "A.L." },
  { text: "Finally found a provider who listens. My wellness plan has genuinely changed how I feel day-to-day.", initials: "M.R." },
  { text: "Discreet, professional, and the results speak for themselves. Highly recommend.", initials: "J.C." },
];

const ClinicMockup = () => (
  <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#3a3a3a", background: "#ffffff" }}>
    <Helmet>
      <title>{BRAND} Aesthetics & Wellness | Premium MedSpa Grosse Pointe</title>
      <meta name="description" content="Premium medical aesthetics, IV therapy, and concierge wellness in Grosse Pointe. Board-certified care in a luxurious, private setting." />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>

    {/* Announcement Bar */}
    <div className="fixed top-0 left-0 right-0 z-50" style={{ fontFamily: "'Inter', sans-serif" }}>
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

    {/* Hero */}
    <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "94vh", paddingTop: "5rem" }}>
      <div className="absolute inset-0 z-0">
        <img src={heroImg} alt="Modern aesthetic clinic" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,.75), rgba(255,255,255,.92))" }} />
      </div>
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

    {/* Services — Full-Width Horizontal Cards */}
    <RevealSection id="services" className="py-24 px-6" style={{ background: "#fff" }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>Our Services</h2>
        <div className="w-12 h-px mx-auto mb-16" style={{ background: GOLD }} />
        <div className="space-y-6">
          {services.map(s => (
            <div key={s.title} className="flex flex-col md:flex-row gap-6 rounded-xl overflow-hidden" style={{ background: "#fafaf8", border: "1px solid #eee" }}>
              <div className="md:w-64 flex-shrink-0 flex items-center justify-center py-10 md:py-0" style={{ background: "linear-gradient(135deg, #f5f0e8, #fafaf8)" }}>
                <s.Icon size={48} strokeWidth={1} style={{ color: GOLD }} />
              </div>
              <div className="p-8 flex-1">
                <h3 className="text-xl font-semibold mb-3" style={{ color: "#1a1a1a" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#777", fontFamily: "'Inter', sans-serif" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RevealSection>

    {/* Promise / Trust */}
    <RevealSection className="py-20 px-6" style={{ background: "#fafaf8" }}>
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-12 h-px mx-auto mb-8" style={{ background: GOLD }} />
        <blockquote className="text-xl md:text-2xl italic leading-relaxed mb-4" style={{ color: "#2a2a2a" }}>
          "Board-Certified. Discreet. Built around your schedule, not our waiting room."
        </blockquote>
        <p className="text-sm tracking-[.2em] uppercase" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>Our Promise</p>
      </div>
    </RevealSection>

    {/* Meet the Team */}
    <RevealSection className="py-20 px-6" style={{ background: "#fff" }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>Meet the Team</h2>
        <div className="w-12 h-px mx-auto mb-14" style={{ background: GOLD }} />
        <div className="grid md:grid-cols-3 gap-8">
          {team.map(t => (
            <div key={t.name} className="text-center">
              <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#f5f0e8", border: `2px solid ${GOLD}` }}>
                <User size={32} strokeWidth={1} style={{ color: GOLD }} />
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>{t.name}</h3>
              <p className="text-sm mb-1" style={{ color: GOLD, fontFamily: "'Inter', sans-serif" }}>{t.role}</p>
              <p className="text-xs" style={{ color: "#999", fontFamily: "'Inter', sans-serif" }}>{t.credential}</p>
            </div>
          ))}
        </div>
      </div>
    </RevealSection>

    {/* Testimonials */}
    <RevealSection className="py-20 px-6" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-normal text-center mb-3" style={{ color: "#1a1a1a" }}>What Our Patients Say</h2>
        <div className="w-12 h-px mx-auto mb-12" style={{ background: GOLD }} />
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map(t => (
            <div key={t.initials} className="rounded-xl p-8 text-center" style={{ background: "#fff", border: "1px solid #eee" }}>
              <div className="text-4xl mb-4" style={{ color: GOLD, fontFamily: "Georgia, serif" }}>"</div>
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

    {/* Footer — Two Column */}
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
          <div className="flex items-center justify-center md:justify-end gap-2 text-xs" style={{ color: "#aaa" }}>
            <Shield size={12} style={{ color: GOLD }} /> HIPAA Compliant
          </div>
        </div>
      </div>
      <p className="text-center text-xs mt-16" style={{ color: "#bbb", fontFamily: "'Inter', sans-serif" }}>
        © 2026 {BRAND} Aesthetics & Wellness. All rights reserved.
      </p>
    </footer>
  </div>
);

export default ClinicMockup;
