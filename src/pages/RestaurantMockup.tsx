import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Phone, MapPin, Clock, Star, Music, Users, Calendar, ChevronDown, CheckCircle, Utensils } from "lucide-react";
import { RevealSection } from "@/hooks/useInView";

const heroImg = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80";
const BRAND = "Pier 47 Kitchen + Bar";
const PHONE = "(313) 806-4952";
const AMBER = "#92400e";
const AMBER_LIGHT = "#d97706";
const AMBER_TEXT = "#fbbf24";

type MenuCategory = {
  name: string;
  note?: string;
  items: { name: string; desc: string; price: string }[];
};

const menuCategories: MenuCategory[] = [
  {
    name: "Starters",
    items: [
      { name: "Pier Wings", desc: "Choice of 5 house sauces", price: "$14" },
      { name: "Ahi Tuna Stack", desc: "Wonton crisps, sriracha aioli", price: "$16" },
      { name: "Loaded Fries", desc: "Aged cheddar, smoked bacon, jalapeño ranch", price: "$12" },
    ],
  },
  {
    name: "Mains",
    items: [
      { name: "Lake Perch Basket", desc: "Hand-breaded, cole slaw, fries", price: "$19" },
      { name: "Smash Burger", desc: "Double patty, American cheese, special sauce", price: "$16" },
      { name: "Grilled Salmon", desc: "Lemon caper butter, seasonal veg, mashed potato", price: "$26" },
    ],
  },
  {
    name: "Brunch",
    note: "Sat–Sun only",
    items: [
      { name: "Pier Benedict", desc: "Crab cake, poached egg, hollandaise", price: "$17" },
      { name: "Smoked Salmon Bagel", desc: "Cream cheese, capers, red onion", price: "$15" },
      { name: "Bottomless Mimosas", desc: "Choice of OJ, peach, or cranberry", price: "$22" },
    ],
  },
  {
    name: "Drinks",
    items: [
      { name: "Signature Cocktails", desc: "Crafted in-house by our bar team", price: "Market" },
      { name: "Michigan Craft Beers", desc: "Rotating taps from local breweries", price: "Market" },
      { name: "Full Bar", desc: "Premium spirits, wines by the glass or bottle", price: "Market" },
    ],
  },
];

const features = [
  { Icon: Music, title: "Live Music", desc: "Thursday–Saturday nights. Local artists, great vibe." },
  { Icon: Users, title: "Private Events", desc: "Private dining rooms for up to 60 guests. Perfect for corporate events, birthdays, and celebrations." },
  { Icon: Clock, title: "Happy Hour", desc: "Mon–Fri 3–6pm. Discounted drinks and appetizers at the bar." },
  { Icon: Utensils, title: "Catering", desc: "Full-service catering available for off-site events. Custom menus, delivery, and setup." },
];

const testimonials = [
  {
    text: "Best perch in Detroit. The view doesn't hurt either. Been coming here for years.",
    attr: "— Mike T., Grosse Pointe",
  },
  {
    text: "Hosted our company party in the private room. Food was great, staff was fantastic.",
    attr: "— Sarah K., Corporate Event",
  },
  {
    text: "Thursday night live music + the salmon = perfect date night.",
    attr: "— Verified Google Review",
  },
];

const hours = [
  { day: "Mon–Thu", time: "11am – 10pm" },
  { day: "Fri–Sat", time: "11am – 12am" },
  { day: "Sun", time: "10am – 9pm (Brunch)" },
];

