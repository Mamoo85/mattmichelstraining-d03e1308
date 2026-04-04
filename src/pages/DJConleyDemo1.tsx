import { useState } from "react";
import { Phone, Mail, MapPin, Clock, Wrench, Shield, Flame, ThermometerSun, Factory, ChevronDown, ArrowRight, Star, Gauge, Settings, Zap, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/layout/SEOHead";

const products = [
  { title: "Custom Solutions", desc: "New boiler solutions tailored to your facility's unique requirements. From planning through start-up.", icon: Factory, img: "https://djconley.com/wp-content/uploads/2020/03/Option-1-Custom-Solutions-photo.jpg" },
  { title: "Boiler Accessories", desc: "Feedwater systems, blowdown separators, deaerators, and condensate equipment.", icon: Settings, img: "https://djconley.com/wp-content/uploads/2019/07/Products-04.jpg" },
  { title: "Boiler Controls", desc: "Combustion controls, flame safety systems, SCADA, and plant master controls.", icon: Gauge, img: "https://djconley.com/wp-content/uploads/2019/07/Products-01.jpg" },
  { title: "Boiler Burners", desc: "Gas, oil, and alternative fuel burners with ultra-low NOx emissions.", icon: Flame, img: "https://djconley.com/wp-content/uploads/2020/04/Boiler-burners-photo-1000x1000-1.jpg" },
  { title: "Heat Recovery", desc: "Economizers, stack heat recovery, and energy conservation systems.", icon: ThermometerSun, img: "https://djconley.com/wp-content/uploads/2019/07/Products-02.jpg" },
  { title: "Exhaust Solutions", desc: "Exhaust stacks, silencers, and emissions control equipment.", icon: Zap, img: "https://djconley.com/wp-content/uploads/2020/03/Exhaust-Solutions-1500x1500-1.jpg" },
];

const services = [
  { title: "Boiler Tune-Up", desc: "Complete safety check with pressure/temperature controls, fuel safety valves, flame safeguard, and level controls. Test fire at operating conditions.", bullets: ["Safety inspection", "Combustion setting", "Operating control verification"] },
  { title: "Combustion Analysis", desc: "Optimal oxygen and fuel levels to ensure peak efficiency — translating into thousands in fuel savings.", bullets: ["CO2-O2-NOx-SOx testing", "Certified equipment", "Printed test results"] },
  { title: "Preventative Maintenance", desc: "Customized maintenance plans to save time and money with qualified, factory-trained manpower.", bullets: ["Annual preventative plans", "CSD-1 testing", "Maintenance contracts"] },
  { title: "Pressure Vessel", desc: "Factory-trained technicians accurately analyze equipment for repairs and recommendations.", bullets: ["Tube rolling & replacement", "ASME code repairs", "Refractory repair", "Certified welding"] },
  { title: "Burner Service", desc: "Precisely adjust boiler burners for peak efficiency. Even 2% improvement saves thousands annually.", bullets: ["Conversion & replacement", "Gas/Oil/Alternative fuels", "Low & Ultra Low NOx burners"] },
  { title: "Controls", desc: "Full controls testing, repair, and upgrades including SCADA systems.", bullets: ["Calibration & replacements", "Combustion control upgrades", "Flame safety testing", "SCADA systems"] },
];

const stats = [
  { value: "51+", label: "Years of Service" },
  { value: "24/7", label: "Emergency Response" },
  { value: "100%", label: "Factory Trained" },
  { value: "1974", label: "Est. Warren, MI" },
];

const DJConleyDemo1 = () => {
  const [activeService, setActiveService] = useState(0);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <SEOHead
        title="D.J. Conley Associates — Industrial Boiler Solutions Since 1974"
        description="Michigan's trusted manufacturer's rep for Cleaver-Brooks boilers, heat recovery, and 24/7 service. 51 years of industrial energy expertise."
        path="/demo-djconley-1"
      />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">D.J. CONLEY</span>
              <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-slate-400">Associates, Inc.</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <a href="#about" className="hover:text-red-400 transition-colors">About</a>
            <a href="#products" className="hover:text-red-400 transition-colors">Products</a>
            <a href="#service" className="hover:text-red-400 transition-colors">Service</a>
            <a href="#contact" className="hover:text-red-400 transition-colors">Contact</a>
          </div>
          <a href="tel:248-589-8220" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">248-589-8220</span>
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://djconley.com/wp-content/uploads/2019/11/Since-1974-photo.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/60" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-600/40 text-red-400 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6">
              <Shield className="w-3.5 h-3.5" />
              51 Years of Exceptional Service
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] mb-6">
              A Name You Can{" "}
              <span className="text-red-500">TRUST.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg mb-8 leading-relaxed">
              Manufacturer's Rep & Distributor for energy conversion and conservation — steam, hot water, and heat recovery solutions for Michigan's industrial backbone.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => setShowForm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-base font-bold rounded-lg"
              >
                Request a Quote <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <a href="tel:248-589-8220">
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 px-8 py-6 text-base rounded-lg">
                  <PhoneCall className="w-5 h-5 mr-2" /> Call Now
                </Button>
              </a>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-xl p-6 text-center">
                <div className="text-3xl font-black text-red-500 mb-1">{s.value}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <a href="#about" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-red-500" />
        </a>
      </section>

      {/* About */}
      <section id="about" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-black mb-6">
                The <span className="text-red-500">DJ Conley</span> Story
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                D.J. Conley Associates, Inc. is a Manufacturer's Rep/Distributor engaged in energy conversion and conservation as it relates to the production of steam, hot water and heat recovery. Our commitment to providing quality products and comprehensive solutions, backed by our reputation for excellence, has allowed us to sustain trusted relationships with the businesses we serve.
              </p>
              <p className="text-slate-300 leading-relaxed mb-6">
                For over 50 years, we've proudly served our community, building a legacy of quality, reliability, and unwavering commitment to customer satisfaction. Through dedication to innovation and a deep understanding of our customers' needs, we've navigated evolving markets and remained a trusted partner.
              </p>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-red-400">
                  <MapPin className="w-5 h-5" />
                  <span className="text-sm">26225 Sherwood, Warren, MI 48091</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700">
                <iframe
                  src="https://www.youtube.com/embed/L4hK8ftpbp0"
                  title="The DJ Conley Story"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">
              Industrial-Grade <span className="text-red-500">Products</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Whether you want to reduce fuel costs, lower emissions or increase efficiency — from planning and design through delivery and start-up.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p, i) => (
              <div key={i} className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-red-600/50 transition-all duration-300">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                      <p.icon className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold">{p.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-slate-500 text-sm">Rentals also available for temporary boiler needs</p>
          </div>
        </div>
      </section>

      {/* Service */}
      <section id="service" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-4">
              <Wrench className="w-3.5 h-3.5" />
              24/7 Emergency Service
            </div>
            <h2 className="text-3xl font-black mb-4">
              Service <span className="text-red-500">When You Need It</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Factory-trained professionals providing expert boiler service from planned maintenance to unexpected repairs. Field vehicles stocked with emergency parts.
            </p>
          </div>
          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
              {services.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveService(i)}
                  className={`text-left px-4 py-3 rounded-xl whitespace-nowrap lg:whitespace-normal text-sm font-semibold transition-all ${
                    activeService === i
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-4">{services[activeService].title}</h3>
              <p className="text-slate-300 mb-6 leading-relaxed">{services[activeService].desc}</p>
              <ul className="space-y-3">
                {services[activeService].bullets.map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex gap-4">
                <a href="mailto:service@djconley.com">
                  <Button className="bg-red-600 hover:bg-red-700 text-white">
                    <Mail className="w-4 h-4 mr-2" /> Request Service
                  </Button>
                </a>
                <a href="tel:248-589-8220">
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                    <Phone className="w-4 h-4 mr-2" /> Call 24/7
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Gallery */}
      <section className="py-16 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Featured <span className="text-red-500">Equipment</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              "https://djconley.com/wp-content/uploads/2020/04/1.-CFH_Skid.png",
              "https://djconley.com/wp-content/uploads/2020/04/7.-CBEX-1000x999-1.jpg",
              "https://djconley.com/wp-content/uploads/2020/04/8.-CFC-E-1000x999-1.jpg",
              "https://djconley.com/wp-content/uploads/2020/03/7.-Vapor-Power_Circulatic.jpg",
            ].map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-800">
                <img src={img} alt={`Equipment ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Quote Form */}
      <section id="contact" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-black mb-6">
                Get In <span className="text-red-500">Touch</span>
              </h2>
              <p className="text-slate-300 mb-8 leading-relaxed">
                Whether you need emergency service, a quote on new equipment, or parts — our team is ready to help. Serving Michigan and surrounding areas since 1974.
              </p>
              <div className="space-y-6">
                <a href="tel:248-589-8220" className="flex items-center gap-4 text-slate-300 hover:text-red-400 transition-colors">
                  <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Phone</div>
                    <div className="font-semibold">248-589-8220</div>
                  </div>
                </a>
                <div className="space-y-2">
                  <a href="mailto:equipment.sales@djconley.com" className="flex items-center gap-4 text-slate-300 hover:text-red-400 transition-colors">
                    <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
                      <Mail className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Sales</div>
                      <div className="font-semibold">equipment.sales@djconley.com</div>
                    </div>
                  </a>
                  <a href="mailto:service@djconley.com" className="flex items-center gap-4 text-slate-300 hover:text-red-400 transition-colors pl-16">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Service</div>
                      <div className="font-semibold">service@djconley.com</div>
                    </div>
                  </a>
                  <a href="mailto:parts@djconley.com" className="flex items-center gap-4 text-slate-300 hover:text-red-400 transition-colors pl-16">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Parts</div>
                      <div className="font-semibold">parts@djconley.com</div>
                    </div>
                  </a>
                </div>
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Location</div>
                    <div className="font-semibold">26225 Sherwood, Warren, MI 48091</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6">Request a Quote</h3>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Your Name" className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none" />
                  <input type="text" placeholder="Company" className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none" />
                </div>
                <input type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none" />
                <input type="tel" placeholder="Phone" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none" />
                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-400 focus:border-red-500 focus:outline-none">
                  <option value="">Select Inquiry Type</option>
                  <option>New Equipment Quote</option>
                  <option>Service Request</option>
                  <option>Parts Order</option>
                  <option>Rental Inquiry</option>
                  <option>Emergency Service</option>
                </select>
                <textarea placeholder="Tell us about your needs..." rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none resize-none" />
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-base font-bold rounded-lg">
                  Submit Request <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">D.J. CONLEY ASSOCIATES, INC.</span>
            </div>
            <p className="text-slate-500 text-sm">© 2026 D.J. Conley Associates, Inc. All rights reserved.</p>
            <div className="text-slate-500 text-xs text-center">
              Website by <a href="https://mattmichelstraining.com/web-design" className="text-red-400 hover:text-red-300">M2 Development</a>
            </div>
          </div>
        </div>
      </footer>

      {/* M2 Dev Badge */}
      <div className="fixed bottom-4 right-4 z-50 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-3 py-1.5 text-[10px] text-slate-500">
        Demo by M2 Development
      </div>
    </div>
  );
};

export default DJConleyDemo1;
