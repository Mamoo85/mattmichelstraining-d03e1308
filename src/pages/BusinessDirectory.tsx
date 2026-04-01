import { useState, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Phone, Globe, Star, Crown, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Listing {
  id: string;
  business_name: string;
  owner_name: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  tier: string;
  is_featured: boolean;
}

const INDUSTRIES = [
  "All Industries",
  "Roofing", "HVAC", "Plumbing", "Electrical", "Landscaping",
  "Auto Repair", "Dental", "Restaurant", "Salon", "Law Firm",
  "Real Estate", "Insurance", "Cleaning", "Construction", "Other"
];

const DirectoryCard = memo(({ listing }: { listing: Listing }) => {
  const isPremium = listing.tier === "premium" || listing.is_featured;

  return (
    <div className={`rounded-xl border p-5 transition-all hover:shadow-lg ${
      isPremium
        ? "border-[#e8621a]/40 bg-gradient-to-br from-card to-[#e8621a]/5 shadow-md ring-1 ring-[#e8621a]/20"
        : "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-foreground text-base truncate">{listing.business_name}</h3>
            {isPremium && (
              <Badge className="bg-[#e8621a] text-white text-[10px] px-1.5 py-0 shrink-0">
                <Crown className="h-3 w-3 mr-0.5" /> Featured
              </Badge>
            )}
          </div>
          {listing.industry && (
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{listing.industry}</span>
          )}
        </div>
        {listing.logo_url && (
          <img src={listing.logo_url} alt={listing.business_name} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border" />
        )}
      </div>

      {listing.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{listing.description}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {listing.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {listing.city}{listing.state ? `, ${listing.state}` : ""}
          </span>
        )}
        {listing.phone && (
          <a href={`tel:${listing.phone.replace(/\D/g, "")}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Phone className="h-3 w-3" /> {listing.phone}
          </a>
        )}
        {listing.website && (
          <a href={listing.website.startsWith("http") ? listing.website : `https://${listing.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#e8621a] transition-colors">
            <Globe className="h-3 w-3" /> Website <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
});
DirectoryCard.displayName = "DirectoryCard";

const BusinessDirectory = () => {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("All Industries");

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["business-directory"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("business_listings")
        .select("id, business_name, owner_name, industry, city, state, phone, email, website, description, logo_url, tier, is_featured")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("tier", { ascending: false })
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchSearch = !search || 
        l.business_name.toLowerCase().includes(search.toLowerCase()) ||
        l.city?.toLowerCase().includes(search.toLowerCase()) ||
        l.industry?.toLowerCase().includes(search.toLowerCase());
      const matchIndustry = industry === "All Industries" || l.industry?.toLowerCase() === industry.toLowerCase();
      return matchSearch && matchIndustry;
    });
  }, [listings, search, industry]);

  const premiumCount = filtered.filter(l => l.tier === "premium" || l.is_featured).length;

  return (
    <>
      <SEOHead
        title="Local Business Directory | M² Development"
        description="Find trusted local businesses in Michigan and beyond. Free listings for all businesses, premium featured placement available."
        path="/business-directory"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Local Business Directory",
          description: "Find trusted local businesses. Free listings with premium featured placement.",
          provider: { "@type": "Organization", name: "M² Development" },
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white py-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#e8621a]/20 rounded-full px-4 py-1.5 text-sm mb-5">
              <Star className="h-4 w-4 text-[#e8621a]" /> Local Business Marketplace
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">Find Trusted Local Businesses</h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mb-8">
              Browse verified local businesses across Michigan and beyond. Every listing is vetted.
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, city, or industry..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                />
              </div>
            </div>

            {/* Industry pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    industry === ind
                      ? "bg-[#e8621a] text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-[#e8621a] py-4 px-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white text-sm font-medium">
              Own a business? Get listed for <strong>FREE</strong> — or go premium for <strong>$29/mo</strong> with featured placement.
            </p>
            <a href="mailto:matt@mattmichelstraining.com?subject=Business%20Directory%20Listing">
              <Button size="sm" variant="outline" className="border-white text-white hover:bg-white/20 shrink-0">
                Get Listed <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </a>
          </div>
        </section>

        {/* Listings */}
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{filtered.length}</strong> businesses found
                {premiumCount > 0 && <> · <span className="text-[#e8621a]">{premiumCount} featured</span></>}
              </p>
            </div>

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <p className="text-muted-foreground mb-2">No businesses found matching your search.</p>
                <p className="text-sm text-muted-foreground">Try a different search term or industry filter.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((listing) => (
                  <DirectoryCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Premium Upsell */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white">
          <div className="max-w-3xl mx-auto text-center">
            <Crown className="h-10 w-10 text-[#e8621a] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Get Premium Featured Placement</h2>
            <p className="text-white/70 mb-6 max-w-xl mx-auto">
              Stand out from the crowd with a premium listing. Featured badge, top positioning, enhanced profile with logo and description.
            </p>
            <div className="inline-flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-[#e8621a]">$29</span>
              <span className="text-white/60">/month</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-sm text-left max-w-lg mx-auto mb-8">
              {[
                "⭐ Featured badge & top placement",
                "🖼️ Logo & enhanced description",
                "📈 Priority in search results",
                "🔗 Direct website link",
                "📞 Click-to-call phone number",
                "🚀 Cancel anytime",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-white/80">{f}</div>
              ))}
            </div>
            <a href="mailto:matt@mattmichelstraining.com?subject=Premium%20Business%20Listing&body=I'd%20like%20to%20upgrade%20to%20a%20premium%20listing.%20Business%20name:">
              <Button size="lg" className="bg-[#e8621a] hover:bg-[#d4570f] text-white text-lg px-8 py-6">
                Get Premium Listing
              </Button>
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 px-4 text-center text-xs text-muted-foreground bg-muted/20">
          <p>© {new Date().getFullYear()} M² Development — Local Business Directory</p>
          <p className="mt-1">
            <Link to="/web-design-services" className="text-[#e8621a] hover:underline">Web Design</Link>
            {" · "}
            <Link to="/all-services" className="text-[#e8621a] hover:underline">All Services</Link>
            {" · "}
            <Link to="/" className="text-[#e8621a] hover:underline">Home</Link>
          </p>
        </footer>
      </div>
    </>
  );
};

export default BusinessDirectory;
