import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { podSupabase } from "@/integrations/supabase/podClient";

const SITE_URL = "https://www.mattmichelstraining.com";

const CATEGORY_MAP: Record<string, {
  label: string;
  emoji: string;
  description: string;
  faqs: Array<{ q: string; a: string }>;
  keywords: string[];
}> = {
  "nurse-gifts": {
    label: "Nurse Gifts",
    emoji: "🩺",
    description: "Funny and heartfelt gifts for nurses — mugs, shirts, and more. Perfect for Nurses Week, graduation, or any day that deserves a thank-you.",
    keywords: ["nurse"],
    faqs: [
      { q: "What's a good gift for a nurse?", a: "Our Funny Nurse Mug is a best-seller. It's practical, hilarious, and ships free — perfect for Nurses Week or any appreciation moment." },
      { q: "Do you have nurse graduation gifts?", a: "Yes! We have nurse shirts and mugs perfect for new grad nurses. Free US shipping on everything." },
      { q: "What nurse gifts are under $25?", a: "Most of our nurse mugs and tumblers are $14.99–$22.99 with free US shipping included." },
    ],
  },
  "teacher-gifts": {
    label: "Teacher Gifts",
    emoji: "🍎",
    description: "Thoughtful gifts for teachers that they'll actually use. Mugs, shirts, and personalized items — perfect for Teacher Appreciation Week.",
    keywords: ["teacher"],
    faqs: [
      { q: "What's a good Teacher Appreciation Week gift?", a: "A personalized teacher mug or tote bag makes a great Teacher Appreciation gift. We have funny and sweet options starting at $14.99 with free US shipping." },
      { q: "What teacher gifts ship fast?", a: "Our print-on-demand products ship in 3–5 business days with free US shipping on every order." },
    ],
  },
  "dog-mom-gifts": {
    label: "Dog Mom Gifts",
    emoji: "🐶",
    description: "Gifts for the dog mom in your life. Funny mugs, shirts, and tumblers celebrating her furry best friend.",
    keywords: ["dog"],
    faqs: [
      { q: "What's a funny gift for a dog mom?", a: "Our Dog Mom mugs are a hit — they're funny, practical, and come with free US shipping. Perfect for birthdays or just because." },
      { q: "What dog mom gifts are available?", a: "We carry dog mom mugs, t-shirts, tumblers, and socks — all with free US shipping." },
    ],
  },
  "cat-mom-gifts": {
    label: "Cat Mom Gifts",
    emoji: "🐱",
    description: "Gifts for cat moms — mugs, shirts, and accessories celebrating the cat lady lifestyle.",
    keywords: ["cat"],
    faqs: [
      { q: "What's a good gift for a cat mom?", a: "Our cat mom mugs and t-shirts are perfect. Funny, affordable, and ships free in the US." },
    ],
  },
  "funny-mugs": {
    label: "Funny Mugs",
    emoji: "☕",
    description: "Hilarious coffee mugs for every occasion. Nurse mugs, office mugs, dog mom mugs, and more — all with free US shipping.",
    keywords: ["mug", "coffee"],
    faqs: [
      { q: "What are the funniest coffee mugs to give as gifts?", a: "Our nurse mugs and 'But First Coffee' designs are consistently top sellers. Great for white elephant gifts, birthdays, or just because." },
      { q: "Are your mugs dishwasher safe?", a: "Yes — our mugs are dishwasher and microwave safe. Premium quality ceramic with wraparound designs." },
    ],
  },
  "retirement-gifts": {
    label: "Retirement Gifts",
    emoji: "🎉",
    description: "Celebrate their next chapter with the perfect retirement gift. Funny mugs, shirts, and personalized items for the retiree in your life.",
    keywords: ["retire"],
    faqs: [
      { q: "What's a funny retirement gift?", a: "Our 'Officially Retired' mug collections are crowd favorites at retirement parties. Ships free in the US in 3–5 days." },
      { q: "What retirement gifts are under $30?", a: "Most of our retirement mugs and shirts are $14.99–$24.99 with free US shipping included." },
    ],
  },
  "for-mom": {
    label: "Gifts for Mom",
    emoji: "💐",
    description: "Thoughtful and funny gifts for Mom — mugs, shirts, socks and more. Perfect for Mother's Day, birthdays, or just because. Free US shipping.",
    keywords: ["mom", "mother", "mama"],
    faqs: [
      { q: "What's a good gift for Mom?", a: "Our personalized mugs and funny 'Mom' shirts are bestsellers. Great for Mother's Day or any occasion, with free US shipping." },
      { q: "What gifts for Mom are under $25?", a: "Most of our mugs and socks are $14.99–$22.99 with free US shipping included." },
    ],
  },
  "for-dad": {
    label: "Gifts for Dad",
    emoji: "👨",
    description: "Hilarious and heartfelt gifts for Dad. Funny mugs, shirts, and personalized gifts he'll actually use. Free US shipping.",
    keywords: ["dad", "father", "papa"],
    faqs: [
      { q: "What's a funny gift for Dad?", a: "Our 'World's Okayest Dad' mug and dad-joke shirts are crowd favorites — great for Father's Day or birthdays." },
      { q: "What dad gifts ship fast?", a: "All our products ship in 3–5 business days with free US shipping." },
    ],
  },
  "under-25": {
    label: "Gifts Under $25",
    emoji: "💵",
    description: "Great gifts for everyone under $25, with free US shipping. Funny mugs, socks, and personalized items that won't break the bank.",
    keywords: ["mug", "sock", "gift", "funny"],
    faqs: [
      { q: "What are good gifts under $25?", a: "Our mugs ($14.99–$18.99) and socks ($14.99) are popular picks under $25 with free US shipping." },
      { q: "What cheap gifts are good quality?", a: "We use premium materials — ceramic mugs, soft crew socks, high-quality tees. Everything ships free in the US." },
    ],
  },
  "coffee-lovers": {
    label: "Coffee Lovers",
    emoji: "☕",
    description: "The perfect gifts for coffee addicts — funny mugs, tumblers, and shirts celebrating their caffeine obsession. Free US shipping.",
    keywords: ["coffee", "mug", "latte", "espresso", "caffeine"],
    faqs: [
      { q: "What's a good gift for a coffee lover?", a: "Our funny coffee mugs and travel tumblers are perfect for the coffee obsessed. Ships free in the US in 3–5 days." },
      { q: "Are your mugs microwave and dishwasher safe?", a: "Yes! Our ceramic mugs are microwave and dishwasher safe with vibrant, long-lasting designs." },
    ],
  },
  "wine-lovers": {
    label: "Wine Lovers",
    emoji: "🍷",
    description: "Gifts for wine enthusiasts — funny mugs, tumblers, shirts and socks celebrating the love of wine. Perfect for birthdays and holidays.",
    keywords: ["wine", "vineyard", "cabernet", "rosé"],
    faqs: [
      { q: "What's a funny gift for a wine lover?", a: "Our wine-themed mugs and tumblers are a hit — perfect for wine moms, birthday gifts, or white elephant exchanges." },
    ],
  },
  "birthday-gifts": {
    label: "Birthday Gifts",
    emoji: "🎂",
    description: "Fun and thoughtful birthday gifts for everyone — nurses, teachers, pet moms and more. Free US shipping, ships in 3–5 days.",
    keywords: ["birthday", "bday", "celebration", "party"],
    faqs: [
      { q: "What's a good last-minute birthday gift?", a: "Our funny mugs and shirts ship in 3–5 business days with free US shipping — perfect for birthdays." },
      { q: "What birthday gifts are personalized?", a: "Our mugs and shirts feature fun, occupation-specific designs — nurses, teachers, dog moms and more." },
    ],
  },
  "christmas-gifts": {
    label: "Christmas Gifts",
    emoji: "🎄",
    description: "Funny and festive Christmas gifts — mugs, socks, shirts and stocking stuffers for everyone on your list. Free US shipping.",
    keywords: ["christmas", "holiday", "xmas", "santa", "festive"],
    faqs: [
      { q: "What are good Christmas stocking stuffers?", a: "Our funny socks ($14.99) and mugs ($14.99–$18.99) are perfect stocking stuffers with free US shipping." },
      { q: "When do Christmas gifts need to be ordered?", a: "Order by December 17 for Christmas delivery with our standard 3–5 day production + 3–5 day US shipping." },
    ],
  },
  "coworker-gifts": {
    label: "Coworker Gifts",
    emoji: "💼",
    description: "Office-appropriate gifts for coworkers, bosses and work friends. Funny mugs, desk accessories and shirts perfect for the office.",
    keywords: ["office", "coworker", "boss", "work", "colleague"],
    faqs: [
      { q: "What's a good office gift?", a: "Our funny coffee mugs are perfect office gifts — professional enough for the boss, funny enough to get a laugh." },
      { q: "What coworker gifts are under $20?", a: "Our ceramic mugs start at $14.99 with free US shipping — great for Secret Santa or office gift exchanges." },
    ],
  },
  "funny-gifts": {
    label: "Funny Gifts",
    emoji: "😂",
    description: "The funniest gifts on the internet — hilarious mugs, socks and shirts that get real laughs. Perfect for white elephant, Secret Santa and birthdays.",
    keywords: ["funny", "humor", "hilarious", "joke", "sarcastic"],
    faqs: [
      { q: "What are the funniest gifts to give?", a: "Our nurse mugs, 'Dog Mom' socks and sarcastic coffee mugs are consistently our top-rated funny gifts." },
      { q: "What funny gifts work for white elephant?", a: "Funny mugs and novelty socks under $20 are perfect white elephant gifts. Ships free in the US." },
    ],
  },
  "pet-lover-gifts": {
    label: "Pet Lover Gifts",
    emoji: "🐾",
    description: "Gifts for the pet parents in your life — dog moms, cat moms and everyone obsessed with their furry family. Free US shipping.",
    keywords: ["dog", "cat", "pet", "puppy", "kitten", "paw"],
    faqs: [
      { q: "What's a good gift for a pet parent?", a: "Our dog mom and cat mom mugs, shirts and socks are bestsellers for pet lovers. Ships free in the US." },
      { q: "What pet lover gifts are under $20?", a: "Mugs at $14.99 and novelty socks at $14.99 are great picks with free US shipping." },
    ],
  },
};

