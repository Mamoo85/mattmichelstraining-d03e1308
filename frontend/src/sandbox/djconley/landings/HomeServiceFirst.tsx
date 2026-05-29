import { useState } from "react";
import SiteLayout from "../SiteLayout";
import { Link } from "react-router-dom";
import { djPath } from "../links";
import { Phone, Clock, Star, Award, CheckCircle2, Truck } from "lucide-react";
import { dj, manufacturers, services, reviews } from "./shared";

/** V3 — "Service-First". Conversion-optimized contractor archetype: in-hero
 *  request form, loud 24/7 emergency band, trust badges, how-it-works, reviews.
 *  Built to make the phone ring. Navy + red. */
export default function HomeServiceFirst() {
  const [sent, setSent] = useState(false);
  const mailto = (name: string, phone: string, msg: string) =>
    `mailto:${dj.email}?subject=${encodeURIComponent("Service / Quote Request — djconley.com")}&body=${encodeURIComponent(`Name: ${name}\nPhone: ${phone}\nNeed: ${msg}`)}`;

  return (
    <SiteLayout>
      {/* Loud emergency band */}
      <div className="bg-[#c12a3b] text-white py-3 px-4">
        <div className="mx-auto max-w-[1180px] flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm font-semibold">
          <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> 24/7 Emergency Boiler Service</span>
          <a href={dj.phoneTel} className="inline-flex items-center gap-2 underline underline-offset-2"><Phone className="h-4 w-4" /> {dj.phone}</a>
        </div>
      </div>

      {/* Hero with in-line request form */}
      <section className="relative bg-[#0b1622]">
        <div className="absolute inset-0 bg-[url('/demo-djconley-current/img/New-Steam-Boiler-Plant_Background.jpg')] bg-cover bg-center opacity-25" />
        <div className="relative mx-auto max-w-[1180px] px-8 py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="text-white">
            <p className="text-[#27CCC0] uppercase tracking-[0.3em] text-xs mb-4">Steam · Hot Water · Heat Recovery · Since {dj.sinceYear}</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">Boiler trouble? Get a Michigan expert on it today.</h1>
            <p className="text-white/80 text-lg mb-7 max-w-[520px]">Emergency service, parts, and new equipment from the rep that actually knows the boiler room. {dj.years} years serving Metro Detroit.</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#27CCC0]" /> Factory-trained techs</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-5 w-5 text-[#27CCC0]" /> Parts in stock</span>
              <span className="inline-flex items-center gap-2"><Award className="h-5 w-5 text-[#27CCC0]" /> Since {dj.sinceYear}</span>
            </div>
          </div>

          {/* Request form */}
          <div className="bg-white rounded-xl shadow-2xl p-7">
            {sent ? (
              <div className="text-center py-10">
                <CheckCircle2 className="h-12 w-12 text-[#27CCC0] mx-auto mb-3" />
                <div className="text-xl font-bold text-[#0b1622]">Request ready to send</div>
                <p className="text-sm text-[#777] mt-2">Your email client opened with the details. Or call us now at <a href={dj.phoneTel} className="text-[#c12a3b] font-semibold">{dj.phone}</a>.</p>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = e.target as HTMLFormElement;
                  const name = (f.elements.namedItem("name") as HTMLInputElement).value;
                  const phone = (f.elements.namedItem("phone") as HTMLInputElement).value;
                  const msg = (f.elements.namedItem("msg") as HTMLTextAreaElement).value;
                  window.location.href = mailto(name, phone, msg);
                  setSent(true);
                }}
              >
                <div className="text-lg font-bold text-[#0b1622]">Request Service or a Quote</div>
                <p className="text-xs text-[#999] -mt-1 mb-1">We respond fast. Emergencies — call {dj.phone}.</p>
                <input name="name" required placeholder="Name / Company" className="w-full border border-black/15 rounded-md px-3 py-2.5 text-sm text-[#0b1622] focus:outline-none focus:border-[#c12a3b]" />
                <input name="phone" required placeholder="Phone" className="w-full border border-black/15 rounded-md px-3 py-2.5 text-sm text-[#0b1622] focus:outline-none focus:border-[#c12a3b]" />
                <textarea name="msg" rows={3} placeholder="What do you need? (boiler model, issue, specs…)" className="w-full border border-black/15 rounded-md px-3 py-2.5 text-sm text-[#0b1622] focus:outline-none focus:border-[#c12a3b]" />
                <button type="submit" className="w-full bg-[#c12a3b] hover:bg-[#a8222f] text-white font-bold py-3 rounded-md transition">Send Request →</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-white py-8 border-b border-black/5">
        <div className="mx-auto max-w-[1180px] px-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[#0b1622]">
          <span className="inline-flex items-center gap-2 font-semibold"><Award className="h-5 w-5 text-[#c12a3b]" /> Since {dj.sinceYear} · {dj.years} years</span>
          <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-5 w-5 text-amber-500 fill-amber-500" /> 4.8 Google rating</span>
          <span className="inline-flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-[#27CCC0]" /> BBB Accredited</span>
          <span className="font-semibold text-[#777]">Authorized: {manufacturers.slice(0, 4).join(" · ")}</span>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#e9e9e9] py-16">
        <div className="mx-auto max-w-[1100px] px-8">
          <h2 className="text-3xl font-semibold text-[#333] text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", t: "Call or request online", d: "Tell us your boiler, the issue, or send specs for a quote." },
              { n: "2", t: "We dispatch / spec it", d: "Factory-trained tech rolls out, or we quote the right equipment & parts." },
              { n: "3", t: "Back up and running", d: "Repaired, supplied, or installed — with the parts to keep it that way." },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-lg p-6 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-[#c12a3b] text-white font-bold text-xl grid place-items-center mx-auto mb-4">{s.n}</div>
                <div className="text-lg font-semibold text-[#0b1622] mb-2">{s.t}</div>
                <p className="text-sm text-[#777]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services quick links */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-[1180px] px-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {services.map((s) => (
            <Link key={s.name} to={djPath(s.to)} className="block rounded-lg overflow-hidden border border-black/5 hover:shadow-md transition">
              <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url('${s.img}')` }} />
              <div className="p-3 text-center text-sm font-semibold text-[#0b1622]">{s.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-[#0b1622] text-white py-16">
        <div className="mx-auto max-w-[1100px] px-8">
          <h2 className="text-3xl font-semibold text-center mb-10">What our customers say</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {reviews.map((r, i) => (
              <div key={i} className="bg-[#111d2b] rounded-lg p-6 border border-white/5">
                <div className="text-amber-400 mb-3">{"★".repeat(r.stars)}</div>
                <p className="text-sm text-white/80 leading-relaxed mb-4">"{r.text}"</p>
                <div className="text-xs text-[#27CCC0] font-semibold">{r.who}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to={djPath("/contact")} className="inline-block bg-[#c12a3b] hover:bg-[#a8222f] text-white font-bold px-8 py-4 rounded-md transition">Get your quote →</Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
