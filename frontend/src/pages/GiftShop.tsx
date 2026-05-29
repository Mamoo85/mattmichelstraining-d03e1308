import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import ExitIntentPopup from "@/components/gng/ExitIntentPopup";
import GiftShopSearch from "@/components/gng/GiftShopSearch";
import { podSupabase } from "@/integrations/supabase/podClient";

const ETSY_SHOP = "https://www.etsy.com/shop/GuildsAndGrains"; // TODO: confirm exact slug after Etsy rename
const SITE_URL = "https://www.mattmichelstraining.com";

const CATEGORIES = [
  { slug: "nurse-gifts",      label: "Nurse Gifts",       emoji: "🩺" },
  { slug: "teacher-gifts",    label: "Teacher Gifts",     emoji: "🍎" },
  { slug: "dog-mom-gifts",    label: "Dog Mom Gifts",     emoji: "🐶" },
  { slug: "cat-mom-gifts",    label: "Cat Mom Gifts",     emoji: "🐱" },
  { slug: "funny-mugs",       label: "Funny Mugs",        emoji: "☕" },
  { slug: "retirement-gifts", label: "Retirement Gifts",  emoji: "🎉" },
  { slug: "for-mom",          label: "Gifts for Mom",     emoji: "💐" },
  { slug: "birthday-gifts",   label: "Birthday Gifts",    emoji: "🎂" },
  { slug: "coffee-lovers",    label: "Coffee Lovers",     emoji: "☕" },
  { slug: "funny-gifts",      label: "Funny Gifts",       emoji: "😂" },
  { slug: "christmas-gifts",  label: "Christmas Gifts",   emoji: "🎄" },
  { slug: "coworker-gifts",   label: "Coworker Gifts",    emoji: "💼" },
];

const TRUST_BADGES = [
  { icon: "🚚", label: "Free US Shipping" },
  { icon: "⭐", label: "5-Star Rated" },
  { icon: "🎨", label: "Made to Order" },
  { icon: "↩️", label: "30-Day Returns" },
];

const REVIEW_QUOTES = [
  { text: "Absolutely love my nurse mug — the quality is amazing!", author: "Sarah T." },
  { text: "Perfect gift for my teacher. She laughed so hard!", author: "Mike R." },
  { text: "Fast shipping, great quality. Will order again!", author: "Jennifer L." },
  { text: "The dog mom socks are adorable. My mom loved them!", author: "Emma K." },
  { text: "Great coffee mug, dishwasher safe and vibrant colors.", author: "David M." },
];

