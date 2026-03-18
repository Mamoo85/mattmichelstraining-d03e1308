/**
 * Post-build SEO pre-renderer
 * 
 * Generates route-specific index.html files in dist/ so that search engine
 * crawlers receive fully-populated HTML documents (title, meta description,
 * Open Graph tags, JSON-LD) without needing to execute JavaScript.
 *
 * This replaces Puppeteer-based pre-rendering plugins that are unsupported
 * in this build environment.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";

const DIST = join(process.cwd(), "dist");
const SITE_URL = "https://m2training.com";
const DEFAULT_OG = `${SITE_URL}/pwa-512x512.png`;

// Public marketing routes to pre-render (NO protected routes)
const routes = [
  {
    path: "/",
    title: "M² Training | Youth Strength Coach — Grosse Pointe & Online",
    description:
      "In-person youth strength training in Grosse Pointe Park, MI. Online programs anywhere. 20+ years, 50+ college athletes, zero injuries. Custom programs from $20.",
    h1: "M² Training — Youth Strength Coach",
    body: "In-person youth strength training in Grosse Pointe Park, MI and online programs nationwide. 20+ years coaching experience, 50+ college athletes developed, zero injuries. Sport-specific programs for baseball, soccer, hockey, lacrosse, football, volleyball, basketball, and more. Custom programs from $20, monthly coaching from $14.99/mo.",
  },
  {
    path: "/about",
    title: "About Coach Matt Michels | M² Training",
    description:
      "20+ years training youth athletes. 50+ college-level athletes developed. Zero injuries. Learn about Coach Matt's philosophy and background.",
    h1: "About Coach Matt Michels",
    body: "Coach Matt Michels has over 20 years of experience training youth athletes in Grosse Pointe Park, Michigan and online. With 50+ athletes going on to compete at the college level and zero training injuries, M² Training focuses on building real strength safely. Serving athletes ages 11 and up in baseball, soccer, hockey, lacrosse, football, basketball, volleyball, and more.",
  },
  {
    path: "/pricing",
    title: "Pricing — Affordable Youth Strength Training | M² Training",
    description:
      "Online strength training from $12.99/mo. In-person sessions from $50. Custom programs from $20. 14-day free trial. No contracts.",
    h1: "Affordable Youth Strength Training Plans",
    body: "Online strength training subscriptions starting at $12.99/mo with a free 14-day trial. In-person sessions from $50. Custom programs from $20. No contracts, cancel anytime. Plans for individual athletes, families, and teams.",
  },
  {
    path: "/for-parents",
    title: "For Parents — Youth Strength Training Safety | M² Training",
    description:
      "3.5M youth sports injuries per year — 50% are preventable. Learn how M² Training keeps your athlete safe with science-backed strength programs from $12.99/mo.",
    h1: "For Parents — Keep Your Athlete Safe & Strong",
    body: "3.5 million youth sports injuries happen each year — 50% are preventable with proper strength training. M² Training provides science-backed, age-appropriate strength programs designed to prevent injury and build real athletic performance. Programs start at $12.99/mo with a 14-day free trial.",
  },
  {
    path: "/shop",
    title: "Shop — Training Programs & Exercise Library | M² Training",
    description:
      "Sport-specific training guides, custom programs, and an 85+ exercise library from Coach Matt Michels. Programs start at $9.",
    h1: "Training Programs & Exercise Library",
    body: "Browse sport-specific training guides starting at $9, custom programs built for your athlete from $20, and an 85+ exercise video library. Designed by Coach Matt Michels for youth athletes in every sport.",
  },
  {
    path: "/merch",
    title: "M² Merch — Training Apparel | M² Training",
    description:
      "Official M² Training gear. Premium hoodies, tees, tanks, and hats. Rep the brand that keeps athletes moving right.",
    h1: "M² Training Merch",
    body: "Official M² Training apparel. Premium hoodies, crewnecks, tees, tanks, long sleeves, snapbacks, and beanies. Rep the brand that keeps athletes moving right.",
  },
  {
    path: "/learn",
    title: "Learn — Youth Strength Training Tips & Articles | M² Training",
    description:
      "Free training tips, injury prevention guides, and youth strength development articles from Coach Matt Michels. Real knowledge, no fluff.",
    h1: "Youth Strength Training Articles & Tips",
    body: "Free training tips, injury prevention guides, and youth strength development articles from Coach Matt Michels. Real knowledge for parents and athletes — no fluff.",
  },
  {
    path: "/schedule",
    title: "Schedule a Session — In-Person Training | M² Training",
    description:
      "Book an in-person strength training session with Coach Matt in Grosse Pointe Park, MI. 30-min ($50) and 60-min ($90) sessions available.",
    h1: "Book an In-Person Training Session",
    body: "Schedule an in-person strength training session at 15121 Kercheval Ave, Grosse Pointe Park, MI 48230. 30-minute sessions $50, 60-minute sessions $90. Call (313) 806-4952.",
  },
];

function generateHtml(template, route) {
  const canonical = `${SITE_URL}${route.path === "/" ? "" : route.path}`;
  let html = template;

  // Replace <title>
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${route.title}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${route.description}">`
  );

  // Replace canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${canonical}"`
  );

  // Replace OG tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${canonical}">`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${route.title}">`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${route.description}">`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${route.title}">`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${route.description}">`
  );

  // Replace noscript content with route-specific content
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
        <a href="/learn">Articles</a> |
        <a href="/merch">Merch</a>
      </nav>
      <p>M² Training — 15121 Kercheval Ave, Grosse Pointe Park, MI 48230. (313) 806-4952.</p>
    </noscript>`
  );

  return html;
}

// Main
const templatePath = join(DIST, "index.html");
if (!existsSync(templatePath)) {
  console.error("❌ dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

const template = readFileSync(templatePath, "utf-8");
let count = 0;

for (const route of routes) {
  const html = generateHtml(template, route);

  if (route.path === "/") {
    // Overwrite dist/index.html (already has the right content for /)
    writeFileSync(templatePath, html, "utf-8");
  } else {
    const dir = join(DIST, route.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html, "utf-8");
  }
  count++;
}

console.log(`✅ Pre-rendered ${count} static HTML pages for SEO.`);
