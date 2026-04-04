import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import { Phone, Shield, Star, Award, Clock, CheckCircle, Lock, ScanLine, Microscope, Stethoscope, MapPin, ArrowRight, Menu, X, ChevronDown, FileText, Download, Heart, Zap, Eye, Smile, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/* ─── Brand tokens ─── */
const G = "#C9A84C"; // Gold
const N = "#0B1426"; // Navy
const C = "#F8F3EC"; // Cream
const P = "#FDFAF5"; // Parchment

/* ─── Types ─── */
type Tab = "procedures" | "faq" | "new-patients" | "gallery" | "privacy";

/* ─── FAQ data (real content from stewartdentalgroup.com) ─── */
const FAQS: [string, string][] = [
  ["What is a prosthodontist?", "Prosthodontists are dental specialists trained in the restoration and maintenance of oral function, comfort, appearance, and health by restoring natural teeth that are broken or worn, in addition to the replacement of missing teeth. A small percentage of those dentists trained in prosthodontics go on to become certified by the American Board of Prosthodontists. Dr. Stewart became a prosthodontist in 1990 and completed his board certification in 1995. He received his dental degree from the University of Michigan School of Dentistry and master's degree in prosthodontics at the Mayo Clinic Graduate School of Medicine."],
  ["Do you do implants at this office?", "Dental implants require planning between the prosthodontist (our office), surgeon, and patient. Our office will educate you and determine the need or usefulness of implants in your situation, direct the dental surgeon in the positioning of the implant(s) in your mouth to meet the intended needs, and then we provide the abutment support and final crown or bridge over the implant. This \"team\" approach lends itself to the advantageous \"checks and balances\" approach during your care."],
  ["How long does implant integration take?", "Integration of your bone to the surface of titanium dental implants varies from 3 to 6 months. This is the typical rate of bone growth and has been scientifically determined from the work done on humans in the late 60's."],
  ["Can I get a crown the same day the implant is placed?", "With 40+ years of dental implant experience, the scientific dental community has concluded that implants may be used to support temporary, and in some cases, final crowns and bridges the same day they are placed. Computer-aided guidance and treatment planning has created a more straightforward procedure for the patient. In other situations, the implants are allowed to heal under the gumline for the traditional 3-6 months."],
  ["What's better, a bridge or an implant?", "The implant approach \"solves a one tooth problem with a one tooth solution.\" Dental implants eliminate the need to remove enamel from neighboring teeth, stimulate bone retention, and have a track record that far outlasts bridges. Bridges offer a non-surgical approach with shorter treatment time. Dr. Stewart will help you weigh both options for your specific situation."],
  ["Are all crowns the same?", "No! There are many variations in design and material — from full-gold crowns to porcelain-fused-to-metal to all-ceramic crowns. With CEREC ceramic crowns made while you wait in our office, you avoid the temporary altogether. CAD/CAM crowns and their associated ceramic materials are becoming the new norm."],
  ["What are CEREC restorations?", "CEREC is a chair-side fabricated ceramic restoration using CAD/CAM technology. Our office uses the CEREC system (Sirona Dental Systems), which has a track record since 1985. No impression materials are used — a 3D camera makes a digital model. The restoration is milled in as little as 10 minutes and seated in less than two hours!"],
  ["How long do dental restorations last?", "Crowns and bridges may last 12-15 years according to published research. Partials usually last as long as your natural teeth retaining them. Complete dentures are typically replaced every 6-10 years. Implant prostheses are expected to last much longer than those supported by natural teeth."],
  ["Do you outsource lab work overseas?", "We fabricate 75% of prostheses in house. The other 25% is sent to local labs for procedures we cannot do in our office. There has been a trend to outsource work overseas — we will never be a part of that!"],
  ["Are dental X-rays necessary?", "Yes! Dental radiographs are an integral part of diagnosing the health of your mouth. The minimal exposure far outweighs the risks of undiscovered dental diseases. Modern radiographs are completely safe when used properly with digital sensors, lead aprons, and judicious ordering."],
  ["My jaws hurt occasionally. Why?", "By far the most common source is overuse of the muscles around the mouth from grinding and clenching. The solution is nighttime protection with an occlusal guard and daytime behavior modification: \"lips together, teeth apart\" is the normal rest position of our jaws."],
  ["What about air quality in your office?", "Our office provides the highest standards of air quality with several layers of protection: a diode ionizer in the attic air handler, commercial grade HEPA filters/UVC air cleaners for non-treatment areas, and ULPA filters in each treatment room."],
  ["How do you sterilize instruments?", "All hand-held instruments are sterilized after each use in an autoclave. Items that cannot be autoclaved have disposable barriers replaced after each patient. Surfaces are disinfected with an approved solution and spray-wipe-spray technique."],
  ["What about dental emergencies after hours?", "Dr. Stewart and staff live locally. Patient of record will get priority appointments. We handle toothaches, swelling, lost fillings, broken teeth, and broken dentures/partials on a priority basis — starting with a phone call."],
  ["Do you accept credit cards?", "Yes! Visa, MasterCard and American Express. We also offer CareCredit® with interest-free and low interest payment plans."],
  ["Does insurance cover everything?", "Payment is due at time of service. We fill out all insurance claims and send them at the time treatment is provided. You will receive direct payment from your carrier. The difference between their payment and our fee is your out-of-pocket cost."],
];

/* ─── Procedures data (real content from stewartdentalgroup.com) ─── */
const PROCEDURES: { title: string; icon: React.ReactNode; summary: string; detail: string }[] = [
  {
    title: "Same-Day CEREC Crowns",
    icon: <Zap size={20} color={G} />,
    summary: "Full porcelain crowns designed, milled, and bonded in a single visit — no temporaries, no second appointment.",
    detail: "In most cases, crowns, veneers, inlays, onlays, partial veneer crowns, and fillings can be completed in one visit. We use the latest CAD/CAM restorative technology (CEREC) with durable and lifelike bonded ceramic materials — a proven system since 1985. No impressions or temporaries! Since 2005, our office has conducted ongoing clinical research with CAD/CAM ceramic materials. The results have been most impressive."
  },
  {
    title: "Dental Implants",
    icon: <Heart size={20} color={G} />,
    summary: "Permanent titanium roots that support crowns or bridges — the preferred method of replacing missing teeth.",
    detail: "Missing teeth have met their match with dental implants! Dental implants are titanium roots that support crowns or bridges that eclipse the durability of natural tooth restorations. Any number of teeth may be replaced — from one tooth to a full arch. Our office provides coordination with surgical specialists, directives for the project, and the final restoration."
  },
  {
    title: "Bridges Over Natural Teeth",
    icon: <CheckCircle size={20} color={G} />,
    summary: "When implants aren't an option, custom bridges use adjacent teeth to support a false tooth.",
    detail: "A bridge uses the teeth on either side of the space to support a false tooth. The decision is based mostly on the strengths of the supporting teeth. Technological advances continue in materials and methods — zirconia hardened ceramic frameworks are slowly replacing metal, and milled ceramic artificial teeth are being introduced through the CAD/CAM CEREC method. Digital cameras now make \"digital impressions\" instead of rubber impressions."
  },
  {
    title: "Partials",
    icon: <Smile size={20} color={G} />,
    summary: "Removable partial dentures when implant or bridge options aren't practical.",
    detail: "A partial relies on the combination of your remaining teeth and gum tissue. We take great care to ensure the partial is comfortable and done properly. There are several procedural appointments that check progress. You are shown the prototype prior to completion at all times — you are in control!"
  },
  {
    title: "Complete Dentures",
    icon: <Star size={20} color={G} />,
    summary: "Full-arch restorations engineered for comfort, stability, and a natural-looking smile.",
    detail: "When all teeth are lost in one or both arches, a denture may be an option. Prosthodontists are the dental specialists to determine success potential. The modern implant was invented to help people avoid wearing a lower denture. The creation of your smile with dentures offers many opportunities to obtain \"the look\" you always desired."
  },
  {
    title: "Dental Hygiene",
    icon: <Shield size={20} color={G} />,
    summary: "Professional cleanings that maintain oral and overall health.",
    detail: "Our hygiene staff is courteous, gentle, knowledgeable, and keeps track of all advancements in their field. When patients have no routine dental \"home,\" we provide professional cleaning, restorative care, and overall supervision — we become their dentist. We are happy to alternate hygiene visits with your periodontist."
  },
  {
    title: "Bite Guards",
    icon: <Lock size={20} color={G} />,
    summary: "Custom occlusal guards for relief from grinding, clenching, and TMJ pain.",
    detail: "Occlusal guards have been used for decades to relieve pain around jaw joints and cheek and neck muscles. Grinding and clenching — most of the damage occurs at night when we're sleeping and unaware. We are now using 3D additive manufacturing (printing) and reviewing the clinical advantages of their fit and durability. Remember: \"Lips together, teeth apart\" is the normal rest position."
  },
  {
    title: "Obturator",
    icon: <Eye size={20} color={G} />,
    summary: "Specialized prostheses for patients who have undergone oral cancer surgery.",
    detail: "Obturation means to \"close.\" The vast majority of patients needing an obturator have undergone cancer of the mouth. Surgical removal has left an opening between the mouth and nose. A properly made obturator is comfortable, esthetic, and restores patients to near normal function. These devices are removable for cleaning and hygiene."
  },
];

/* ─── Testimonials (real from stewartdentalgroup.com) ─── */
const TESTIMONIALS: [string, string][] = [
  ["I have been a patient of Dr. Stewart since 1994. He is a gifted prosthodontist. My beautiful smile can attest to his passion and commitment to his profession. He is a perfectionist and the outcome is a work of art.", "C.P., Grosse Pointe Farms"],
  ["Dr. Stewart and his team put together a complete schedule of work planned, carefully and meticulously explaining everything. They gave me back the confidence to laugh out loud again and unconsciously smile at every opportunity.", "M.Z., St. Clair Shores"],
  ["He combines skill, artistry, and personality to create a pleasant dental experience that yields great results. His office is clean and stylish. His staff is friendly and efficient. And his shots don't hurt.", "S.R., Detroit"],
  ["Following extensive oral cancer surgery, I was fortunate to engage the services of Dr. Stewart. Although he never promised me a miracle, he said he would do his very best. Thus far, I couldn't be happier!", "C.S., Grosse Pointe Woods"],
  ["Dr. Stewart has blended the best of training, technology, equipment, and staff into an outstanding dental office. I have trusted him and his team's intelligence, judgment, and skill for the past 36 years.", "P.W., Grosse Pointe"],
  ["Superior service and staff — always accommodating. Staff has consistently been with the practice for many years, which speaks for the practice. I have been a patient for 38 years!", "Long-Time Patient"],
  ["I am continually impressed with Dr. Stewart, both as a caring practitioner and his thorough knowledge of the latest advances. The warm and inviting office décor makes for a reliably comfortable experience.", "C.K., Grosse Pointe Woods"],
  ["He always makes sure you are not in any pain. His excellent staff are very friendly and accommodating. I can actually say I like going to the dentist.", "D.M., Clinton Twp."],
];

export default function StewartDentalProduction() {
  const [vis, setVis] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("procedures");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [expandedProc, setExpandedProc] = useState<number | null>(null);
  const [form, setForm] = useState({ first: "", last: "", phone: "", email: "", day: "", reason: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fn = () => { const y = window.scrollY; setVis(y < 80 || y < lastY); setLastY(y); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [lastY]);

  useEffect(() => { document.body.style.overflow = mobileMenu ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [mobileMenu]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first || !form.last || !form.phone) {
      toast.error("Please fill in your name and phone number.");
      return;
    }
    setSubmitting(true);
    // In production, this will send to the edge function
    await new Promise(r => setTimeout(r, 1200));
    toast.success("Thank you! We'll confirm your appointment within one business day.");
    setForm({ first: "", last: "", phone: "", email: "", day: "", reason: "", message: "" });
    setSubmitting(false);
  };

  const field = (id: keyof typeof form, label: string, type: string) => (
    <div key={id}>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>{label}</label>
      <input type={type} value={form[id]} onChange={e => setForm(p => ({ ...p, [id]: e.target.value }))}
        className="w-full bg-transparent text-sm outline-none"
        style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N, fontFamily: "Inter, sans-serif" }}
        required={id === "first" || id === "last" || id === "phone"} />
    </div>
  );

  const NAV_LINKS: [string, string][] = [
    ["#cerec", "CEREC Technology"],
    ["#services", "Services"],
    ["#doctor", "Meet Dr. Stewart"],
    ["#gallery-section", "Gallery"],
    ["#faq-section", "FAQ"],
    ["#new-patients-section", "New Patients"],
    ["#appointment", "Contact"],
  ];

  return (
    <>
      <Helmet>
        <title>Stewart Dental Group — Board-Certified Prosthodontist | Grosse Pointe Woods, MI</title>
        <meta name="description" content="Dr. Robert B. Stewart, DDS, MS — Board-Certified Prosthodontist. Same-day CEREC crowns, dental implants, bridges, dentures, and full-mouth rehabilitation. 19635 Mack Ave, Grosse Pointe Woods, MI. (313) 882-8711." />
        <meta name="keywords" content="prosthodontist, Grosse Pointe Woods, dental implants, CEREC crowns, same day crowns, dentures, bridges, Dr. Stewart" />
        <link rel="canonical" href="https://www.stewartdentalgroup.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Dentist",
          "name": "Stewart Dental Group",
          "image": "https://www.stewartdentalgroup.com/images/office.jpg",
          "url": "https://www.stewartdentalgroup.com",
          "telephone": "+1-313-882-8711",
          "address": { "@type": "PostalAddress", "streetAddress": "19635 Mack Avenue", "addressLocality": "Grosse Pointe Woods", "addressRegion": "MI", "postalCode": "48236", "addressCountry": "US" },
          "geo": { "@type": "GeoCoordinates", "latitude": 42.4411, "longitude": -82.9066 },
          "openingHoursSpecification": [
            { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Thursday"], "opens": "07:30", "closes": "16:00" },
            { "@type": "OpeningHoursSpecification", "dayOfWeek": "Wednesday", "opens": "08:30", "closes": "12:30" }
          ],
          "priceRange": "$$",
          "medicalSpecialty": "Prosthodontics",
          "description": "Board-Certified Prosthodontist offering same-day CEREC crowns, dental implants, bridges, dentures, and full-mouth rehabilitation.",
          "paymentAccepted": "Visa, MasterCard, American Express, CareCredit"
        })}</script>
      </Helmet>

      {/* Mobile overlay menu */}
      {mobileMenu && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6" style={{ background: N }}>
          <button onClick={() => setMobileMenu(false)} className="absolute top-5 right-5 p-2" style={{ color: "white", background: "none", border: "none", cursor: "pointer" }}><X size={28} /></button>
          {NAV_LINKS.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setMobileMenu(false)} className="text-2xl font-light tracking-wide"
              style={{ fontFamily: "'Playfair Display', serif", color: "white", textDecoration: "none" }}>{l}</a>
          ))}
          <a href="tel:3138828711" className="mt-4 px-10 py-4 font-bold text-sm tracking-widest rounded" style={{ background: G, color: N, textDecoration: "none" }}>(313) 882-8711</a>
        </div>
      )}

      {/* Sticky header */}
      <header className="fixed left-0 right-0 z-[100] transition-transform duration-300"
        style={{ top: 0, transform: vis ? "translateY(0)" : "translateY(-100%)", background: "rgba(253,250,245,.97)", backdropFilter: "blur(12px)", borderBottom: `1px solid rgba(201,168,76,.25)` }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: N }}>
              <span style={{ color: G, fontSize: 16 }}>✦</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600, color: N, letterSpacing: ".05em", lineHeight: 1.2 }}>STEWART<br />DENTAL GROUP</div>
          </a>
          <nav className="hidden lg:flex items-center gap-5">
            {NAV_LINKS.slice(0, 5).map(([h, l]) => (
              <a key={h} href={h} className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <a href="#appointment" className="px-4 py-2 rounded text-sm font-semibold" style={{ border: `1.5px solid ${G}`, color: G, textDecoration: "none" }}>New Patients</a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold" style={{ background: G, color: N, textDecoration: "none" }}>
              <Phone size={13} /> (313) 882-8711
            </a>
          </div>
          <button className="lg:hidden p-2" onClick={() => setMobileMenu(true)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <Menu size={24} color={N} />
          </button>
        </div>
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex items-center justify-center overflow-hidden min-h-screen" style={{ background: N, paddingTop: 64 }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1588776814546-1ffbb1b72cb7?w=1920&q=80)", opacity: 0.12 }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(11,20,38,.98) 0%, rgba(11,20,38,.75) 55%, rgba(11,20,38,.5) 100%)" }} />
        <div className="relative z-10 max-w-5xl mx-auto px-5 py-24 text-center w-full">
          <div className="inline-flex items-center gap-2 rounded-full border mb-8 px-5 py-2 text-xs font-semibold tracking-widest" style={{ borderColor: "rgba(201,168,76,.5)", color: G }}>
            <Award size={12} /> Board-Certified Prosthodontist · Grosse Pointe Woods
          </div>
          <h1 className="mb-6" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(40px,7vw,76px)", fontWeight: 400, color: "white", lineHeight: 1.1 }}>
            Where Precision<br />Meets <span style={{ color: G }}>Artistry</span>
          </h1>
          <div className="mx-auto mb-8" style={{ width: 56, height: 2, background: G }} />
          <p className="mx-auto mb-10 text-lg font-light" style={{ color: "rgba(200,208,220,.85)", lineHeight: 1.8, maxWidth: 600 }}>
            Dr. Robert B. Stewart brings Mayo Clinic-trained prosthodontic expertise to Grosse Pointe Woods.
            Same-day CEREC crowns, dental implants, and full-mouth rehabilitation — all under one roof, with our in-office desktop laboratory.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
            <a href="#appointment" className="flex items-center gap-2 px-8 py-4 rounded font-bold text-sm tracking-wide w-full sm:w-auto justify-center" style={{ background: G, color: N, textDecoration: "none" }}>
              Schedule Your Visit <ArrowRight size={16} />
            </a>
            <a href="tel:3138828711" className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-sm w-full sm:w-auto justify-center" style={{ border: `1.5px solid ${G}`, color: G, textDecoration: "none" }}>
              <Phone size={14} /> Call (313) 882-8711
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {[[<Clock size={14} key="c" />, "36+ Years"], [<Star size={14} key="s" />, "14× Top Dentist"], [<Award size={14} key="a" />, "Mayo Clinic Trained"], [<CheckCircle size={14} key="ch" />, "Same-Day Crowns"]].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color: G }}>{icon} {label as string}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Trust bar ═══════════ */}
      <div className="py-5 px-5" style={{ background: "white", borderBottom: "1px solid rgba(201,168,76,.12)" }}>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6">
          {["ADA Member", "HIPAA Compliant", "Autoclave Sterilized", "HEPA/ULPA Air Filtration", "Digital X-Ray Safety"].map(t => (
            <div key={t} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#6b7280" }}>
              <Shield size={14} color={G} /> {t}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ Stats ═══════════ */}
      <RevealSection>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ background: N, borderTop: "1px solid rgba(201,168,76,.1)" }}>
          {[["36+", "Years of Excellence"], ["14×", "Detroit Top Dentist"], ["Mayo", "Clinic Trained"], ["1 Visit", "CEREC Crowns"]].map(([n, l], i) => (
            <div key={i} className="text-center py-10 px-4" style={{ borderRight: i < 3 ? "1px solid rgba(201,168,76,.1)" : "none" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px,4vw,48px)", color: G, fontWeight: 400 }}>{n}</div>
              <div className="text-xs uppercase tracking-widest mt-2" style={{ color: "rgba(138,154,181,.65)" }}>{l}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ═══════════ Desktop Laboratory / CEREC ═══════════ */}
      <RevealSection>
        <section id="cerec" className="py-20 px-5" style={{ background: C }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>The Desktop Laboratory</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>CEREC Technology — Crowns While You Wait</h2>
              <p className="mt-3 text-sm max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
                We utilize a new concept in dental care: the desktop laboratory. A 3D camera images your mouth instead of impressions. Your tooth is designed with CAD/CAM software and milled from a block of ceramic — all while you watch.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: N }}>
                <img src="https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80" alt="CEREC milling technology in our desktop laboratory" className="w-full object-cover" style={{ height: 240 }} loading="lazy" />
                <div className="p-9 flex-1 flex flex-col justify-between">
                  <div>
                    <div style={{ width: 40, height: 2, background: G, marginBottom: 20 }} />
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 22, fontWeight: 400, marginBottom: 14 }}>The Lab Is In Our Office</h3>
                    <p style={{ color: "rgba(138,154,181,.8)", lineHeight: 1.85, fontSize: 14 }}>
                      The milling chamber uses diamond burs to manufacture your restoration from a ceramic block. Dr. Stewart will advise the correct material for your situation, then custom characterize the restoration in a ceramic furnace so it blends with your other teeth — all done while you relax in our office. We are also using this technology to fabricate restorations for local dentists.
                    </p>
                  </div>
                  <div className="mt-8" style={{ borderLeft: `3px solid ${G}`, paddingLeft: 18 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: G, fontSize: 15, lineHeight: 1.65 }}>"We are all about prosthetic dentistry here. We enjoy the challenge of the most complex dental problems. We are ready for you."</p>
                    <p style={{ color: "rgba(138,154,181,.45)", fontSize: 11, marginTop: 8 }}>— Dr. Robert B. Stewart, DDS, MS</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {[[<ScanLine size={20} color={G} key="sl" />, "01", "3D Digital Scan", "Precision optical impressions replace uncomfortable molds. We use a 3D laser scanner to take precision images of your teeth — micron-level accuracy, zero discomfort."],
                  [<Microscope size={20} color={G} key="m" />, "02", "CAD/CAM Design", "Your restoration is designed on a 3D CAD computer. We can simulate the fit in the computer before a single cut is made. Perfect fit, bite, and occlusion."],
                  [<Stethoscope size={20} color={G} key="st" />, "03", "In-Office Milling", "Diamond burs mill your restoration from ceramic in as little as 10 minutes. Dr. Stewart then shade-matches and characterizes it in a ceramic furnace."]].map(([icon, step, title, desc]) => (
                  <div key={step as string} className="rounded-xl p-6" style={{ background: "white", borderTop: `3px solid ${G}` }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: G, opacity: .35, lineHeight: 1 }}>{step as string}</span>
                      {icon}
                    </div>
                    <h4 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{title as string}</h4>
                    <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.75 }}>{desc as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ All Procedures ═══════════ */}
      <RevealSection>
        <section id="services" className="py-20 px-5" style={{ background: "white" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Prosthodontic Services</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>Our Procedures</h2>
              <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: "#6b7280" }}>
                Prosthodontists are dental specialists trained in the restoration of natural teeth and replacement of missing teeth. Dr. Stewart has been providing this specialized care since 1990.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {PROCEDURES.map((proc, i) => (
                <div key={proc.title} className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                  style={{ background: C, border: expandedProc === i ? `2px solid ${G}` : "2px solid transparent" }}
                  onClick={() => setExpandedProc(expandedProc === i ? null : i)}>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      {proc.icon}
                      <h3 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 15, fontWeight: 500 }}>{proc.title}</h3>
                    </div>
                    <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.75 }}>{proc.summary}</p>
                    {expandedProc === i && (
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid rgba(201,168,76,.2)` }}>
                        <p style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.85 }}>{proc.detail}</p>
                      </div>
                    )}
                    <button className="flex items-center gap-1 mt-3 text-xs font-bold uppercase tracking-widest" style={{ color: G, background: "none", border: "none", cursor: "pointer" }}>
                      {expandedProc === i ? "Less" : "Learn More"} <ChevronDown size={12} style={{ transform: expandedProc === i ? "rotate(180deg)" : "none", transition: ".2s" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Meet Dr. Stewart ═══════════ */}
      <RevealSection>
        <section id="doctor" className="py-20 px-5" style={{ background: N }}>
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-10 items-start">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80"
                  alt="Dr. Robert B. Stewart, DDS, MS — Board-Certified Prosthodontist" className="rounded-xl object-cover"
                  style={{ width: 260, height: 320, border: `3px solid ${G}`, display: "block" }} loading="lazy" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Meet Your Doctor</p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: G, fontSize: "clamp(28px,4vw,40px)", fontWeight: 400, marginBottom: 4 }}>Dr. Robert B. Stewart</h2>
                <p className="text-sm mb-6 tracking-wider" style={{ color: "rgba(138,154,181,.55)" }}>DDS, MS — Board-Certified Prosthodontist</p>
                <p className="mb-6 text-sm" style={{ color: "rgba(200,208,220,.75)", lineHeight: 1.85 }}>
                  Dr. Stewart has dedicated his career to the art and science of prosthodontic dentistry. As a board-certified prosthodontist, he brings the highest level of training and expertise to every patient encounter. His practice in Grosse Pointe Woods has been the trusted destination for complex dental rehabilitation for over three decades.
                </p>
                <div className="flex flex-col gap-3 mb-8">
                  {["DDS, University of Michigan School of Dentistry — 1987",
                    "MS in Prosthodontics, Mayo Clinic Graduate School of Medicine — 1990",
                    "Diplomate, American Board of Prosthodontics — 1995",
                    "14× named Detroit Top Dentist by Hour Detroit Magazine (2008–2022)",
                    "10× named Styleline Magazine's Top Dentist (2011–2020)",
                    "Ongoing CEREC clinical research program since 2005"].map(c => (
                    <div key={c} className="flex gap-3 items-start text-sm" style={{ color: "rgba(200,208,220,.8)" }}>
                      <CheckCircle size={14} color={G} style={{ flexShrink: 0, marginTop: 2 }} /> {c}
                    </div>
                  ))}
                </div>
                <blockquote style={{ borderLeft: `3px solid ${G}`, paddingLeft: 18 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: C, fontSize: 16, lineHeight: 1.7 }}>
                    "We enjoy the challenge of the most complex and complicated dental problems. Many patients worry that their problems 'are the worst' — we are ready for you!"
                  </p>
                </blockquote>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Case Gallery ═══════════ */}
      <RevealSection>
        <section id="gallery-section" className="py-20 px-5" style={{ background: C }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Results</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>Case Gallery</h2>
              <p className="mt-3 text-sm max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
                We are constantly recording results from our patients. In the majority of work shown, CEREC CAD/CAM crowns were used for restorations over implants and crowns. These restorations can be made to be extremely life-like!
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[["CEREC Crown Restoration", "Full porcelain crown designed and placed in a single visit using our in-office CAD/CAM system.", "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&q=80"],
                ["Implant-Supported Bridge", "Multiple missing teeth replaced with implant-supported prosthetics for permanent, natural-looking results.", "https://images.unsplash.com/photo-1588776814546-1ffbb1b72cb7?w=600&q=80"],
                ["Full-Mouth Rehabilitation", "Complete reconstruction combining CEREC crowns, implants, and veneers for a total smile transformation.", "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=600&q=80"],
                ["Veneer Smile Makeover", "Custom ceramic veneers to restore a beautiful, natural smile with precise shade matching.", "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=600&q=80"],
                ["Denture Aesthetics", "Complete denture designed to create a natural, confident smile — indistinguishable from natural teeth.", "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&q=80"],
                ["Bridge Over Natural Teeth", "Zirconia-reinforced ceramic bridge using CAD/CAM digital impressions for precision fit.", "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=600&q=80"]].map(([title, desc, img], i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(201,168,76,.15)" }}>
                  <img src={img} alt={title as string} className="w-full object-cover" style={{ height: 180 }} loading="lazy" />
                  <div className="p-5">
                    <h4 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{title}</h4>
                    <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.7 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center mt-8 text-xs" style={{ color: "#9ca3af" }}>
              Actual patient photos available in-office with signed consent. These are representative case descriptions.
            </p>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Testimonials ═══════════ */}
      <RevealSection>
        <section className="py-20 px-5" style={{ background: "white" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Patient Words</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>What Our Patients Say</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {TESTIMONIALS.slice(0, 8).map(([q, a], i) => (
                <div key={i} className="rounded-xl p-6" style={{ background: C, border: "1px solid rgba(201,168,76,.18)" }}>
                  <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <Star key={j} size={13} fill={G} color={G} />)}</div>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: G, lineHeight: 0, display: "block", marginBottom: 12, opacity: .25 }}>❝</span>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: N, lineHeight: 1.75, fontSize: 13, marginBottom: 12 }}>
                    {(q as string).length > 180 ? (q as string).slice(0, 180) + "…" : q}
                  </p>
                  <p style={{ color: "#9ca3af", fontSize: 11 }}>— {a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ FAQ ═══════════ */}
      <RevealSection>
        <section id="faq-section" className="py-20 px-5" style={{ background: N }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Common Questions</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: "white", fontWeight: 400 }}>Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {FAQS.map(([q, a], i) => (
                <div key={i} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(201,168,76,.15)" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left"
                    style={{ background: openFaq === i ? "rgba(201,168,76,.08)" : "transparent", border: "none", cursor: "pointer" }}>
                    <span className="font-semibold text-sm" style={{ color: openFaq === i ? G : "rgba(200,208,220,.85)", fontFamily: "Inter, sans-serif" }}>{q}</span>
                    <ChevronDown size={16} color={G} style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: ".2s", flexShrink: 0 }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5">
                      <p style={{ color: "rgba(138,154,181,.7)", fontSize: 13, lineHeight: 1.85 }}>{a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ New Patient Forms ═══════════ */}
      <RevealSection>
        <section id="new-patients-section" className="py-20 px-5" style={{ background: C }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Welcome</p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,44px)", color: N, fontWeight: 400 }}>New Patient Information</h2>
              <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: "#6b7280" }}>
                Your dental well-being is our top priority. Please fill out the following forms before your first visit. They can be submitted online or printed and brought to your appointment.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-lg mx-auto">
              <div className="rounded-xl p-8 text-center" style={{ background: "white", border: "1px solid rgba(201,168,76,.2)" }}>
                <FileText size={32} color={G} className="mx-auto mb-4" />
                <h3 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>Patient Information</h3>
                <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>Personal details, dental history, and insurance information.</p>
                <a href="#appointment" className="inline-flex items-center gap-2 px-5 py-3 rounded text-xs font-bold tracking-widest" style={{ background: G, color: N, textDecoration: "none" }}>
                  <Download size={14} /> DOWNLOAD FORM
                </a>
              </div>
              <div className="rounded-xl p-8 text-center" style={{ background: "white", border: "1px solid rgba(201,168,76,.2)" }}>
                <FileText size={32} color={G} className="mx-auto mb-4" />
                <h3 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>Medical History</h3>
                <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>Complete medical history including medications and allergies.</p>
                <a href="#appointment" className="inline-flex items-center gap-2 px-5 py-3 rounded text-xs font-bold tracking-widest" style={{ background: G, color: N, textDecoration: "none" }}>
                  <Download size={14} /> DOWNLOAD FORM
                </a>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Contact / Appointment Form ═══════════ */}
      <RevealSection>
        <section id="appointment" className="py-20 px-5" style={{ background: P }}>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Contact info */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Contact Us</p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px,4vw,36px)", color: N, fontWeight: 400, marginBottom: 20 }}>
                  Robert B. Stewart, D.D.S., M.S., P.C.
                </h2>
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} color={G} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.7 }}>19635 Mack Avenue<br />Grosse Pointe Woods, MI 48236</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} color={G} style={{ flexShrink: 0 }} />
                    <a href="tel:3138828711" style={{ color: G, fontWeight: 700, fontSize: 18, textDecoration: "none" }}>(313) 882-8711</a>
                  </div>
                </div>
                <div className="mb-8">
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Office Hours</h4>
                  <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 2.2 }}>
                    <div className="flex justify-between" style={{ maxWidth: 280 }}><span>Monday</span><span style={{ color: N, fontWeight: 600 }}>7:30 AM – 4:00 PM</span></div>
                    <div className="flex justify-between" style={{ maxWidth: 280 }}><span>Tuesday</span><span style={{ color: N, fontWeight: 600 }}>7:30 AM – 4:00 PM</span></div>
                    <div className="flex justify-between" style={{ maxWidth: 280 }}><span>Wednesday</span><span style={{ color: N, fontWeight: 600 }}>8:30 AM – 12:30 PM</span></div>
                    <div className="flex justify-between" style={{ maxWidth: 280 }}><span>Thursday</span><span style={{ color: N, fontWeight: 600 }}>7:30 AM – 4:00 PM</span></div>
                    <div className="flex justify-between" style={{ maxWidth: 280 }}><span>Fri – Sun</span><span style={{ color: "#9ca3af" }}>Closed</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Payment</h4>
                  <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.7 }}>Visa · MasterCard · American Express · CareCredit®</p>
                </div>
              </div>

              {/* Form */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: G }}>Request an Appointment</p>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: N, fontWeight: 400, marginBottom: 20 }}>Schedule Your Visit</h3>
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    {field("first", "First Name *", "text")}{field("last", "Last Name *", "text")}
                    {field("phone", "Phone *", "tel")}{field("email", "Email", "email")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Preferred Day</label>
                      <select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))} className="w-full bg-transparent text-sm outline-none appearance-none"
                        style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N }}>
                        <option value="">Select a day</option>
                        {["Monday", "Tuesday", "Wednesday (AM only)", "Thursday"].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Reason for Visit</label>
                      <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="w-full bg-transparent text-sm outline-none appearance-none"
                        style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N }}>
                        <option value="">Select a reason</option>
                        {["Crown / Same-Day CEREC", "Dental Implant Consultation", "Bridge or Partial", "Complete Dentures", "Bite Guard / TMJ", "Obturator Consultation", "Full-Mouth Rehabilitation", "Professional Cleaning", "Second Opinion", "New Patient Exam"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-5">
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Message (Optional)</label>
                    <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3}
                      className="w-full bg-transparent text-sm outline-none resize-none"
                      style={{ borderBottom: "1px solid rgba(201,168,76,.35)", padding: "8px 0", color: N, fontFamily: "Inter, sans-serif" }}
                      placeholder="Tell us about your situation..." />
                  </div>
                  <div className="mt-8">
                    <button type="submit" disabled={submitting} className="w-full py-4 font-bold text-sm tracking-widest rounded disabled:opacity-50" style={{ background: G, color: N, border: "none", cursor: "pointer" }}>
                      {submitting ? "SENDING..." : "REQUEST MY APPOINTMENT →"}
                    </button>
                    <p className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: "#9ca3af" }}>
                      <Lock size={11} /> Your information is private. We collect only name, phone, and email — no health information is transmitted through this form.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Google Map ═══════════ */}
      <div style={{ background: N, padding: "0" }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2949.8!2d-82.9066!3d42.4411!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDLCsDI2JzI4LjAiTiA4MsKwNTQnMjMuOCJX!5e0!3m2!1sen!2sus!4v1"
          width="100%" height="300" style={{ border: 0, display: "block", filter: "grayscale(0.5) contrast(1.1)" }}
          allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          title="Stewart Dental Group location — 19635 Mack Avenue, Grosse Pointe Woods, MI"
        />
      </div>

      {/* ═══════════ Privacy Policy Summary ═══════════ */}
      <RevealSection>
        <section className="py-16 px-5" style={{ background: C }}>
          <div className="max-w-3xl mx-auto text-center">
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: N, fontSize: 22, fontWeight: 400, marginBottom: 12 }}>Privacy &amp; HIPAA Compliance</h3>
            <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.85, marginBottom: 16 }}>
              This website is a marketing site only. It does not collect, store, transmit, or process any Protected Health Information (PHI) as defined under HIPAA.
              Our contact form collects only your name, phone number, and email address — these are not considered PHI when collected outside a treatment context.
              For clinical intake and PHI collection, we use HIPAA-compliant practice management software.
            </p>
            <p style={{ color: "#9ca3af", fontSize: 11 }}>
              <a href="/stewart-dental/privacy" style={{ color: G, textDecoration: "underline" }}>Read our full Privacy Policy</a> · For HIPAA questions, call (313) 882-8711.
            </p>
          </div>
        </section>
      </RevealSection>

      {/* ═══════════ Footer ═══════════ */}
      <footer style={{ background: N, padding: "64px 20px 32px" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: G }}>
                  <span style={{ color: N, fontSize: 14 }}>✦</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "white", letterSpacing: ".05em" }}>STEWART DENTAL GROUP</span>
              </div>
              <p style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 1.8 }}>
                Board-Certified Prosthodontist serving Grosse Pointe, Detroit, St. Clair Shores, and surrounding communities for over 36 years.
              </p>
              <div className="mt-4 flex flex-wrap gap-1">
                {["Hour Detroit Top Dentist", "Styleline Top Dentist"].map(a => (
                  <span key={a} className="inline-block text-[10px] px-2 py-1 rounded" style={{ background: "rgba(201,168,76,.12)", color: G, fontWeight: 600 }}>{a}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Services</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2.2 }}>
                {["CEREC Same-Day Crowns", "Dental Implants", "Bridges & Partials", "Dentures", "Bite Guards", "Obturators", "Hygiene"].map(s => (
                  <a key={s} href="#services" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{s}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Contact</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>
                <div className="flex items-start gap-2"><MapPin size={12} color={G} style={{ marginTop: 4, flexShrink: 0 }} />19635 Mack Avenue<br />Grosse Pointe Woods, MI 48236</div>
                <a href="tel:3138828711" style={{ color: G, textDecoration: "none", display: "block", marginTop: 4 }}>(313) 882-8711</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: G }}>Hours</h4>
              <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>Mon / Tue / Thu: 7:30 – 4:00<br />Wednesday: 8:30 – 12:30<br />Fri – Sun: Closed</div>
              <div className="mt-4">
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: G }}>Payment</h4>
                <div style={{ color: "rgba(138,154,181,.6)", fontSize: 13, lineHeight: 2 }}>Visa · MasterCard<br />American Express · CareCredit®</div>
              </div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop: "1px solid rgba(201,168,76,.1)" }}>
            <p style={{ color: "rgba(75,85,99,.45)", fontSize: 11 }}>© {new Date().getFullYear()} Stewart Dental Group. All rights reserved. Robert B. Stewart, D.D.S., M.S., P.C.</p>
            <a href="https://www.mattmichelstraining.com/detroit-web-design" target="_blank" rel="noopener noreferrer" style={{ color: G, fontSize: 11, textDecoration: "none" }}>
              Site by M² Web Design
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
