import {
  BarChart3, Globe, MapPin, TrendingUp, FileSearch,
  MessageSquare, RefreshCw, Calendar, Phone, Bot,
  type LucideIcon,
} from "lucide-react";

export interface AddOn {
  key: string;
  icon: LucideIcon;
  name: string;
  price: string;
  priceSub: string;
  priceCents: number; // monthly price in cents for Stripe
  color: string;
  desc: string;
  includes: string[];
  recurring: boolean;
}

export const ADD_ONS: AddOn[] = [
  {
    key: "google_ads",
    icon: BarChart3,
    name: "Google Ads Management",
    price: "$99/mo",
    priceSub: "add-on to any plan",
    priceCents: 9900,
    color: "#4285f4",
    desc: "I set up and manage your Google Ads campaigns — keyword research, ad copy, bidding, and monthly reporting. You only pay for clicks that matter.",
    includes: [
      "Campaign setup & keyword research",
      "Ad copy written and A/B tested",
      "Bid management & budget control",
      "Monthly performance report",
      "Direct communication — no agency middleman",
    ],
    recurring: true,
  },
  {
    key: "content_package",
    icon: Globe,
    name: "Monthly Content Package",
    price: "$79/mo",
    priceSub: "add-on to any plan",
    priceCents: 7900,
    color: "#7c3aed",
    desc: "Done-for-you content every month — 4 social posts, 1 blog article, and a monthly email newsletter. Written in your voice, posted on your schedule.",
    includes: [
      "4 Instagram/Facebook posts with captions",
      "1 SEO blog article (600–800 words)",
      "Monthly email newsletter",
      "Hashtag strategy included",
      "Content calendar delivered on the 1st",
    ],
    recurring: true,
  },
  {
    key: "gbp_management",
    icon: MapPin,
    name: "Google Business Profile Management",
    price: "$49/mo",
    priceSub: "ongoing management",
    priceCents: 4900,
    color: "#059669",
    desc: "Your GBP is often the first thing customers see. I optimize your profile, add weekly posts, and respond to reviews — so you rank higher on Google Maps.",
    includes: [
      "Full profile setup & optimization",
      "4 GBP posts per month",
      "Review response management",
      "Photo uploads & service updates",
      "Monthly ranking check",
    ],
    recurring: true,
  },
  {
    key: "local_seo_pages",
    icon: TrendingUp,
    name: "Local SEO Landing Pages",
    price: "$299",
    priceSub: "10-page package · one-time",
    priceCents: 29900,
    color: "#d97706",
    desc: "Get found for 10 local search terms. I build dedicated pages targeting keywords like 'plumber Grosse Pointe' or 'electrician Harper Woods'.",
    includes: [
      "10 keyword-targeted landing pages",
      "Location-specific copy on each page",
      "SEO meta tags & schema markup",
      "Submitted to Google Search Console",
      "Linked from your main site",
    ],
    recurring: false,
  },
  {
    key: "website_audit",
    icon: FileSearch,
    name: "Website Audit & Report",
    price: "$49",
    priceSub: "one-time · any website",
    priceCents: 4900,
    color: "#dc2626",
    desc: "Not sure why your site isn't converting? I run a full audit — speed, SEO, mobile experience, call-to-action placement — and send you a plain-English report.",
    includes: [
      "Page speed & Core Web Vitals check",
      "SEO & keyword gap analysis",
      "Mobile usability review",
      "Conversion rate issues identified",
      "Prioritized fix list delivered within 48 hrs",
    ],
    recurring: false,
  },
  {
    key: "review_response",
    icon: MessageSquare,
    name: "Reputation & Review Management",
    price: "$79/mo",
    priceSub: "ongoing service",
    priceCents: 7900,
    color: "#0891b2",
    desc: "I monitor your Google and Yelp reviews and write professional responses within 24 hours — good or bad.",
    includes: [
      "Monitor Google, Yelp & Facebook reviews",
      "Professional responses within 24 hours",
      "Monthly reputation summary report",
      "Strategy for generating more 5-star reviews",
      "Negative review escalation handling",
    ],
    recurring: true,
  },
  {
    key: "website_refresh",
    icon: RefreshCw,
    name: "Website Refresh",
    price: "$199",
    priceSub: "one-time",
    priceCents: 19900,
    color: "#7c3aed",
    desc: "Already have a site but it looks dated? I'll rewrite your homepage copy, update CTAs, fix mobile issues, and modernize the layout.",
    includes: [
      "Full homepage copy rewrite",
      "Updated call-to-action buttons & placement",
      "Mobile responsiveness fixes",
      "Speed optimization pass",
      "1 round of revisions included",
    ],
    recurring: false,
  },
  {
    key: "missed_call",
    icon: Phone,
    name: "Missed Call Text-Back",
    price: "$99/mo",
    priceSub: "never lose a lead",
    priceCents: 9900,
    color: "#e8621a",
    desc: "When someone calls and you can't answer, our system instantly texts them back — capturing the lead before they call your competitor.",
    includes: [
      "Instant SMS auto-reply on missed calls",
      "Customizable response templates",
      "Lead capture & notification to you",
      "Works with your existing business number",
      "Monthly analytics report",
    ],
    recurring: true,
  },
  {
    key: "chatbot_widget",
    icon: Bot,
    name: "AI Chatbot Widget",
    price: "$149/mo",
    priceSub: "24/7 lead capture",
    priceCents: 14900,
    color: "#6366f1",
    desc: "A smart chat widget on your website that answers FAQs, captures leads, and books appointments — even at 2am.",
    includes: [
      "Custom-trained on your business info",
      "Lead capture with email/phone collection",
      "Appointment booking integration",
      "Chat transcripts emailed to you",
      "Monthly performance summary",
    ],
    recurring: true,
  },
];

export const getAddonByKey = (key: string) => ADD_ONS.find((a) => a.key === key);