const RestaurantMockup = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", details: "" });
  const [sent, setSent] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [activeMenu, setActiveMenu] = useState(0);

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
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: "#e2d8cc", background: "#1a0f07" }}>
      <div style={{background:"#1e40af",color:"white",textAlign:"center",padding:"8px",fontSize:"11px",fontWeight:"700",letterSpacing:"0.1em",fontFamily:"system-ui,sans-serif"}}>
        SAMPLE WEBSITE — Built by Matt Michels Web Design · (313) 806-4952
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
        .pier-heading { font-family: 'Playfair Display', Georgia, serif; }
        @keyframes pier-glow { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes pier-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .pier-gold-shimmer {
          background: linear-gradient(90deg, ${AMBER_TEXT} 0%, #fef3c7 40%, ${AMBER_TEXT} 60%, #b45309 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pier-shimmer 4s linear infinite;
        }
        .pier-menu-tab { transition: all 0.2s ease; }
        .pier-menu-tab.active { border-bottom-color: ${AMBER_LIGHT}; color: ${AMBER_TEXT}; }
        .pier-menu-tab:not(.active) { border-bottom-color: transparent; color: #9c8a78; }
        .pier-menu-tab:hover:not(.active) { color: #e2d8cc; }
      `}</style>

      <Helmet>
        <title>Restaurant Website Demo | M2 Web Design Detroit</title>
        <meta
          name="description"
          content="See how a waterfront restaurant website looks when built by M2 Web Design. Professional dining site for Metro Detroit restaurants."
        />
        <link rel="canonical" href="https://www.mattmichelstraining.com/demo-restaurant" />
        <meta property="og:title" content="Restaurant Website Demo | M2 Web Design Detroit" />
        <meta
          property="og:description"
          content="Professional restaurant website mockup by M2 Web Design. Menu showcase, event booking, and online reservations."
        />
        <meta property="og:url" content="https://www.mattmichelstraining.com/demo-restaurant" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Restaurant Website Demo",
            description: "Demo restaurant website built by M2 Web Design for Metro Detroit dining.",
            url: "https://www.mattmichelstraining.com/demo-restaurant",
            provider: {
              "@type": "ProfessionalService",
              name: "M2 Web Design",
              url: "https://www.mattmichelstraining.com/detroit-web-design",
            },
          })}
        </script>
      </Helmet>

      {/* Demo Badge */}
      <div
        className="fixed top-4 right-4 z-[60] hidden lg:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide"
        style={{ background: AMBER, color: "#fef3c7", fontFamily: "system-ui,sans-serif" }}
      >
        <span>REDESIGN CONCEPT</span>
        <span className="opacity-60">·</span>
        <Link to="/detroit-web-design" className="underline underline-offset-2">
          Matt Michels Web Design
        </Link>
        <span className="opacity-60">·</span>
        <a href="tel:3138064952">313.806.4952</a>
      </div>

      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-4 transition-transform duration-300"
        style={{
          top: 27,
          transform: headerVisible ? "translateY(0)" : "translateY(-150%)",
          background: "rgba(26,15,7,.96)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(146,64,14,.3)`,
        }}
      >
        <span className="pier-heading text-base font-bold tracking-wide" style={{ color: AMBER_TEXT }}>
          {BRAND}
        </span>
        <div className="flex items-center gap-3">
          <a
            href="#reservations"
            className="hidden md:inline-block text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{ background: "rgba(146,64,14,.3)", color: AMBER_TEXT, border: `1px solid rgba(180,83,9,.4)`, fontFamily: "system-ui,sans-serif" }}
          >
            Reserve a Table
          </a>
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full"
            style={{ background: AMBER, color: "#fef3c7", fontFamily: "system-ui,sans-serif" }}
          >
            <Phone size={12} /> {PHONE}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "95vh", paddingTop: "4rem" }}>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Waterfront dining at Pier 47" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(26,15,7,.55) 0%, rgba(26,15,7,.75) 60%, rgba(26,15,7,.97) 100%)" }}
          />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Location tag */}
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-8 px-4 py-2 rounded-full"
            style={{ background: "rgba(146,64,14,.25)", color: AMBER_TEXT, border: `1px solid rgba(180,83,9,.35)`, fontFamily: "system-ui,sans-serif" }}
          >
            <MapPin size={12} /> Waterfront Dining · East Detroit
          </div>

          <h1 className="pier-heading text-5xl md:text-8xl font-black tracking-tight leading-[1.05] mb-5">
            <span className="pier-gold-shimmer">{BRAND}</span>
          </h1>

          <p className="text-base md:text-lg mb-3" style={{ color: "#c4b19e", fontFamily: "system-ui,sans-serif" }}>
            Fresh catches. Craft cocktails. Live music Thursday–Saturday.
          </p>
          <p className="text-sm mb-10" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>
            Open Mon–Thu 11am–10pm &nbsp;·&nbsp; Fri–Sat 11am–12am &nbsp;·&nbsp; Sun Brunch 10am–9pm
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#reservations"
              className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-full transition-transform hover:scale-105"
              style={{ background: AMBER, color: "#fef3c7", boxShadow: "0 0 30px rgba(146,64,14,.5)", fontFamily: "system-ui,sans-serif" }}
            >
              <Calendar size={18} /> Reserve a Table
            </a>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,.07)", color: "#e2d8cc", border: "1px solid rgba(255,255,255,.12)", fontFamily: "system-ui,sans-serif" }}
            >
              View Menu <ChevronDown size={16} />
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" style={{ animation: "pier-glow 2s ease-in-out infinite" }}>
          <ChevronDown size={24} style={{ color: `rgba(251,191,36,.5)` }} />
        </div>
      </section>

      {/* Features strip */}
      <RevealSection
        className="py-10 px-6"
        style={{ background: "#291407", borderTop: `1px solid rgba(146,64,14,.3)`, borderBottom: `1px solid rgba(146,64,14,.3)` }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="text-center">
              <f.Icon size={20} className="mx-auto mb-2" style={{ color: AMBER_LIGHT }} />
              <div className="pier-heading text-base font-bold mb-1" style={{ color: "#fef3c7" }}>{f.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Menu */}
      <RevealSection id="menu" className="py-20 px-6" style={{ background: "#1a0f07" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[.25em] mb-2" style={{ color: AMBER_LIGHT, fontFamily: "system-ui,sans-serif" }}>Pier 47</p>
            <h2 className="pier-heading text-4xl md:text-5xl font-bold text-white">Our Menu</h2>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-b mb-8 overflow-x-auto" style={{ borderColor: "rgba(146,64,14,.3)" }}>
            {menuCategories.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setActiveMenu(i)}
                className={`pier-menu-tab flex-shrink-0 px-5 py-3 text-sm font-semibold border-b-2 -mb-px${i === activeMenu ? " active" : ""}`}
                style={{ fontFamily: "system-ui,sans-serif", background: "transparent" }}
              >
                {cat.name}
                {cat.note && (
                  <span className="ml-2 text-[10px] opacity-70" style={{ color: AMBER_LIGHT }}>
                    {cat.note}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Menu items */}
          <div className="space-y-0 divide-y" style={{ borderColor: "rgba(146,64,14,.15)" }}>
            {menuCategories[activeMenu].items.map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-4 py-5">
                <div>
                  <h3 className="pier-heading text-lg font-bold text-white mb-0.5">{item.name}</h3>
                  <p className="text-sm" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>
                    {item.desc}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-sm font-bold mt-1"
                  style={{ color: AMBER_TEXT, fontFamily: "system-ui,sans-serif" }}
                >
                  {item.price}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs mt-8 text-center" style={{ color: "#64524a", fontFamily: "system-ui,sans-serif" }}>
            Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may increase your risk of foodborne illness.
          </p>
        </div>
      </RevealSection>

      {/* Happy Hour callout */}
      <RevealSection
        className="py-14 px-6 text-center"
        style={{
          background: `linear-gradient(135deg, #291407 0%, #3d1a08 50%, #291407 100%)`,
          borderTop: `1px solid rgba(146,64,14,.3)`,
          borderBottom: `1px solid rgba(146,64,14,.3)`,
        }}
      >
        <div className="max-w-2xl mx-auto">
          <Clock size={28} className="mx-auto mb-4" style={{ color: AMBER_LIGHT }} />
          <h2 className="pier-heading text-3xl md:text-4xl font-bold text-white mb-3">Happy Hour</h2>
          <p className="text-xl font-bold mb-2" style={{ color: AMBER_TEXT, fontFamily: "system-ui,sans-serif" }}>Monday – Friday &nbsp; 3pm – 6pm</p>
          <p className="text-sm" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>
            Discounted drinks, half-price appetizers, and the best seat in the house. At the bar only.
          </p>
        </div>
      </RevealSection>

      {/* Events / Private Dining */}
      <RevealSection className="py-20 px-6" style={{ background: "#1a0f07" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-[.2em] mb-2" style={{ color: AMBER_LIGHT, fontFamily: "system-ui,sans-serif" }}>Events & Private Dining</p>
              <h2 className="pier-heading text-3xl md:text-4xl font-bold text-white mb-5">
                Host Your Next Event<br />at Pier 47
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>
                Our private dining rooms accommodate up to 60 guests — perfect for corporate dinners, milestone celebrations,
                rehearsal dinners, and social gatherings. Custom menus, AV capabilities, and dedicated staff.
              </p>
              <ul className="space-y-2 mb-8" style={{ fontFamily: "system-ui,sans-serif" }}>
                {[
                  "Private rooms up to 60 guests",
                  "Custom food & drink packages",
                  "Live music add-on available",
                  "Catering for off-site events",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#c4b19e" }}>
                    <CheckCircle size={14} style={{ color: AMBER_LIGHT }} /> {item}
                  </li>
                ))}
              </ul>
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-opacity hover:opacity-90"
                style={{ background: AMBER, color: "#fef3c7" }}
              >
                <Phone size={14} /> Call to Book an Event
              </a>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid rgba(146,64,14,.3)`, aspectRatio: "4/3" }}
            >
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"
                alt="Private dining room"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="py-16 px-6" style={{ background: "#291407" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="pier-heading text-3xl font-bold text-center text-white mb-10">What Our Guests Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.attr}
                className="rounded-2xl p-6"
                style={{ background: "#1a0f07", border: `1px solid rgba(146,64,14,.25)` }}
              >
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={AMBER_LIGHT} color={AMBER_LIGHT} />
                  ))}
                </div>
                <p className="italic text-sm mb-3" style={{ color: "#c4b19e", fontFamily: "system-ui,sans-serif" }}>
                  "{t.text}"
                </p>
                <p className="text-xs" style={{ color: "#64524a", fontFamily: "system-ui,sans-serif" }}>
                  {t.attr}
                </p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Hours & Location */}
      <RevealSection className="py-16 px-6" style={{ background: "#1a0f07" }}>
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="pier-heading text-2xl font-bold text-white mb-6">Hours</h2>
              <div className="space-y-3">
                {hours.map((h) => (
                  <div key={h.day} className="flex justify-between items-center py-2" style={{ borderBottom: `1px solid rgba(146,64,14,.2)` }}>
                    <span className="text-sm font-semibold" style={{ color: "#c4b19e", fontFamily: "system-ui,sans-serif" }}>{h.day}</span>
                    <span className="text-sm" style={{ color: AMBER_TEXT, fontFamily: "system-ui,sans-serif" }}>{h.time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(146,64,14,.1)", border: `1px solid rgba(146,64,14,.2)` }}>
                <Music size={18} className="mt-0.5 flex-shrink-0" style={{ color: AMBER_LIGHT }} />
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: "system-ui,sans-serif" }}>Live Music: Thu–Sat</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>Local artists, no cover charge</p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="pier-heading text-2xl font-bold text-white mb-6">Find Us</h2>
              <div className="flex items-start gap-3 mb-4">
                <MapPin size={18} className="mt-0.5 flex-shrink-0" style={{ color: AMBER_LIGHT }} />
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: "system-ui,sans-serif" }}>Waterfront Dining, East Detroit</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>On the water, with views to match the food</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="mt-0.5 flex-shrink-0" style={{ color: AMBER_LIGHT }} />
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: "system-ui,sans-serif" }}>{PHONE}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9c8a78", fontFamily: "system-ui,sans-serif" }}>Reservations, events, and catering inquiries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Reservation / Contact Form */}
      <footer id="reservations" className="px-6 py-16" style={{ background: "#100904", color: "#94a3b8" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <p className="text-xs uppercase tracking-[.2em] mb-2" style={{ color: AMBER_LIGHT, fontFamily: "system-ui,sans-serif" }}>Reservations & Events</p>
            <h2 className="pier-heading text-3xl md:text-4xl font-bold text-white mb-4">Reserve Your Table</h2>
            <p className="text-sm mb-6" style={{ color: "#64524a", fontFamily: "system-ui,sans-serif" }}>
              Tell us about your reservation or event and we'll be in touch to confirm.
            </p>
            {sent ? (
              <p className="text-lg" style={{ color: "#22c55e", fontFamily: "system-ui,sans-serif" }}>
                ✅ Request received! We'll call to confirm your reservation.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                className="space-y-4"
              >
                {[
                  { name: "name" as const, placeholder: "Your Name", type: "text" },
                  { name: "phone" as const, placeholder: "Phone Number", type: "tel" },
                  { name: "email" as const, placeholder: "Email Address", type: "email" },
                ].map((f) => (
                  <input
                    key={f.name}
                    required
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.name]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full rounded-xl px-4 py-3 text-base outline-none"
                    style={{
                      background: "#1a0f07",
                      border: `1px solid rgba(146,64,14,.35)`,
                      color: "#e2d8cc",
                      fontFamily: "system-ui,sans-serif",
                    }}
                  />
                ))}
                <textarea
                  required
                  placeholder="Party size, date, time, or event details"
                  value={form.details}
                  onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none"
                  style={{
                    background: "#1a0f07",
                    border: `1px solid rgba(146,64,14,.35)`,
                    color: "#e2d8cc",
                    fontFamily: "system-ui,sans-serif",
                  }}
                />
                <button
                  type="submit"
                  className="w-full font-bold text-base py-3 rounded-xl transition-opacity hover:opacity-90"
                  style={{ background: AMBER, color: "#fef3c7", fontFamily: "system-ui,sans-serif" }}
                >
                  Send Reservation Request
                </button>
              </form>
            )}
          </div>
          <div className="flex flex-col justify-center gap-6">
            <div>
              <h3 className="pier-heading text-xl font-bold text-white mb-4">What We Offer</h3>
              <ul className="space-y-2 text-sm" style={{ fontFamily: "system-ui,sans-serif" }}>
                {[
                  "Waterfront dining, east side Detroit",
                  "Live music Thu–Sat nights",
                  "Happy hour Mon–Fri 3–6pm",
                  "Private events up to 60 guests",
                  "Full-service catering",
                  "Brunch Sat & Sun",
                ].map((s) => (
                  <li key={s} className="flex items-center gap-2" style={{ color: "#c4b19e" }}>
                    <CheckCircle size={14} style={{ color: AMBER_LIGHT }} /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={`tel:${PHONE.replace(/\D/g, "")}`}
              className="inline-flex items-center justify-center gap-2 font-bold py-3 rounded-xl"
              style={{ background: AMBER, color: "#fef3c7", fontFamily: "system-ui,sans-serif" }}
            >
              <Phone size={16} /> {PHONE}
            </a>
          </div>
        </div>

        <div
          className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-10 mt-10"
          style={{ borderTop: "1px solid rgba(146,64,14,.2)" }}
        >
          <p className="text-xs" style={{ color: "#4a3530", fontFamily: "system-ui,sans-serif" }}>
            © 2026 {BRAND}. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,.12)", fontFamily: "system-ui,sans-serif" }}>
            Site by{" "}
            <Link
              to="/detroit-web-design"
              className="underline underline-offset-2 hover:text-white transition-colors"
            >
              Matt Michels Web Design
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default RestaurantMockup;
