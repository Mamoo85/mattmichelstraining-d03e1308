import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Loader2, Phone, Mail, MapPin, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteData {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  sections: any[];
  color_scheme: { primary: string; secondary: string; accent: string };
  template_key: string;
}

const ClientSite = () => {
  const { slug } = useParams<{ slug: string }>();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchSite = async () => {
      const { data, error: fetchErr } = await supabase
        .from("generated_sites_public" as any)
        .select("*")
        .eq("slug", slug)
        .single();
      if (fetchErr || !data) {
        setError("Site not found");
      } else {
        setSite(data as any);
      }
      setLoading(false);
    };
    fetchSite();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !site) return <div className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-500">Site not found</p></div>;

  const { primary, secondary, accent } = site.color_scheme;
  const getSection = (key: string) => site.sections.find((s: any) => s.key === key);

  const hero = getSection("hero")?.content;
  const services = getSection("services")?.content || getSection("menu")?.content;
  const about = getSection("about")?.content;
  const testimonials = getSection("testimonials")?.content;
  const faq = getSection("faq")?.content;
  const cta = getSection("cta")?.content;
  const contact = getSection("contact")?.content;
  const team = getSection("team")?.content;

  return (
    <>
      <SEOHead
        title={`${site.business_name} | Professional Website`}
        description={hero?.subheadline || `Welcome to ${site.business_name}`}
      />
      <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Sticky Nav */}
        <nav className="sticky top-0 z-50 px-4 py-3 shadow-sm" style={{ backgroundColor: secondary }}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-white font-bold text-lg">{site.business_name}</span>
            {site.phone && (
              <a href={`tel:${site.phone.replace(/\D/g, "")}`} className="text-white text-sm flex items-center gap-1 hover:opacity-80">
                <Phone className="h-4 w-4" /> {site.phone}
              </a>
            )}
          </div>
        </nav>

        {/* Hero */}
        {hero && (
          <section className="relative py-20 px-4 text-white text-center" style={{ backgroundColor: primary }}>
            <div className="max-w-3xl mx-auto">
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{hero.headline}</h1>
              <p className="text-lg md:text-xl opacity-90 mb-8">{hero.subheadline}</p>
              {site.phone ? (
                <a href={`tel:${site.phone.replace(/\D/g, "")}`}>
                  <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: accent, color: secondary }}>
                    {hero.cta_text || "Call Now"}
                  </Button>
                </a>
              ) : (
                <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: accent, color: secondary }}>
                  {hero.cta_text || "Get Started"}
                </Button>
              )}
              {hero.cta_subtext && <p className="text-sm opacity-70 mt-3">{hero.cta_subtext}</p>}
            </div>
          </section>
        )}

        {/* Services / Menu */}
        {services && (
          <section className="py-16 px-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: secondary }}>
                {services.title || "Our Services"}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {services.items?.map((item: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border-t-4" style={{ borderColor: primary }}>
                    <h3 className="font-semibold text-lg mb-2" style={{ color: secondary }}>{item.title}</h3>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                    {item.price && <p className="mt-2 font-bold text-sm" style={{ color: primary }}>{item.price}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About */}
        {about && (
          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: secondary }}>
                {about.title || "About Us"}
              </h2>
              {about.paragraphs?.map((p: string, i: number) => (
                <p key={i} className="text-gray-600 mb-4 leading-relaxed">{p}</p>
              ))}
              {about.highlights && (
                <div className="grid grid-cols-3 gap-4 mt-8">
                  {about.highlights.map((h: any, i: number) => (
                    <div key={i} className="text-center p-4 rounded-lg" style={{ backgroundColor: `${primary}10` }}>
                      <p className="text-2xl font-bold" style={{ color: primary }}>{h.value}</p>
                      <p className="text-sm text-gray-600 mt-1">{h.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Team */}
        {team && (
          <section className="py-16 px-4 bg-gray-50">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: secondary }}>
                {team.title || "Our Team"}
              </h2>
              <div className="grid gap-6 sm:grid-cols-3">
                {team.members?.map((m: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl p-6 text-center shadow-sm">
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: primary }}>
                      {m.name?.charAt(0) || "?"}
                    </div>
                    <h3 className="font-semibold" style={{ color: secondary }}>{m.name}</h3>
                    <p className="text-sm" style={{ color: primary }}>{m.title}</p>
                    <p className="text-gray-600 text-sm mt-2">{m.bio}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Testimonials */}
        {testimonials && (
          <section className="py-16 px-4" style={{ backgroundColor: `${secondary}08` }}>
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: secondary }}>
                {testimonials.title || "What Our Clients Say"}
              </h2>
              <div className="grid gap-6 sm:grid-cols-3">
                {testimonials.items?.map((t: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(t.rating || 5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-600 text-sm italic mb-4">"{t.text}"</p>
                    <p className="font-semibold text-sm" style={{ color: secondary }}>— {t.name}</p>
                    {t.detail && <p className="text-xs text-gray-500">{t.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq && (
          <section className="py-16 px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ color: secondary }}>
                {faq.title || "Frequently Asked Questions"}
              </h2>
              <div className="space-y-3">
                {faq.items?.map((item: any, i: number) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left font-medium hover:bg-gray-50"
                      style={{ color: secondary }}
                    >
                      {item.question}
                      {openFaq === i ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-4 text-sm text-gray-600">{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        {cta && (
          <section className="py-16 px-4 text-white text-center" style={{ backgroundColor: primary }}>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{cta.headline}</h2>
              <p className="text-lg opacity-90 mb-8">{cta.subtext}</p>
              {site.phone ? (
                <a href={`tel:${site.phone.replace(/\D/g, "")}`}>
                  <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: accent, color: secondary }}>
                    {cta.button_text || "Call Now"}
                  </Button>
                </a>
              ) : (
                <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: accent, color: secondary }}>
                  {cta.button_text || "Get Started"}
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Contact */}
        {contact && (
          <section className="py-16 px-4" style={{ backgroundColor: secondary }}>
            <div className="max-w-4xl mx-auto text-center text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{contact.title || "Contact Us"}</h2>
              <p className="opacity-80 mb-8">{contact.description}</p>
              <div className="grid gap-6 sm:grid-cols-3 text-sm">
                {contact.phone && (
                  <div className="flex flex-col items-center gap-2">
                    <Phone className="h-6 w-6" style={{ color: accent }} />
                    <a href={`tel:${contact.phone.replace(/\D/g, "")}`} className="hover:underline">{contact.phone}</a>
                  </div>
                )}
                {contact.email && (
                  <div className="flex flex-col items-center gap-2">
                    <Mail className="h-6 w-6" style={{ color: accent }} />
                    <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.address && (
                  <div className="flex flex-col items-center gap-2">
                    <MapPin className="h-6 w-6" style={{ color: accent }} />
                    <span>{contact.address}</span>
                  </div>
                )}
              </div>
              {contact.hours && <p className="mt-6 text-sm opacity-70">{contact.hours}</p>}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="py-6 px-4 text-center text-xs text-gray-400 bg-gray-50">
          <p>© {new Date().getFullYear()} {site.business_name}. All rights reserved.</p>
          <p className="mt-1">Built by <a href="https://www.mattmichelstraining.com/web-design-services" className="hover:underline" style={{ color: primary }}>M2 Development</a></p>
        </footer>
      </div>
    </>
  );
};

export default ClientSite;
