// Industry website templates — define section structure, default colors, and placeholder prompts
// AI fills content from client intake data using these templates

export interface TemplateSection {
  key: string;
  type: "hero" | "services" | "about" | "testimonials" | "gallery" | "cta" | "contact" | "faq" | "menu" | "team";
  label: string;
  promptHint: string; // guidance for AI content generation
}

export interface SiteTemplate {
  key: string;
  name: string;
  description: string;
  defaultColors: { primary: string; secondary: string; accent: string };
  sections: TemplateSection[];
}

export const SITE_TEMPLATES: Record<string, SiteTemplate> = {
  contractor: {
    key: "contractor",
    name: "Contractor / Home Services",
    description: "Perfect for plumbers, electricians, HVAC, roofers, landscapers, and general contractors.",
    defaultColors: { primary: "#1e40af", secondary: "#1e293b", accent: "#f59e0b" },
    sections: [
      { key: "hero", type: "hero", label: "Hero Banner", promptHint: "Bold headline about reliable local service. Include a strong call-to-action for a free estimate." },
      { key: "services", type: "services", label: "Services", promptHint: "6 core services this contractor offers. Each needs a title, short description, and icon suggestion." },
      { key: "about", type: "about", label: "About Us", promptHint: "Trustworthy company story. Mention years in business, local roots, family values, licensed & insured." },
      { key: "testimonials", type: "testimonials", label: "Reviews", promptHint: "3 realistic customer testimonials with first names and service type. Sound authentic, not generic." },
      { key: "gallery", type: "gallery", label: "Our Work", promptHint: "Section intro text about showcasing completed projects. Mention before/after quality." },
      { key: "faq", type: "faq", label: "FAQ", promptHint: "5 common questions homeowners ask this type of contractor. Practical, trust-building answers." },
      { key: "cta", type: "cta", label: "Call to Action", promptHint: "Urgent but friendly CTA. Free estimate, same-day service, or limited availability angle." },
      { key: "contact", type: "contact", label: "Contact", promptHint: "Contact section with phone, email, service area. Mention response time guarantee." },
    ],
  },
  restaurant: {
    key: "restaurant",
    name: "Restaurant / Food Service",
    description: "Ideal for restaurants, cafes, bars, bakeries, food trucks, and catering businesses.",
    defaultColors: { primary: "#dc2626", secondary: "#1c1917", accent: "#eab308" },
    sections: [
      { key: "hero", type: "hero", label: "Hero Banner", promptHint: "Appetizing headline that captures the restaurant's vibe. CTA for reservations or online ordering." },
      { key: "menu", type: "menu", label: "Menu Highlights", promptHint: "6 signature dishes with name, description, and price range. Make them sound delicious and unique." },
      { key: "about", type: "about", label: "Our Story", promptHint: "Restaurant origin story. Chef background, cuisine philosophy, local ingredients, community ties." },
      { key: "testimonials", type: "testimonials", label: "Reviews", promptHint: "3 realistic diner reviews. Mention specific dishes, atmosphere, and service quality." },
      { key: "gallery", type: "gallery", label: "Gallery", promptHint: "Section intro about the dining experience, ambiance, and food presentation." },
      { key: "cta", type: "cta", label: "Reservations", promptHint: "CTA for making a reservation, ordering online, or booking a private event." },
      { key: "contact", type: "contact", label: "Visit Us", promptHint: "Hours of operation, address, phone, parking info. Mention delivery/takeout options." },
    ],
  },
  professional: {
    key: "professional",
    name: "Professional Services",
    description: "For lawyers, accountants, consultants, insurance agents, financial advisors, and agencies.",
    defaultColors: { primary: "#0f766e", secondary: "#1e293b", accent: "#6366f1" },
    sections: [
      { key: "hero", type: "hero", label: "Hero Banner", promptHint: "Authoritative headline about expertise and results. CTA for a free consultation." },
      { key: "services", type: "services", label: "Practice Areas", promptHint: "6 service areas/specialties. Each needs a title and short value proposition." },
      { key: "about", type: "about", label: "About the Firm", promptHint: "Professional credibility story. Education, credentials, years of experience, client-first philosophy." },
      { key: "team", type: "team", label: "Our Team", promptHint: "3 team member bios with name, title, credentials, and a personal touch." },
      { key: "testimonials", type: "testimonials", label: "Client Results", promptHint: "3 client success stories. Mention outcomes, not just praise. Use first name and industry." },
      { key: "faq", type: "faq", label: "FAQ", promptHint: "5 questions prospective clients commonly ask. Answer with authority and empathy." },
      { key: "cta", type: "cta", label: "Get Started", promptHint: "Professional CTA for scheduling a consultation. Emphasize confidentiality and no-obligation." },
      { key: "contact", type: "contact", label: "Contact", promptHint: "Office address, phone, email, office hours. Mention virtual consultation availability." },
    ],
  },
};

export const getTemplate = (key: string): SiteTemplate | undefined => SITE_TEMPLATES[key];
export const templateKeys = Object.keys(SITE_TEMPLATES) as Array<keyof typeof SITE_TEMPLATES>;

// Generate a URL-safe slug from business name
export const generateSlug = (businessName: string): string => {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
};
