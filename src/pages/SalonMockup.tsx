import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Scissors, Star, CheckCircle, Phone, Shield, Clock, Award, Sparkles } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1600&q=80";
const BRAND = "The Standard";
const TAGLINE = "Barbershop & Salon";
const PHONE = "(313) 806-4952";
const GOLD = "#c9a84c";
const DARK = "#0a0a0a";
const DARK2 = "#141414";

const services = [
  { title: "Men's Haircut", price: "$35+", desc: "Skin fade, taper, scissor cut, or a classic taper. Clean line-up and hot towel finish included on every cut.", Icon: Scissors },
  { title: "Women's Cut & Style", price: "$55+", desc: "Cut, blowout, and style. We keep up with what's current and we'll tell you honestly what works for your hair type.", Icon: Sparkles },
  { title: "Color & Highlights", price: "$80+", desc: "Full color, highlights, balayage, and color correction. We use professional-grade color and don't rush the process.", Icon: Award },
  { title: "Beard Trim & Lineup", price: "$20+", desc: "Shape, trim, and lineup with hot towel and straight razor. Add to any haircut for the full look.", Icon: Shield },
  { title: "Kids' Cuts (Under 12)", price: "$25+", desc: "Patient with the wiggly ones. Every kid gets a sucker when they're done.", Icon: Star },
  { title: "Special Occasion", price: "Call", desc: "Prom, weddings, photoshoots. Book in advance and we'll make sure you're ready.", Icon: Clock },
];

const credentials = [
  { value: "Licensed", label: "Stylists Only" },
  { value: "15+", label: "Years in Business" },
  { value: "Walk-Ins", label: "Welcome" },
  { value: "4.9", label: "Google Rating" },
];

const testimonials = [
  { text: "Best fade I've had in the city. I've been going every two weeks for three years. I won't go anywhere else.", attr: "— D. Jackson, Harper Woods" },
  { text: "Came in for a color correction after a disaster at another salon. They fixed it perfectly and didn't make me feel bad about it.", attr: "— A. Reynolds, Grosse Pointe" },
  { text: "My 8-year-old refuses to go anywhere else. They're patient with kids and his haircut always looks sharp.", attr: "— M. Kowalski, St. Clair Shores" },
];

const SalonMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", service: "", details: "" });
  const [sent, setSent] = useState(false);
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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0", background: DARK }}>
      <div style={{ background: "#1e40af", color: "white", textAlign: "center", padding: "8px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em" }}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <Helmet>
        <title>Barbershop & Salon Website Demo | M² Web Design Detroit</title>
        <meta name="description" content="See how a barbershop or salon website looks when built by M² Web Design. Professional lead-generation site for hair studios in Metro Detroit." />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-salon" />
      </Helmet>

      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide" style={{ background: GOLD, color: DARK }}>
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">Matt Michels Web Design</Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 transition-transform duration-300"
        style={{
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(10,10,10,.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(201,168,76,.15)"
        }}
      >
        <div>
          <span className="text-sm font-black tracking-widest uppercase text-white">{BRAND}</span>
          <span className="ml-2 text-xs tracking-widest uppercase" style={{ color: GOLD }}>{TAGLINE}</span>
        </div>
        <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg" style={{ background: GOLD, color: DARK }}>
          <Phone size={14} /> Book Now
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16" style={{ minHeight: "90vh" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Professional barbershop" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,10,10,.65), rgba(10,10,10,.96))" }} />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-8 px-4 py-2 rounded-full" style={{ background: "rgba(201,168,76,.12)", color: GOLD, border: "1px solid rgba(201,168,76,.3)" }}>
            <Scissors size={14} /> Walk-Ins Welcome · East Side Detroit
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-none mb-3 text-white uppercase">
            The<br /><span style={{ color: GOLD }}>Standard</span>
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] mb-8" style={{ color: "rgba(255,255,255,.5)" }}>Barbershop & Salon · Grosse Pointe Park</p>
          <p className="text-base md:text-lg mb-10 max-w-sm mx-auto" style={{ color: "rgba(255,255,255,.65)" }}>
            Sharp cuts. Clean fades. Color that lasts. No walk-out haircuts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#booking" className="inline-flex items-center gap-3 text-base font-extrabold px-8 py-4 rounded-xl transition-transform hover:scale-105" style={{ background: GOLD, color: DARK }}>
              <Scissors size={18} /> Book Your Appointment
            </a>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center gap-3 text-base font-bold px-6 py-4 rounded-xl border text-white" style={{ borderColor: "rgba(201,168,76,.35)" }}>
              <Phone size={18} /> {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <RevealSection className="py-12 px-6" style={{ background: DARK2 }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {credentials.map(c => (
            <div key={c.label} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-white">{c.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,.4)" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Services / Menu */}
      <RevealSection className="py-20 px-6" style={{ background: DARK }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: GOLD }}>Our Services</p>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase">The Menu</h2>
          </div>
          <div className="space-y-3">
            {services.map(s => (
              <div key={s.title} className="flex items-center gap-5 p-5 rounded-xl" style={{ background: DARK2, border: "1px solid rgba(201,168,76,.1)" }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,76,.1)" }}>
                  <s.Icon size={18} style={{ color: GOLD }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white">{s.title}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{s.desc}</p>
                </div>
                <div className="flex-shrink-0 text-sm font-black" style={{ color: GOLD }}>{s.price}</div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Trust Strip */}
      <RevealSection className="py-10 px-6" style={{ background: DARK2 }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-6 p-8 rounded-xl" style={{ background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.15)" }}>
          <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(201,168,76,.1)", border: "2px solid rgba(201,168,76,.25)" }}>
            <Award size={28} style={{ color: GOLD }} />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-white mb-1">No Walk-Out Haircuts. Ever.</h3>
            <p className="text-sm" style={{ color: "#94a3b8" }}>If you're not happy when you get out of the chair, you don't pay. We've been doing this long enough that it almost never comes up — but the offer stands.</p>
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: DARK }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 text-white">What Our Clients Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.attr} className="rounded-xl p-6" style={{ background: DARK2, border: "1px solid rgba(201,168,76,.1)" }}>
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={GOLD} color={GOLD} />)}
                </div>
                <p className="italic text-sm mb-2" style={{ color: "rgba(255,255,255,.6)" }}>"{t.text}"</p>
                <p className="text-xs" style={{ color: "#475569" }}>{t.attr}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Hours */}
      <RevealSection className="py-12 px-6" style={{ background: DARK2 }}>
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-lg font-bold text-white mb-6">Hours & Location</h3>
          <div className="grid grid-cols-2 gap-3 text-sm mb-6" style={{ color: "#94a3b8" }}>
            {[
              { day: "Monday", hours: "Closed" },
              { day: "Tuesday – Friday", hours: "9am – 7pm" },
              { day: "Saturday", hours: "8am – 5pm" },
              { day: "Sunday", hours: "10am – 3pm" },
            ].map(h => (
              <div key={h.day} className="p-3 rounded-lg text-left" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="font-semibold text-white text-xs">{h.day}</div>
                <div style={{ color: h.hours === "Closed" ? "#ef4444" : GOLD }} className="font-bold">{h.hours}</div>
              </div>
            ))}
          </div>
          <p className="text-sm" style={{ color: "#94a3b8" }}>Grosse Pointe Park, MI · Walk-ins welcome, appointments preferred</p>
        </div>
      </RevealSection>

      {/* Booking Form */}
      <footer id="booking" className="px-6 py-16" style={{ background: "#060606", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Book an Appointment</h2>
            <p className="text-sm mb-6" style={{ color: "#64748b" }}>Tell us what you're looking for and when works for you. Walk-ins always welcome too.</p>
            {sent ? (
              <p className="text-lg" style={{ color: GOLD }}>✂ You're booked! We'll confirm shortly.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "service" as const, placeholder: "Service (e.g. Fade, Color, Women's Cut)", type: "text" },
                ].map(f => (
                  <input key={f.name} required type={f.type} placeholder={f.placeholder} value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-lg px-4 py-3 text-base outline-none"
                    style={{ background: DARK2, border: "1px solid rgba(255,255,255,.08)", color: "#f1f5f9" }}
                  />
                ))}
                <textarea placeholder="Best days/times? Any special requests?" value={form.details}
                  onChange={e => setForm(p => ({ ...p, details: e.target.value }))} rows={4}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none resize-none"
                  style={{ background: DARK2, border: "1px solid rgba(255,255,255,.08)", color: "#f1f5f9" }}
                />
                <button type="submit" className="w-full font-bold text-lg py-3 rounded-lg transition-opacity hover:opacity-90" style={{ background: GOLD, color: DARK }}>
                  Request Appointment
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Services</h3>
              <ul className="space-y-2 text-sm">
                {["Men's Haircut & Fade", "Women's Cut & Style", "Color & Highlights", "Beard Trim & Lineup", "Kids' Cuts", "Special Occasion"].map(s => (
                  <li key={s} className="flex items-center gap-2"><Scissors size={14} style={{ color: GOLD }} /> {s}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Walk-Ins Welcome", "Licensed Stylists", "15+ Years Experience"].map(b => (
                <span key={b} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(201,168,76,.1)", color: GOLD, border: "1px solid rgba(201,168,76,.2)" }}>
                  <CheckCircle size={10} /> {b}
                </span>
              ))}
            </div>
            <a href={`tel:${PHONE.replace(/\D/g, "")}`} className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-lg" style={{ background: GOLD, color: DARK }}>
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10" style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
          <p className="text-xs" style={{ color: "#334155" }}>© {new Date().getFullYear()} {BRAND} {TAGLINE}. All rights reserved.</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.12)" }}>
            Site by{" "}
            <Link to="/detroit-web-design" className="underline underline-offset-2 hover:text-white transition-colors">Matt Michels Web Design</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SalonMockup;
