/**
 * Post-build SEO pre-renderer
 *
 * Generates route-specific index.html files in dist/ so that search engine
 * crawlers receive fully-populated HTML documents (title, meta description,
 * Open Graph tags, JSON-LD) without needing to execute JavaScript.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DIST = join(process.cwd(), "dist");
const SITE_URL = "https://www.mattmichelstraining.com";

// Public marketing routes to pre-render (NO protected routes)
const routes = [
  {
    path: "/",
    title: "M² Training | Real Strength Coaching — Grosse Pointe & Online",
    description: "In-person youth strength training in Grosse Pointe Park, MI. Online coaching anywhere. 20+ years, 50+ college athletes. Start for $4.99 your first month.",
    h1: "M² Training — Real Strength. Zero Gimmicks.",
    body: "In-person and online strength coaching by Coach Matt Michels. 20+ years coaching experience. 50+ athletes developed at the college level. Zero injuries. Sport-specific programs for baseball, soccer, hockey, lacrosse, football, volleyball, basketball, and more. Online coaching from $19.99/mo — start for $4.99 your first month.",
  },
  {
    path: "/about",
    title: "About Coach Matt Michels | M² Training",
    description: "20+ years training youth and adult athletes in Grosse Pointe, MI. 50+ college-level athletes developed. Zero injuries. Real coaching, zero gimmicks.",
    h1: "About Coach Matt Michels",
    body: "Coach Matt Michels has over 20 years of experience training athletes of all ages in Grosse Pointe Park, Michigan and online. With 50+ athletes going on to compete at the college level and a zero-injury record, M² Training focuses on building real, durable strength. Serving ages 12–60+ in baseball, soccer, hockey, lacrosse, football, basketball, volleyball, and more.",
  },
  {
    path: "/pricing",
    title: "Pricing — Expert Online Strength Coaching | M² Training",
    description: "Online strength coaching from $19.99/mo — first month $4.99. Custom programming from $149.99/mo. Elite 1-on-1 coaching from $349.99/mo. No contracts.",
    h1: "Online Strength Coaching Plans — Start for $4.99",
    body: "Expert online strength coaching by Coach Matt Michels. Foundation tier: $19.99/mo (first month $4.99) — full app, AI generator, exercise library. Guided tier: $59.99/mo — monthly check-in and form feedback. Pro tier: $149.99/mo — custom 4-week programming and weekly form checks. Elite tier: $349.99/mo — daily coaching and bespoke weekly programming. All plans month-to-month, no contracts.",
  },
  {
    path: "/for-parents",
    title: "For Parents — Youth Strength Training | M² Training",
    description: "3.5M youth sports injuries per year — 50% preventable. Coach Matt builds age-appropriate strength programs that keep your athlete safe and performing. From $19.99/mo.",
    h1: "For Parents — Keep Your Athlete Safe & Strong",
    body: "3.5 million youth sports injuries happen every year — 50% are preventable with proper strength training. M² Training provides science-backed, age-appropriate programs designed to prevent injury and build real athletic performance. Coach Matt has worked with youth athletes for over 20 years with zero training injuries. Programs from $19.99/mo.",
  },
  {
    path: "/shop",
    title: "Shop Training Programs & Exercise Library | M² Training",
    description: "Sport-specific training guides, digital programs, and a 200+ exercise video library from Coach Matt Michels. Programs start at $9.",
    h1: "Training Programs & Exercise Library",
    body: "Browse sport-specific training guides starting at $9, individual programs built by Coach Matt, and a 200+ exercise video library with coaching cues. Available to all M² members. Built on 20 years of real coaching data.",
  },
  {
    path: "/merch",
    title: "M² Training Merch — Official Apparel",
    description: "Official M² Training gear. Premium hoodies, tees, tanks, snapbacks, and hats. Rep the brand that keeps athletes moving right.",
    h1: "M² Training Official Merch",
    body: "Official M² Training apparel. Premium hoodies, crewnecks, tees, tanks, long sleeves, snapbacks, and beanies. Rep the brand that keeps athletes moving right.",
  },
  {
    path: "/learn",
    title: "Training Articles & Tips | M² Training",
    description: "Free strength training tips, injury prevention guides, and athlete development articles from Coach Matt Michels. Real knowledge, no fluff.",
    h1: "Strength Training Articles & Tips from Coach Matt",
    body: "Free training tips, injury prevention guides, and athlete development articles from Coach Matt Michels. 20+ years of real coaching knowledge — no generic internet fluff. Written for athletes, parents, and coaches.",
  },
  {
    path: "/schedule",
    title: "Schedule In-Person Training | M² Training — Grosse Pointe Park",
    description: "Book an in-person strength training session with Coach Matt in Grosse Pointe Park, MI. 1-on-1 and small group training available.",
    h1: "Book In-Person Training in Grosse Pointe Park",
    body: "Schedule an in-person strength training session at M² Training, Grosse Pointe Park, MI. One-on-one personal training and small group sessions (2–4 athletes) available. Youth athlete development, adult strength training, and post-rehab return-to-sport. Call (313) 806-4952 to schedule.",
  },
  {
    path: "/the-edge",
    title: "M² Training Technology — Velocity Tracker, Nutrition Scanner & More",
    description: "Advanced training tech built into your M² membership. On-device velocity tracking, AI nutrition scanner, posture analysis, OCR workout scanner. No extra hardware.",
    h1: "M² Training Technology — Built Into Your App",
    body: "Every M² membership includes advanced training technology: real-time velocity-based training tracker (30+ FPS on-device), AI food nutrition scanner, posture and biomechanics analysis, OCR workout scanner, and AI coach chat. All on-device — no extra hardware, no extra cost. Privacy-first: camera features never upload unless you choose to share.",
  },
  {
    path: "/free-ai-generator",
    title: "Free AI Workout Generator | Coach Matt's Custom Training Programs",
    description: "Generate a free custom workout or rehab protocol powered by Coach Matt's 20-year methodology. No login required. One free generation — then $4.99/mo for unlimited.",
    h1: "Free AI Workout Generator — Powered by Coach Matt",
    body: "Get a custom training program or corrective rehab protocol built on real sports-science principles — powered by Coach Matt Michels' 20+ years of methodology. Tell it your equipment, goals, and experience. Get a full phased program in seconds. Free to try, no login required. Unlock unlimited generations for $4.99 your first month.",
  },
  {
    path: "/detroit-web-design",
    title: "Detroit & Grosse Pointe Web Design | Sites That Get You Clients",
    description: "Local web design for Detroit metro contractors, trades, and small businesses. Built by a local business owner who knows what converts. Fast, mobile-first sites that rank on Google.",
    h1: "Detroit & Grosse Pointe Web Design — Sites That Get You Clients",
    body: "Professional web design for local businesses in Detroit, Grosse Pointe, Harper Woods, St. Clair Shores, and the East Side. Specializing in contractors, trades, medical, dental, and professional services. Mobile-first, Google-optimized websites that convert visitors into clients. Built by Coach Matt Michels — a local business owner who has built his own successful online presence from scratch.",
  },
  {
    path: "/for-parents",
    title: "For Parents — Youth Athlete Strength Training | M² Training",
    description: "Age-appropriate strength programs for youth athletes ages 12+. Prevent injuries, build real athletic performance, and get a coach who actually cares. From $19.99/mo.",
    h1: "For Parents of Youth Athletes",
    body: "M² Training specializes in youth athlete development. Coach Matt Michels has trained athletes ages 12–18 for over 20 years with a zero-injury record. Age-appropriate strength programs for baseball, soccer, hockey, football, lacrosse, volleyball, basketball, and more. Online and in-person options available from $19.99/mo.",
  },
  {
    path: "/results",
    title: "Real Results — Athlete Transformations | M² Training",
    description: "Real strength gains from real athletes trained by Coach Matt Michels. 50+ college athletes developed. See what M² Training delivers.",
    h1: "Real Results from Real Athletes",
    body: "50+ athletes have gone on to compete at the college level after training with Coach Matt Michels. Zero training injuries in 20+ years of coaching. Real strength gains, real performance improvements, real durability. See what M² Training delivers for athletes of all ages.",
  },
  {
    path: "/demo-dental",
    title: "Dental Practice Website Design | M² Web Design Detroit",
    description: "Premium dental website design concept — same-day CEREC, implants, patient trust signals. Built by M² Web Design serving Detroit and Grosse Pointe.",
    h1: "Dental Practice Website Design Concept",
    body: "A premium dental website design concept featuring same-day CEREC crowns, restorative dentistry, patient trust signals, and a polished local-practice presentation. Built by M² Web Design for Detroit metro dental practices.",
  },
  {
    path: "/demo-plumber",
    title: "Plumber Website Design Detroit | M² Web Design",
    description: "High-converting plumber website design for Detroit metro plumbers. Mobile-first, Google-optimized, built to get you more calls.",
    h1: "Plumber Website Design — Detroit Metro",
    body: "Professional website design for plumbers in Detroit, Grosse Pointe, and surrounding areas. Mobile-first design with Google Maps integration, emergency call CTAs, and service area pages that rank locally. Built by M² Web Design.",
  },
  {
    path: "/demo-landscaping",
    title: "Landscaping Website Design Detroit | M² Web Design",
    description: "Professional landscaping website design for Detroit metro lawn care and landscaping companies. Show your work, get more quotes.",
    h1: "Landscaping Website Design — Detroit Metro",
    body: "Professional website design for landscaping and lawn care companies in Detroit, Grosse Pointe, and the East Side. Portfolio galleries, quote request forms, service area pages, and seasonal content that drives calls. Built by M² Web Design.",
  },
  {
    path: "/demo-roofing",
    title: "Roofing Contractor Website Design Detroit | M² Web Design",
    description: "High-converting roofing contractor websites for Detroit metro roofers. Get found on Google, get more estimates.",
    h1: "Roofing Contractor Website Design — Detroit Metro",
    body: "Professional website design for roofing contractors in Detroit, Grosse Pointe, St. Clair Shores, and surrounding areas. Storm damage emergency CTAs, financing options, project galleries, and local SEO to rank above your competition. Built by M² Web Design.",
  },
  {
    path: "/demo-electrician",
    title: "Electrician Website Design Detroit | M² Web Design",
    description: "Professional electrician website design for Detroit metro electrical contractors. Residential and commercial electrical, built to convert.",
    h1: "Electrician Website Design — Detroit Metro",
    body: "Website design for electrical contractors in Detroit and the East Side. Emergency service CTAs, service area pages, licensing credentials display, and local SEO. Built by M² Web Design.",
  },
  {
    path: "/demo-lawyer",
    title: "Law Firm Website Design Detroit | M² Web Design",
    description: "Trust-first law firm website design for Detroit metro attorneys. Practice area pages, attorney bios, and consultation CTAs that convert.",
    h1: "Law Firm Website Design — Detroit Metro",
    body: "Professional website design for law firms and attorneys in Detroit and Grosse Pointe. Practice area pages, attorney bio sections, client testimonials, and consultation request forms. Built by M² Web Design.",
  },
  {
    path: "/demo-clinic",
    title: "Medical Clinic Website Design Detroit | M² Web Design",
    description: "Patient-first medical clinic website design for Detroit metro healthcare providers. Online booking, service pages, trust signals.",
    h1: "Medical Clinic Website Design — Detroit Metro",
    body: "Patient-first website design for medical clinics and healthcare providers in Detroit and Grosse Pointe. Online appointment booking, service descriptions, provider bios, and insurance information. Built by M² Web Design.",
  },
];

function generateHtml(template, route) {
  const canonical = `${SITE_URL}${route.path === "/" ? "" : route.path}`;
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${route.description}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonical}"`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${route.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${route.description}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${route.title}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${route.description}">`);

  html = html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>
      <h1>${route.h1}</h1>
      <p>${route.body}</p>
      <nav>
        <a href="/">Home</a> |
        <a href="/about">About</a> |
        <a href="/pricing">Pricing</a> |
        <a href="/for-parents">For Parents</a> |
        <a href="/shop">Programs</a> |
        <a href="/schedule">Book a Session</a> |
        <a href="/the-edge">Training Technology</a> |
        <a href="/free-ai-generator">Free AI Generator</a> |
        <a href="/learn">Articles</a> |
        <a href="/detroit-web-design">Web Design</a> |
        <a href="/merch">Merch</a>
      </nav>
      <p>M² Training — Grosse Pointe Park, MI. (313) 806-4952. mattmichelstraining.com</p>
    </noscript>`
  );

  return html;
}

const templatePath = join(DIST, "index.html");
if (!existsSync(templatePath)) {
  console.error("❌ dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

const template = readFileSync(templatePath, "utf-8");
const seen = new Set();
let count = 0;

for (const route of routes) {
  if (seen.has(route.path)) continue;
  seen.add(route.path);

  const html = generateHtml(template, route);

  if (route.path === "/") {
    writeFileSync(templatePath, html, "utf-8");
  } else {
    const dir = join(DIST, route.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html, "utf-8");
  }
  count++;
}

console.log(`✅ Pre-rendered ${count} static HTML pages for SEO.`);
