/** 20 site widgets/gadgets Pat can toggle on his sandbox site. */
export interface Widget {
  id: string;
  name: string;
  description: string;
  category: "Conversion" | "Trust" | "Live Data" | "Engagement" | "Ops" | "Compliance";
  enabled: boolean;
  recommended?: boolean;
}

export const WIDGET_CATALOG: Widget[] = [
  { id: "live_visitor_ticker",   name: "Live Visitor Ticker",        description: "Anonymized counter: '3 facilities directors viewing this page right now.' Pulled from SiteRadar.", category: "Live Data",  enabled: true,  recommended: true },
  { id: "boiler_room_hero",      name: "Animated Boiler Room Hero",  description: "Subtle animated steam + glow on the homepage hero. Replaces the static slideshow.",          category: "Engagement", enabled: false, recommended: true },
  { id: "emergency_call_bar",    name: "Emergency Service Call Bar", description: "Sticky red bar w/ 24/7 number. Click-to-call, time-of-day aware, after-hours pulse.",         category: "Conversion", enabled: true,  recommended: true },
  { id: "live_chat_route",       name: "Smart Live Chat",            description: "After-hours auto-routes to voicemail-to-text; business hours rings the front desk.",          category: "Conversion", enabled: false },
  { id: "instant_quote_form",    name: "Instant Quote Modal",        description: "Equipment + horsepower + ZIP → 30-min ETA estimate, captures lead with Apollo enrichment.",   category: "Conversion", enabled: false, recommended: true },
  { id: "weather_alert_banner",  name: "Storm/Cold Alert Banner",    description: "NWS triggers banner on extreme weather: 'Polar vortex warning — emergency boiler service.'", category: "Live Data",  enabled: false },
  { id: "trust_badges",          name: "Trust Badge Strip",          description: "ASME · NATE · BBB A+ · MITN.info verified — sticky on scroll.",                                category: "Trust",      enabled: true },
  { id: "review_carousel",       name: "Live Google Review Carousel", description: "Auto-pulls latest 4★+ Google reviews, refreshes every 6 hours.",                              category: "Trust",      enabled: true },
  { id: "case_study_pdf",        name: "One-Click Case Study PDFs",  description: "Visitor downloads = lead capture + auto-text Pat: 'DMC just downloaded the boiler retrofit case study.'", category: "Conversion", enabled: false },
  { id: "rfp_radar_feed",        name: "Public RFP/Bid Feed",        description: "Live MITN.info Michigan boiler RFPs scrolling on the homepage. Public proof of activity.",   category: "Live Data",  enabled: false, recommended: true },
  { id: "service_area_map",      name: "Interactive Service Map",    description: "Wayne / Oakland / Macomb / Washtenaw / Genesee — click county for response time.",            category: "Trust",      enabled: false },
  { id: "tech_locator",          name: "Tech-On-The-Way Tracker",    description: "After dispatch, customer gets live ETA + tech photo + name (Domino's-style).",                category: "Ops",        enabled: false, recommended: true },
  { id: "preventive_reminder",   name: "Annual Tune-Up Reminders",   description: "Email + SMS to past customers 30 days before their service anniversary. Auto-books.",        category: "Ops",        enabled: false, recommended: true },
  { id: "equipment_finder",      name: "Equipment Spec Finder",      description: "'Find my burner' wizard — links to parts, service history, line cards.",                      category: "Engagement", enabled: false },
  { id: "video_intro",           name: "Owner Video Intro",          description: "30-sec autoplay-muted intro on About page.",                                                  category: "Trust",      enabled: false },
  { id: "press_strip",           name: "As-Seen-In Press Strip",     description: "Crain's Detroit · MIRS · trade publications — logos rotate.",                                category: "Trust",      enabled: false },
  { id: "energy_savings_calc",   name: "Energy Savings Calculator",  description: "Visitor inputs current boiler age + horsepower → estimated annual fuel savings.",            category: "Conversion", enabled: false, recommended: true },
  { id: "compliance_countdown",  name: "Code Compliance Countdown",  description: "Pressure vessel certificate expiring in N days — dashboard widget for return customers.",   category: "Compliance", enabled: false },
  { id: "knowledge_base",        name: "Searchable KB",              description: "Boiler troubleshooting articles, indexed for Google. SEO + lead magnet.",                     category: "Engagement", enabled: false },
  { id: "missed_call_autotext",  name: "Missed Call Auto-Text",      description: "If Pat doesn't answer in 30 sec, customer gets: 'We saw your call — what's down?'",         category: "Conversion", enabled: true,  recommended: true },
];
