import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { RevealSection } from "@/hooks/useInView";
import { Phone, Mail, MapPin, Menu, X } from "lucide-react";

const R = "#C8290A";
const B = "#0D0D0D";
const W = "#FFFFFF";

export default function YoungbloodMockupAlt1() {
  const [vis, setVis] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", company:"", phone:"", email:"", category:"", quantity:"", urgency:"", description:"" });

  useEffect(() => {
    const fn = () => { const y = window.scrollY; setVis(y < 80 || y < lastY); setLastY(y); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [lastY]);

  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  return (
    <>
      <Helmet>
        <title>Youngblood Automation — Michigan Industrial Automation Distributor</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6" style={{ background: B }}>
          <button onClick={() => setOpen(false)} className="absolute top-5 right-5 p-2" style={{ color: W, background:"none", border:"none", cursor:"pointer" }}><X size={28} /></button>
          {[["#solutions","SOLUTIONS"],["#industries","INDUSTRIES"],["#partners","PARTNERS"],["#locations","LOCATIONS"]].map(([h,l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="text-2xl font-black tracking-widest transition-colors"
              style={{ color: W, textDecoration:"none", letterSpacing:".15em" }}
              onMouseEnter={e=>(e.currentTarget.style.color=R)} onMouseLeave={e=>(e.currentTarget.style.color=W)}>{l}</a>
          ))}
          <a href="#rfq" onClick={() => setOpen(false)} className="mt-6 px-10 py-4 font-black text-sm tracking-widest"
            style={{ background:R, color:W, textDecoration:"none", letterSpacing:".12em" }}>REQUEST QUOTE</a>
        </div>
      )}

      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[150] text-center py-2 px-4 text-xs font-bold tracking-widest" style={{ background:R, color:W }}>
        REDESIGN CONCEPT · Matt Michels Web Design · 313.806.4952
      </div>

      {/* Design switcher */}
      <div className="hidden lg:block fixed bottom-5 left-0 z-[150]" style={{ background:"rgba(13,13,13,.95)", border:"1px solid rgba(255,255,255,.15)", padding:"16px 20px", minWidth:200 }}>
        <div style={{ color:"rgba(255,255,255,.4)", fontSize:10, fontWeight:700, letterSpacing:".12em", marginBottom:10 }}>DESIGN CONCEPTS</div>
        {[{p:"/demo-youngblood",l:"Dark / Blue"},{p:"/demo-youngblood-alt1",l:"Steel & Fire",a:true},{p:"/demo-youngblood-alt2",l:"Precision Grid"}].map(({p,l,a}) => (
          <Link key={p} to={p} style={{ display:"block", color:a?R:"rgba(255,255,255,.5)", fontSize:12, fontWeight:a?700:400, letterSpacing:".06em", textDecoration:"none", padding:"4px 0" }}>
            {a?`▶ ${l} — CURRENT`:l}
          </Link>
        ))}
        <div style={{ color:"rgba(255,255,255,.3)", fontSize:10, marginTop:10 }}>Matt (313) 806-4952</div>
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 z-[100] transition-transform duration-300"
        style={{ top:32, transform:vis?"translateY(0)":"translateY(-100%)", background:W, borderBottom:`3px solid ${B}` }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="font-black text-lg tracking-tight" style={{ color:B }}>YOUNGBLOOD <span style={{ color:R }}>|</span> AUTOMATION</div>
          <nav className="hidden lg:flex items-center gap-8">
            {["SOLUTIONS","INDUSTRIES","PARTNERS","LOCATIONS"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-xs font-black tracking-widest" style={{ color:B, textDecoration:"none" }}>{item}</a>
            ))}
            <a href="tel:5862641240" className="text-xs font-bold" style={{ color:B, textDecoration:"none" }}>(586) 264-1240</a>
            <a href="#rfq" className="px-5 py-2 text-xs font-black tracking-widest" style={{ background:R, color:W, textDecoration:"none" }}>REQUEST QUOTE</a>
          </nav>
          <button className="lg:hidden p-2" onClick={() => setOpen(true)} style={{ border:"none", background:"transparent", cursor:"pointer" }}>
            <Menu size={24} color={B} />
          </button>
        </div>
      </header>

      <main style={{ fontFamily:"'Arial', 'Helvetica Neue', sans-serif" }}>

        {/* HERO */}
        <section className="relative flex items-center overflow-hidden min-h-screen" style={{ background:B, paddingTop:"calc(32px + 64px)" }}>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage:"url(https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1920&q=80)", opacity:.25 }} />
          <div className="absolute inset-0" style={{ background:"linear-gradient(to right, rgba(13,13,13,.95) 40%, rgba(13,13,13,.4) 100%)" }} />
          <div className="relative z-10 max-w-7xl mx-auto px-5 py-20 w-full">
            <div className="inline-block px-4 py-2 mb-8 text-xs font-black tracking-widest" style={{ background:B, border:"1px solid rgba(255,255,255,.2)", color:"rgba(255,255,255,.7)" }}>
              EST. 1964 — WARREN, MI
            </div>
            <h1 className="mb-6 font-black leading-none" style={{ fontSize:"clamp(60px,11vw,120px)", letterSpacing:"-0.04em", color:W, lineHeight:.88 }}>
              POWER.<br />PRECISION.<br /><span style={{ color:R }}>NO EXCUSES.</span>
            </h1>
            <p className="mb-10 text-lg max-w-lg" style={{ color:"rgba(255,255,255,.5)", lineHeight:1.7 }}>
              Michigan's premier automation distributor since 1964. Motion control, fluid power, and robotic integration — built for the factory floor.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#solutions" className="flex items-center justify-center gap-2 px-8 py-4 font-black text-sm tracking-widest w-full sm:w-auto" style={{ background:R, color:W, textDecoration:"none" }}>EXPLORE SOLUTIONS</a>
              <a href="#rfq" className="flex items-center justify-center gap-2 px-8 py-4 font-black text-sm tracking-widest w-full sm:w-auto" style={{ border:"2px solid rgba(255,255,255,.45)", color:W, textDecoration:"none" }}>REQUEST A QUOTE</a>
            </div>
          </div>
        </section>

        {/* Solutions */}
        <RevealSection>
          <section id="solutions" className="py-20 px-5" style={{ background:B }}>
            <div className="max-w-7xl mx-auto">
              <p className="text-xs font-black tracking-widest mb-12" style={{ color:R, letterSpacing:".2em" }}>CORE CAPABILITIES</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[["01","MOTION CONTROL","Servo drives, linear actuators, PLCs, and precision positioning from leading manufacturers."],
                  ["02","FLUID POWER","Hydraulic and pneumatic systems engineered for high-cycle industrial use and extreme environments."],
                  ["03","ROBOTIC INTEGRATION","Collaborative and industrial robot cells from UR, FANUC, and KUKA — fully commissioned on-site."],
                  ["04","CUSTOM PANELS","In-house UL 508A panel builds with full documentation, testing, and on-site startup support."]].map(([n,t,d],i) => (
                  <div key={n} className="py-10 px-8" style={{ borderRight:i<3?"1px solid rgba(255,255,255,.1)":"none", borderTop:"1px solid rgba(255,255,255,.06)" }}>
                    <div className="font-black mb-4" style={{ fontSize:48, color:R, letterSpacing:"-0.04em", lineHeight:1 }}>{n}</div>
                    <div className="font-black mb-3 text-lg" style={{ color:W, letterSpacing:"-0.02em" }}>{t}</div>
                    <div className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.4)" }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Stats */}
        <RevealSection>
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ background:R }}>
            {[["1964","YEAR FOUNDED"],["4","MICHIGAN OFFICES"],["99.2%","UPTIME GUARANTEE"],["60+","MANUFACTURER LINES"]].map(([v,l],i) => (
              <div key={l} className="py-10 text-center" style={{ borderRight:i%2===0?"1px solid rgba(255,255,255,.2)":"none", borderBottom:i<2?"1px solid rgba(255,255,255,.2)":"none" }}>
                <div className="font-black" style={{ fontSize:"clamp(36px,5vw,56px)", color:W, letterSpacing:"-0.04em", lineHeight:1 }}>{v}</div>
                <div className="text-xs font-black mt-2 tracking-widest" style={{ color:"rgba(255,255,255,.6)" }}>{l}</div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* Partners */}
        <RevealSection>
          <section id="partners" className="py-20 px-5" style={{ background:W }}>
            <div className="max-w-7xl mx-auto">
              <h2 className="font-black mb-16" style={{ fontSize:"clamp(40px,6vw,72px)", letterSpacing:"-0.04em", color:B }}>TIER 1 PARTNERS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[["SICK","Industrial Sensors & Safety"],["EATON","Hydraulics & Electrical"],["EMERSON","Automation & Process Control"],["UNIVERSAL ROBOTS","Collaborative Robotic Systems"]].map(([n,s],i) => (
                  <div key={n} className="py-8 px-6" style={{ borderBottom:"1px solid rgba(0,0,0,.1)", borderRight:i<3?"1px solid rgba(0,0,0,.1)":"none" }}>
                    <div className="font-black text-2xl mb-2" style={{ letterSpacing:"-0.03em", color:B }}>{n}</div>
                    <div className="text-xs tracking-wide" style={{ color:"#888" }}>{s}</div>
                  </div>
                ))}
              </div>
              <div className="mt-12 pt-6" style={{ borderTop:`2px solid ${B}` }}>
                <p className="text-xs font-black tracking-widest mb-4" style={{ color:"rgba(0,0,0,.3)" }}>ADDITIONAL LINES</p>
                <div className="flex flex-wrap gap-6">
                  {["BOSCH REXROTH","PARKER HANNIFIN","ALLEN-BRADLEY","SIEMENS","FESTO","SMC","IGUS","LENZE","SCHUNK","NORGREN"].map(n => (
                    <span key={n} className="text-xs font-black tracking-widest" style={{ color:"rgba(0,0,0,.18)" }}>{n}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Manufacturing */}
        <RevealSection>
          <section className="px-5 py-20" style={{ background:"#f5f5f5" }}>
            <div className="max-w-7xl mx-auto">
              <p className="text-xs font-black tracking-widest mb-14" style={{ color:R, letterSpacing:".2em" }}>MANUFACTURED IN MICHIGAN</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background:"rgba(0,0,0,.1)" }}>
                {[["https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&q=80","ENGINEERED CELLS","Complete turnkey automation cells designed and assembled in our Warren facility."],
                  ["https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=800&q=80","HYDRAULIC SYSTEMS","Custom manifolds, power units, and hydraulic circuit assemblies built to spec."],
                  ["https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80","ROBOTIC INTEGRATION","End-of-arm tooling, safety fencing, vision systems, and full cell commissioning."]].map(([img,t,d]) => (
                  <div key={t as string} className="overflow-hidden" style={{ background:W }}>
                    <div className="overflow-hidden" style={{ height:260 }}>
                      <img src={img as string} alt={t as string} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                    </div>
                    <div className="p-8" style={{ borderTop:`4px solid ${R}` }}>
                      <div className="font-black text-lg mb-3" style={{ letterSpacing:"-0.02em", color:B }}>{t as string}</div>
                      <div className="text-sm leading-relaxed" style={{ color:"#666" }}>{d as string}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Industries */}
        <RevealSection>
          <section id="industries" className="py-20 px-5" style={{ background:B }}>
            <div className="max-w-7xl mx-auto">
              <h2 className="font-black mb-12" style={{ fontSize:"clamp(40px,6vw,72px)", letterSpacing:"-0.04em", color:W }}>INDUSTRIES SERVED</h2>
              <div className="flex flex-wrap gap-3">
                {["AUTOMOTIVE OEM","TIER 1 SUPPLIER","AEROSPACE","STAMPING","WELDING","MACHINING CENTERS","FOOD & BEVERAGE","PHARMACEUTICAL","HEAVY EQUIPMENT","DEFENSE","ENERGY","PLASTICS","FOUNDRY","MATERIAL HANDLING","PACKAGING","SEMICONDUCTOR","MARINE","AGRICULTURE"].map(tag => (
                  <span key={tag} className="text-xs font-black tracking-wider px-4 py-2" style={{ border:`1px solid ${R}`, color:R }}>{tag}</span>
                ))}
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Locations */}
        <RevealSection>
          <section id="locations" className="py-20 px-5" style={{ background:W }}>
            <div className="max-w-7xl mx-auto">
              <p className="text-xs font-black tracking-widest mb-12" style={{ color:R, letterSpacing:".2em" }}>MICHIGAN OFFICES</p>
              <div className="grid grid-cols-2 lg:grid-cols-4">
                {[["WARREN","HQ & Main Distribution"],["GRAND RAPIDS","West Michigan Hub"],["LANSING","Central Michigan"],["DETROIT","Metro Engineering Center"]].map(([c,r],i) => (
                  <div key={c} className="py-10 px-6" style={{ borderRight:i<3?"1px solid rgba(0,0,0,.1)":"none" }}>
                    <div className="font-black text-2xl mb-3" style={{ letterSpacing:"-0.04em", color:B }}>{c}</div>
                    <div style={{ width:32, height:3, background:R, marginBottom:10 }} />
                    <div className="text-xs tracking-wider" style={{ color:"#777" }}>{r}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealSection>

        {/* RFQ */}
        <RevealSection>
          <section id="rfq" className="py-20 px-5" style={{ background:B }}>
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <p className="text-xs font-black tracking-widest mb-6" style={{ color:R, letterSpacing:".2em" }}>GET STARTED</p>
                <h2 className="font-black mb-12" style={{ fontSize:"clamp(48px,7vw,80px)", letterSpacing:"-0.04em", color:W, lineHeight:.88 }}>SUBMIT<br />YOUR RFQ</h2>
                <form onSubmit={e=>e.preventDefault()} className="space-y-5">
                  {[{k:"name",l:"FULL NAME",t:"text"},{k:"company",l:"COMPANY",t:"text"},{k:"phone",l:"PHONE",t:"tel"},{k:"email",l:"EMAIL",t:"email"}].map(({k,l,t}) => (
                    <div key={k}>
                      <label className="block text-xs font-bold tracking-widest mb-2" style={{ color:"rgba(255,255,255,.35)", letterSpacing:".14em" }}>{l}</label>
                      <input type={t} value={form[k as keyof typeof form]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                        className="w-full text-sm outline-none"
                        style={{ background:"transparent", border:"1px solid rgba(255,255,255,.18)", padding:"13px 14px", color:W, fontFamily:"Arial, sans-serif", boxSizing:"border-box" }} />
                    </div>
                  ))}
                  {[{k:"category",l:"PRODUCT CATEGORY",o:["Motion Control","Hydraulics","Pneumatics","Robotics","Sensors","Safety Systems","Custom Panels"]},
                    {k:"quantity",l:"QUANTITY",o:["1–5 Units","6–25 Units","26–100 Units","100–500 Units","500+ Units","Contract"]},
                    {k:"urgency",l:"TIMELINE",o:["Emergency / Down Line","Within 48 Hours","This Week","This Month","Planning Phase"]}].map(({k,l,o}) => (
                    <div key={k}>
                      <label className="block text-xs font-bold tracking-widest mb-2" style={{ color:"rgba(255,255,255,.35)", letterSpacing:".14em" }}>{l}</label>
                      <select value={form[k as keyof typeof form]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                        className="w-full text-sm outline-none"
                        style={{ background:B, border:"1px solid rgba(255,255,255,.18)", padding:"13px 14px", color:"rgba(255,255,255,.7)", fontFamily:"Arial, sans-serif", boxSizing:"border-box", appearance:"none" }}>
                        <option value="">Select...</option>
                        {o.map(v=><option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold tracking-widest mb-2" style={{ color:"rgba(255,255,255,.35)", letterSpacing:".14em" }}>APPLICATION DESCRIPTION</label>
                    <textarea rows={4} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                      placeholder="Machine type, cycle requirements, environment..."
                      className="w-full text-sm outline-none resize-none"
                      style={{ background:"transparent", border:"1px solid rgba(255,255,255,.18)", padding:"13px 14px", color:W, fontFamily:"Arial, sans-serif", boxSizing:"border-box" }} />
                  </div>
                  <button type="submit" className="text-sm font-black tracking-widest px-10 py-4" style={{ background:R, color:W, border:"none", cursor:"pointer", letterSpacing:".1em" }}>SUBMIT RFQ →</button>
                </form>
              </div>
              <div className="pt-2 lg:pt-28">
                <p className="text-xs font-black tracking-widest mb-10" style={{ color:R, letterSpacing:".2em" }}>CONTACT DIRECTLY</p>
                {[{icon:<Phone size={15} key="p" />,l:"MAIN",v:"(586) 264-1240",h:"tel:5862641240"},
                  {icon:<Mail size={15} key="m" />,l:"EMAIL",v:"sales@youngbloodautomation.com",h:"mailto:sales@youngbloodautomation.com"},
                  {icon:<MapPin size={15} key="mp" />,l:"HQ",v:"12345 Van Dyke Ave, Warren, MI 48089",h:"#"}].map(({icon,l,v,h}) => (
                  <div key={l} className="flex gap-4 items-start mb-8">
                    <div style={{ color:R, paddingTop:2 }}>{icon}</div>
                    <div>
                      <div className="text-xs font-black tracking-widest mb-1" style={{ color:"rgba(255,255,255,.25)", letterSpacing:".14em" }}>{l}</div>
                      <a href={h} className="font-bold text-base" style={{ color:W, textDecoration:"none" }}>{v}</a>
                    </div>
                  </div>
                ))}
                <div className="p-8 mt-8" style={{ border:"1px solid rgba(255,255,255,.1)" }}>
                  <p className="text-xs font-black tracking-widest mb-3" style={{ color:R, letterSpacing:".14em" }}>EMERGENCY LINE</p>
                  <a href="tel:5862641241" className="block font-black text-3xl mb-2" style={{ color:W, textDecoration:"none", letterSpacing:"-0.02em" }}>(586) 264-1241</a>
                  <p className="text-xs" style={{ color:"rgba(255,255,255,.3)" }}>24/7 for critical downtime situations</p>
                </div>
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Footer */}
        <footer style={{ background:B, borderTop:"1px solid rgba(255,255,255,.06)", padding:"60px 20px 40px" }}>
          <div className="max-w-7xl mx-auto">
            <div className="font-black text-xl mb-12" style={{ letterSpacing:"-0.03em", color:W }}>YOUNGBLOOD <span style={{ color:R }}>|</span> AUTOMATION</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div><p className="text-sm leading-relaxed" style={{ color:"rgba(255,255,255,.38)" }}>Michigan's leading automation distributor since 1964. Serving automotive, aerospace, and industrial manufacturers across the region.</p></div>
              {[{t:"SOLUTIONS",i:["Motion Control","Fluid Power","Robotics","Custom Panels","Sensing"]},
                {t:"RESOURCES",i:["3D CAD Library","Product Catalog","Application Notes","Training","Careers"]},
                {t:"CONTACT",i:["(586) 264-1240","Warren, MI HQ","Grand Rapids","Lansing","Detroit"]}].map(({t,i}) => (
                <div key={t}>
                  <p className="text-xs font-black tracking-widest mb-5" style={{ color:R, letterSpacing:".14em" }}>{t}</p>
                  {i.map(item=><div key={item} className="text-xs mb-3" style={{ color:"rgba(255,255,255,.38)" }}>{item}</div>)}
                </div>
              ))}
            </div>
            <div className="pt-6 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop:"1px solid rgba(255,255,255,.06)" }}>
              <div className="text-xs" style={{ color:"rgba(255,255,255,.18)" }}>© 2025 Youngblood Automation. All rights reserved.</div>
              <Link to="/manufacturing-web-design" style={{ color:R, fontSize:11, textDecoration:"none" }}>Redesign concept by Matt Michels Web Design</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
