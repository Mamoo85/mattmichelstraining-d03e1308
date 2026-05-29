import SiteLayout from "../SiteLayout";
import { Link } from "react-router-dom";
import { djPath } from "../links";
import { Phone, Wrench, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import { dj, stats, manufacturers, industries, services, products } from "./shared";

/** V2 — "Boiler-Room Authority". Premium manufacturer-rep look (Cleaver-Brooks
 *  archetype): cinematic hero + dual CTA, 24/7 emergency bar, line-card strip,
 *  industries grid, stats band, products row, territory map. Navy + red. */
export default function HomeAuthority() {
  return (
    <SiteLayout>
      {/* Emergency utility bar */}
      <div className="bg-[#c12a3b] text-white text-center text-[13px] font-semibold py-2 px-4">
        🔥 Boiler down? 24/7 Emergency Service —{" "}
        <a href={dj.phoneTel} className="underline underline-offset-2">{dj.phone}</a>
      </div>

      {/* Hero */}
      <section className="relative min-h-[560px] flex items-center bg-[url('/demo-djconley-current/main-cover-photo.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1622]/95 via-[#0b1622]/75 to-[#0b1622]/30" />
        <div className="relative mx-auto w-full max-w-[1180px] px-8 py-24 text-white">
          <p className="text-[#27CCC0] uppercase tracking-[0.3em] text-xs mb-4">Steam · Hot Water · Heat Recovery</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-[760px] mb-5">
            Michigan's trusted boiler-room solutions partner since {dj.sinceYear}.
          </h1>
          <p className="text-white/80 text-lg max-w-[620px] mb-9">{dj.blurb}</p>
          <div className="flex flex-wrap gap-4">
            <Link to={djPath("/contact")} className="inline-flex items-center gap-2 bg-[#c12a3b] hover:bg-[#a8222f] text-white font-semibold px-7 py-4 rounded-md transition">
              <FileText className="h-5 w-5" /> Request a Quote
            </Link>
            <Link to={djPath("/service")} className="inline-flex items-center gap-2 border border-white/40 hover:bg-white hover:text-[#0b1622] text-white font-semibold px-7 py-4 rounded-md transition">
              <Wrench className="h-5 w-5" /> Request Service
            </Link>
            <a href={dj.phoneTel} className="inline-flex items-center gap-2 text-white font-semibold px-3 py-4">
              <Phone className="h-5 w-5 text-[#27CCC0]" /> {dj.phone}
            </a>
          </div>
        </div>
      </section>

      {/* Line-card / manufacturers represented */}
      <section className="bg-white py-10 border-b border-black/5">
        <div className="mx-auto max-w-[1180px] px-8">
          <p className="text-center text-xs uppercase tracking-[0.3em] text-[#999] mb-6">Authorized Representative & Distributor For</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {manufacturers.map((m) => (
              <span key={m} className="text-[#0b1622] font-bold text-lg md:text-xl tracking-tight opacity-80">{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-[#0b1622] text-white py-12">
        <div className="mx-auto max-w-[1180px] px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[#27CCC0]">{s.value}</div>
              <div className="text-sm font-semibold mt-1">{s.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Industries served */}
      <section className="bg-[#e9e9e9] py-16">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#c12a3b] mb-2">Industries We Serve</p>
            <h2 className="text-3xl font-semibold text-[#333]">Keeping critical facilities running</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {industries.map((ind) => (
              <div key={ind.name} className="group relative overflow-hidden rounded-lg shadow-sm bg-white">
                <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url('${ind.img}')` }} />
                <div className="p-4">
                  <div className="text-lg font-semibold text-[#0b1622]">{ind.icon} {ind.name}</div>
                  <div className="text-sm text-[#777] mt-1">{ind.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1180px] px-8">
          <h2 className="text-3xl font-semibold text-[#333] text-center mb-10">Complete boiler-room capability</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {services.map((s) => (
              <Link key={s.name} to={djPath(s.to)} className="block rounded-lg border border-black/5 overflow-hidden hover:shadow-lg transition">
                <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url('${s.img}')` }} />
                <div className="p-5">
                  <div className="text-lg font-semibold text-[#0b1622] flex items-center justify-between">{s.name}<ArrowRight className="h-4 w-4 text-[#c12a3b]" /></div>
                  <p className="text-sm text-[#777] mt-2">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Products strip */}
      <section className="bg-[#e9e9e9] py-16">
        <div className="mx-auto max-w-[1180px] px-8">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-3xl font-semibold text-[#333]">Equipment we represent</h2>
            <Link to={djPath("/products")} className="text-sm font-semibold text-[#c12a3b] hover:underline">All products →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {products.map((p) => (
              <div key={p.name} className="bg-white rounded-lg p-5 text-center shadow-sm">
                <img src={p.img} alt={p.name} className="h-40 w-full object-contain mb-3" loading="lazy" />
                <div className="text-sm font-semibold text-[#0b1622]">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Territory + final CTA */}
      <section className="bg-[#0b1622] text-white py-16">
        <div className="mx-auto max-w-[1180px] px-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#27CCC0] mb-3">Service Territory</p>
            <h2 className="text-3xl font-semibold mb-4">Serving Michigan & the Great Lakes Region</h2>
            <p className="text-white/70 mb-6">From our Warren, MI headquarters we provide sales, service, and parts distribution across Michigan, Ohio, Indiana and beyond.</p>
            <div className="flex items-center gap-3 mb-2 text-sm"><ShieldCheck className="h-5 w-5 text-[#27CCC0]" /> Factory-trained, manufacturer-certified technicians</div>
            <a href={dj.mapsUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm border border-[#c12a3b] text-[#27CCC0] px-5 py-3 rounded-md hover:bg-[#c12a3b] hover:text-white transition">📍 {dj.address}</a>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 shadow-xl">
            <iframe title="D.J. Conley Service Area" src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d2913280!2d-85.5!3d43.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000" className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