type Listing = {
  listing_id: string;
  title: string;
  price_usd: number;
  listing_url: string;
  main_image: string | null;
  tags?: string[];
  num_favorers?: number;
  created_timestamp?: number | null;
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Guilds & Grains Gift Shop",
  "url": `${SITE_URL}/gifts`,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${ETSY_SHOP}?search_query={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <a
      href={listing.listing_url || ETSY_SHOP}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all bg-white"
    >
      <div className="aspect-square overflow-hidden bg-gray-50">
        {listing.main_image ? (
          <img
            src={listing.main_image}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🎁</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{listing.title}</p>
        <p className="mt-1 text-orange-600 font-semibold text-sm">
          ${listing.price_usd ? Number(listing.price_usd).toFixed(2) : "—"}
        </p>
      </div>
    </a>
  );
}

export default function GiftShop() {
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [bestsellers, setBestsellers] = useState<Listing[]>([]);
  const [newDrops, setNewDrops] = useState<Listing[]>([]);
  const [searchResults, setSearchResults] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    (async () => {
      const { data } = await podSupabase
        .from("etsy_listings")
        .select("listing_id, title, price_usd, listing_url, main_image, tags, num_favorers, created_timestamp")
        .eq("status", "active")
        .not("main_image", "is", null)
        .limit(200);

      const listings: Listing[] = data || [];
      setAllListings(listings);
      setBestsellers([...listings].sort((a, b) => (b.num_favorers ?? 0) - (a.num_favorers ?? 0)).slice(0, 12));
      setNewDrops([...listings].sort((a, b) => (b.created_timestamp ?? 0) - (a.created_timestamp ?? 0)).slice(0, 6));
      setLoading(false);
    })();
  }, []);

  const handleSearchResults = useCallback((results: Listing[] | null) => {
    setSearchResults(results);
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setEmailStatus("loading");
    await podSupabase.from("etsy_email_signups").insert({
      email: emailInput.trim().toLowerCase(),
      source: "inline_form",
    }).catch(() => {});
    setEmailStatus("done");
  };

  const displayedListings = searchResults ?? bestsellers;

  // Build ItemList JSON-LD from top 12 bestsellers for SEO
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Top Gifts — Guilds & Grains Gift Shop",
    "url": `${SITE_URL}/gifts`,
    "numberOfItems": bestsellers.length,
    "itemListElement": bestsellers.slice(0, 12).map((l, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Product",
        "name": l.title,
        "url": l.listing_url || ETSY_SHOP,
        "image": l.main_image ?? undefined,
        "offers": {
          "@type": "Offer",
          "price": l.price_usd,
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "shippingDetails": {
            "@type": "OfferShippingDetails",
            "shippingRate": { "@type": "MonetaryAmount", "value": 0, "currency": "USD" },
          },
        },
      },
    })),
  };

  return (
    <>
      <SEOHead
        title="Unique Gifts for Nurses, Teachers & Dog Moms — Free US Shipping"
        description="Shop funny mugs, shirts, socks, and personalized gifts for nurses, teachers, dog moms, and more. Free shipping in the US. Made fresh, ships in 3–5 days."
        path="/gifts"
        type="website"
        jsonLd={[websiteSchema, itemListSchema]}
      />

      <div className="min-h-screen bg-white">

        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 py-16 px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Gifts They'll Actually Love
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto mb-6">
            Funny mugs, shirts, socks and personalized gifts for nurses, teachers, dog moms &amp; more.
            Free US shipping on everything. Ships in 3–5 days.
          </p>

          {/* Search bar */}
          <div className="mb-6">
            <GiftShopSearch allListings={allListings} onResults={handleSearchResults} />
          </div>

          <Link
            to="/gng"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-full text-lg transition-colors shadow-md"
          >
            Shop All Gifts →
          </Link>
        </section>

        {/* ── Trust badges ── */}
        <section className="border-y border-gray-100 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap justify-center gap-6">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-lg">{b.icon}</span>
                <span className="font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Shop by Category ── */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Shop by Category</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/gifts/${cat.slug}`}
                className="flex flex-col items-center p-3 rounded-xl border border-gray-200 hover:border-orange-400 hover:shadow-md transition-all text-center"
              >
                <span className="text-2xl mb-1">{cat.emoji}</span>
                <span className="font-medium text-gray-700 text-xs leading-tight">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Bestsellers / Search results ── */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {searchResults
              ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`
              : "Bestsellers"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-gray-100 animate-pulse aspect-[3/4]" />
              ))}
            </div>
          ) : displayedListings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedListings.slice(0, 12).map((l) => (
                <ListingCard key={l.listing_id} listing={l} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {searchResults ? "No results — try a different search" : "No listings found yet."}
              </p>
              <Link to="/gng"
                className="text-orange-500 underline font-medium">Browse all gifts →</Link>
            </div>
          )}

          {!searchResults && (
            <div className="mt-6 text-center">
              <Link
                to="/gng"
                className="inline-block border border-orange-400 text-orange-600 hover:bg-orange-50 font-semibold px-6 py-2.5 rounded-full text-sm transition-colors"
              >
                See all {allListings.length || "280"}+ gifts →
              </Link>
            </div>
          )}
        </section>

        {/* ── New Drops ── */}
        {!searchResults && newDrops.length > 0 && (
          <section className="bg-orange-50 py-12">
            <div className="max-w-6xl mx-auto px-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">New Drops 🆕</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {newDrops.map((l) => (
                  <ListingCard key={l.listing_id} listing={l} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Email capture strip ── */}
        <section className="bg-gray-900 text-white py-12 px-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Get 10% off your first order</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Subscribe for new drops, gift ideas, and exclusive discounts.
          </p>

          {emailStatus === "done" ? (
            <p className="text-orange-400 font-semibold">
              🎉 Thanks! Check your email for your coupon code.
            </p>
          ) : (
            <form
              onSubmit={handleEmailSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
            >
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-orange-400"
              />
              <button
                type="submit"
                disabled={emailStatus === "loading"}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-full text-sm transition-colors whitespace-nowrap"
              >
                {emailStatus === "loading" ? "Sending…" : "Get 10% Off"}
              </button>
            </form>
          )}
          <p className="text-gray-600 text-xs mt-3">No spam. Unsubscribe anytime.</p>
        </section>

        {/* ── Reviews ── */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">⭐⭐⭐⭐⭐ What Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {REVIEW_QUOTES.slice(0, 3).map((r, i) => (
              <div key={i} className="bg-orange-50 rounded-xl p-5">
                <p className="text-gray-700 text-sm italic mb-3">"{r.text}"</p>
                <p className="text-gray-500 text-xs font-medium">— {r.author}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Exit-intent popup — fires on mouse leave viewport */}
      <ExitIntentPopup />
    </>
  );
}