type Listing = {
  listing_id: string;
  title: string;
  price_usd: number;
  listing_url: string;
  main_image: string | null;
  description: string | null;
};

export default function GiftShopCategory() {
  const { category } = useParams<{ category: string }>();
  const cat = CATEGORY_MAP[category || ""] ?? CATEGORY_MAP["funny-mugs"];

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cat) return;
    podSupabase
      .from("etsy_listings")
      .select("listing_id, title, description, price_usd, listing_url, main_image")
      .eq("status", "active")
      .or(cat.keywords.map((kw: string) => `title.ilike.%${kw}%`).join(","))
      .not("listing_url", "is", null)
      .limit(24)
      .then(({ data }: { data: Listing[] | null }) => {
        setListings(data || []);
        setLoading(false);
      });
  }, [category]);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": cat.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": { "@type": "Answer", "text": faq.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Gifts", "item": `${SITE_URL}/gifts` },
      { "@type": "ListItem", "position": 3, "name": cat.label, "item": `${SITE_URL}/gifts/${category}` },
    ],
  };

  return (
    <>
      <SEOHead
        title={`${cat.label} — Unique, Funny & Personalized — Free US Shipping`}
        description={cat.description}
        path={`/gifts/${category}`}
        type="website"
        jsonLd={{ "@context": "https://schema.org", "@graph": [faqSchema, breadcrumbSchema] }}
      />

      <div className="min-h-screen bg-white">
        {/* Breadcrumb */}
        <nav className="max-w-6xl mx-auto px-4 pt-6 text-sm text-gray-500">
          <Link to="/" className="hover:text-orange-500">Home</Link>
          {" / "}
          <Link to="/gifts" className="hover:text-orange-500">Gifts</Link>
          {" / "}
          <span className="text-gray-800">{cat.label}</span>
        </nav>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {cat.emoji} {cat.label}
          </h1>
          <p className="text-lg text-gray-600 mb-2">{cat.description}</p>
          <p className="text-sm text-green-600 font-medium">✓ Free US Shipping · Ships in 3–5 Days · 100% Satisfaction Guaranteed</p>
        </section>

        {/* Products */}
        <section className="max-w-6xl mx-auto px-4 pb-12">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-gray-100 h-64" />
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <a
                  key={listing.listing_id}
                  href={listing.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {listing.main_image && (
                    <div className="aspect-square overflow-hidden bg-gray-50">
                      <img
                        src={listing.main_image}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm text-gray-700 font-medium line-clamp-2 mb-1">{listing.title}</p>
                    <p className="text-orange-600 font-semibold">${(listing.price_usd || 18.99).toFixed(2)}</p>
                    <p className="text-xs text-green-600 mt-1">✓ Free Shipping</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-2">We're adding new {cat.label.toLowerCase()} all the time.</p>
              <p className="text-gray-500 mb-6">Browse everything currently available on Etsy:</p>
              <Link
                to="/gng"
                className="inline-block bg-orange-500 text-white font-semibold px-6 py-3 rounded-full hover:bg-orange-600 transition-colors"
              >
                Browse All Gifts →
              </Link>
            </div>
          )}

          {listings.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                to="/gng"
                className="inline-block border-2 border-orange-500 text-orange-500 font-semibold px-6 py-3 rounded-full hover:bg-orange-50 transition-colors"
              >
                See All Gifts →
              </Link>
            </div>
          )}
        </section>

        {/* FAQ Schema Section */}
        {cat.faqs.length > 0 && (
          <section className="bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {cat.faqs.map((faq, i) => (
                  <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-2">{faq.q}</h3>
                    <p className="text-gray-600 text-sm">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Back link */}
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <Link to="/gifts" className="text-orange-500 hover:text-orange-600 font-medium">
            ← Back to All Gift Categories
          </Link>
        </div>
      </div>
    </>
  );
}
