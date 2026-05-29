/**
 * Homepage Inspector — extracts 7 trauma-point signals from a business website
 * via fetch() + regex. No headless browser needed. Runs in <2s per URL.
 */

export interface TraumaPoints {
  has_mobile_viewport: boolean;
  has_contact_form: boolean;
  has_meta_description: boolean;
  has_visible_cta: boolean;
  has_phone_in_header: boolean;
  has_https: boolean;
  fast_load: boolean;            // true if response time <3000ms
  load_time_ms: number;
  trauma_count: number;          // number of missing items (0 = healthy site)
}

export async function inspectHomepage(url: string): Promise<TraumaPoints | null> {
  let html = "";
  let loadTimeMs = 9999;

  try {
    // Normalise URL
    if (!url.startsWith("http")) url = `https://${url}`;

    const start = Date.now();
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA-Inspector/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    loadTimeMs = Date.now() - start;

    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const lower = html.toLowerCase();
  const firstBody = lower.indexOf("<body");
  const bodySample = firstBody >= 0 ? lower.slice(firstBody, firstBody + 2000) : lower.slice(0, 2000);
  const headerSample = lower.slice(0, 2000);

  const hasMobileViewport  = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasContactForm     = /<form[\s>]/i.test(html) && /contact|type=["']email["']/i.test(html);
  const metaDescMatch      = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{50,})/i);
  const hasMetaDescription = !!metaDescMatch;
  const hasVisibleCta      = /\b(call|quote|get|free|book|schedule|contact|request)\b/i.test(bodySample.slice(0, 600));
  const hasPhoneInHeader   = /tel:/i.test(headerSample);
  const hasHttps           = url.startsWith("https");
  const fastLoad           = loadTimeMs < 3000;

  const signals = [hasMobileViewport, hasContactForm, hasMetaDescription, hasVisibleCta, hasPhoneInHeader, hasHttps, fastLoad];
  const traumaCount = signals.filter(s => !s).length;

  return {
    has_mobile_viewport:  hasMobileViewport,
    has_contact_form:     hasContactForm,
    has_meta_description: hasMetaDescription,
    has_visible_cta:      hasVisibleCta,
    has_phone_in_header:  hasPhoneInHeader,
    has_https:            hasHttps,
    fast_load:            fastLoad,
    load_time_ms:         loadTimeMs,
    trauma_count:         traumaCount,
  };
}

export function formatTraumaForPrompt(tp: TraumaPoints): string {
  const issues: string[] = [];
  if (!tp.has_mobile_viewport)  issues.push("No mobile viewport meta tag (site is not mobile-optimized)");
  if (!tp.has_contact_form)     issues.push("No contact form found on homepage");
  if (!tp.has_meta_description) issues.push("Missing or too-short meta description (invisible to search engines)");
  if (!tp.has_visible_cta)      issues.push("No clear call-to-action visible above the fold");
  if (!tp.has_phone_in_header)  issues.push("Phone number not linked in header/nav area");
  if (!tp.has_https)            issues.push("Site is running on HTTP, not HTTPS (trust signal failure)");
  if (!tp.fast_load)            issues.push(`Slow page load: ${tp.load_time_ms}ms (Google penalizes sites over 3s)`);
  return issues.length > 0 ? issues.join("\n") : "No major issues detected";
}
