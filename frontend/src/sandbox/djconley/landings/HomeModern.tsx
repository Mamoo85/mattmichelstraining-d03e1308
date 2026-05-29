import SiteLayout from "../SiteLayout";
import { Link } from "react-router-dom";
import { djPath } from "../links";
import { Phone, ArrowUpRight, Flame } from "lucide-react";
import { dj, stats, manufacturers, industries, products, projects } from "./shared";

/** V4 — "Modern Engineered". Premium dark/steel editorial archetype (Victory
 *  Energy / high-design B2B): large type, big imagery, capabilities + project
 *  gallery, manufacturer partners. The "wow" version. Charcoal + red + teal,
 *  DJ logo & phone constant. */
export default function HomeModern() {
  return (
    <SiteLayout>
      <div className="bg-[#0e1115] text-white" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        {/* Hero */}
        <section className="relative min-h-[620px] flex items-end overflow-hidden">
          <div className="absolute inset-0 bg-[url('/demo-djconley-current/img/New-Steam-Boiler-Plant_Background.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1115] via-[#0e1115]/70 to-[#0e1115]/30" />
          <div className="relative mx-auto w-full max-w-[1200px] px-8 pb-20">
            <div className="inline-flex items-center gap-2 text-[#27CCC0] text-xs uppercase tracking-[0.35em] mb-6">
              <Flame className="h-4 w-4" /> Concept to completion · Since {dj.sinceYear}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.02] max-w-[900px] mb-6">
              Engineered steam,<br />hot water &amp; <span className="text-[#c12a3b]">heat recovery.</span>
            </h1>
            <p className="text-white/70 text-lg max-w-[560px] mb-9">
              {dj.name} — Michigan's manufacturer's rep and distributor for the complete boiler room. {dj.years} years of getting it right.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link to={djPath("/contact")} className="inline-flex items-center gap-2 bg-white text-[#0e1115] font-semibold px-7 py-4 rounded-full hover:bg-[#27CCC0] transition">
                Request a Quote <ArrowUpRight className="h-5 w-5" />
              </Link>
              <a href={dj.phoneTel} className="inline-flex items-center gap-2 text-white font-semibold"><Phone className="h-5 w-5 text-[#27CCC0]" /> {dj.phone}</a>
            </div>
          </div>
        </section>

        {/* Marquee-style manufacturer partners */}
        <section className="border-y border-white/10 py-8">
          <div className="mx-auto max-w-[1200px] px-8">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40 mb-5 text-center">Partner Brands We Represent</p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {manufacturers.map((m) => (
                <span key={m} className="text-xl md:text-2xl font-bold tracking-tight text-white/55 hover:text-white transition">{m}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Big statement + stats */}
        <section className="py-24">
          <div className="mx-auto max-w-[1200px] px-8 grid md:grid-cols-[1.2fr_0.8fr] gap-16 items-center">
            <div>
              <p className="text-[#c12a3b] uppercase tracking-[0.3em] text-xs mb-5">Who we are</p>
              <h2 className="text-3xl md:text-4xl font-semibold leading-snug mb-6">{dj.blurb}</h2>
              <p className="text-white/60 text-lg leading-relaxed">For over half a century, plant engineers, hospitals, and manufacturers across Michigan and the Great Lakes have trusted us to keep their steam and hot water systems running — and to engineer the upgrades that make them better.</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#0e1115] p-7">
                  <div className="text-3xl font-bold text-[#27CCC0]">{s.value}</div>
                  <div className="text-sm font-semibold mt-2">{s.label}</div>
                  <div className="text-xs text-white/40 mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities / industries grid */}
        <section className="pb-24">
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="flex items-end justify-between mb-10">
              <h2 className="text-3xl md:text-4xl font-semibold">Industries we power</h2>
              <Link to={djPath("/industries")} className="text-sm text-[#27CCC0] hover:underline inline-flex items-center gap-1">All industries <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
              {industries.map((ind) => (
                <div key={ind.name} className="group relative bg-[#0e1115] overflow-hidden">
                  <div className="h-56 bg-cover bg-center opacity-60 group-hover:opacity-90 group-hover:scale-105 transition duration-500" style={{ backgroundImage: `url('${ind.img}')` }} />
                  <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0e1115] to-transparent">
                    <div className="text-lg font-semibold">{ind.name}</div>
                    <div className="text-xs text-white/50">{ind.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section className="pb-24">
          <div className="mx-auto max-w-[1200px] px-8">
            <h2 className="text-3xl md:text-4xl font-semibold mb-10">The complete boiler room</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {products.map((p) => (
                <div key={p.name} className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-[#27CCC0]/40 transition">
                  <img src={p.img} alt={p.name} className="h-44 w-full object-contain mb-4" loading="lazy" />
                  <div className="text-base font-semibold">{p.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-8"><Link to={djPath("/products")} className="inline-flex items-center gap-2 text-[#27CCC0] hover:underline">Explore all products <ArrowUpRight className="h-4 w-4" /></Link></div>
          </div>
        </section>

        {/* Project gallery */}
        <section className="pb-24">
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="flex items-end justify-between mb-10">
              <h2 className="text-3xl md:text-4xl font-semibold">Recent work</h2>
              <Link to={djPath("/projects")} className="text-sm text-[#27CCC0] hover:underline inline-flex items-center gap-1">All projects <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {projects.map((p) => (
                <div key={p.name} className="group relative rounded-xl overflow-hidden">
                  <div className="h-48 bg-cover bg-center group-hover:scale-105 transition duration-500" style={{ backgroundImage: `url('${p.img}')` }} />
                  <div className="absolute inset-0 bg-[#0e1115]/30 group-hover:bg-[#0e1115]/60 transition" />
                  <div className="absolute bottom-3 left-4 right-4 text-sm font-semibold">{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-28">
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="rounded-3xl bg-gradient-to-r from-[#c12a3b] to-[#8e1f2b] p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Let's engineer your boiler room.</h2>
              <p className="text-white/85 text-lg mb-8 max-w-[560px] mx-auto">New equipment, emergency service, parts, or rentals — talk to the team that's done it since {dj.sinceYear}.</p>
              <div className="flex flex-wrap items-center justify-center gap-5">
                <Link to={djPath("/contact")} className="bg-white text-[#0e1115] font-semibold px-8 py-4 rounded-full hover:bg-[#0e1115] hover:text-white transition">Request a Quote</Link>
                <a href={dj.phoneTel} className="inline-flex items-center gap-2 text-white font-semibold"><Phone className="h-5 w-5" /> {dj.phone}</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
