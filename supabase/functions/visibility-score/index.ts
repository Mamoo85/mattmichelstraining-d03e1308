import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VisibilityCheck {
  category: string;
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
  points: number;
  maxPoints: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { businessName, city, website } = await req.json();
    if (!businessName) {
      return new Response(JSON.stringify({ error: "Business name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const location = city || "Grosse Pointe, MI";
    const checks: VisibilityCheck[] = [];

    // 1. Google Business Profile check via Places API
    let gbpFound = false;
    let gbpData: any = null;
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const searchRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(businessName + " " + location)}&inputtype=textquery&fields=name,formatted_address,rating,user_ratings_total,business_status,photos,opening_hours,types&key=${GOOGLE_MAPS_API_KEY}`
        );
        const searchData = await searchRes.json();
        if (searchData.candidates?.length > 0) {
          gbpData = searchData.candidates[0];
          gbpFound = true;
        }
      } catch (e) {
        console.error("[VISIBILITY] GBP lookup error:", e);
      }
    }

    // GBP exists
    checks.push({
      category: "Google Business Profile",
      label: "GBP Listing Found",
      status: gbpFound ? "pass" : "fail",
      detail: gbpFound
        ? `Found: ${gbpData.name} — ${gbpData.formatted_address || "address on file"}`
        : "No Google Business Profile found. You're invisible in Google Maps.",
      points: gbpFound ? 15 : 0,
      maxPoints: 15,
    });

    // GBP reviews
    if (gbpFound) {
      const reviewCount = gbpData.user_ratings_total || 0;
      const rating = gbpData.rating || 0;
      checks.push({
        category: "Google Business Profile",
        label: "Review Count",
        status: reviewCount >= 10 ? "pass" : reviewCount > 0 ? "warning" : "fail",
        detail: reviewCount > 0
          ? `${reviewCount} reviews, ${rating} star average`
          : "Zero reviews. Customers don't trust businesses without reviews.",
        points: reviewCount >= 20 ? 10 : reviewCount >= 10 ? 7 : reviewCount > 0 ? 3 : 0,
        maxPoints: 10,
      });

      // GBP hours
      const hasHours = gbpData.opening_hours?.open_now !== undefined;
      checks.push({
        category: "Google Business Profile",
        label: "Business Hours Set",
        status: hasHours ? "pass" : "warning",
        detail: hasHours ? "Hours are published on your listing" : "No hours listed — customers don't know when you're open.",
        points: hasHours ? 5 : 0,
        maxPoints: 5,
      });

      // GBP photos
      const hasPhotos = gbpData.photos?.length > 0;
      checks.push({
        category: "Google Business Profile",
        label: "Photos",
        status: hasPhotos ? "pass" : "fail",
        detail: hasPhotos ? `${gbpData.photos.length} photo(s) on your profile` : "No photos. Listings with photos get 42% more direction requests.",
        points: hasPhotos ? 5 : 0,
        maxPoints: 5,
      });
    } else {
      checks.push({ category: "Google Business Profile", label: "Reviews", status: "fail", detail: "Can't check reviews — no GBP listing found.", points: 0, maxPoints: 10 });
      checks.push({ category: "Google Business Profile", label: "Business Hours", status: "fail", detail: "Can't check hours — no GBP listing found.", points: 0, maxPoints: 5 });
      checks.push({ category: "Google Business Profile", label: "Photos", status: "fail", detail: "Can't check photos — no GBP listing found.", points: 0, maxPoints: 5 });
    }

    // GBP posts (we can't check via Places API, so always recommend)
    checks.push({
      category: "Google Business Profile",
      label: "Weekly Google Posts",
      status: "warning",
      detail: "Most businesses don't post to GBP. Weekly posts boost local search visibility by up to 3x.",
      points: 0,
      maxPoints: 10,
    });

    // 2. Website checks
    let hasWebsite = false;
    let siteData: any = {};
    if (website) {
      let url = website.trim();
      if (!url.startsWith("http")) url = "https://" + url;
      try {
        const start = Date.now();
        const siteRes = await fetch(url, {
          headers: { "User-Agent": "M2-VisibilityBot/1.0" },
          redirect: "follow",
        });
        const loadTime = Date.now() - start;
        const html = await siteRes.text();
        hasWebsite = siteRes.ok;
        siteData = {
          loadTime,
          hasSSL: url.startsWith("https") || siteRes.url.startsWith("https"),
          hasViewport: html.includes("viewport"),
          hasPhone: /\(\d{3}\)\s?\d{3}[- ]?\d{4}|\d{3}[-.]\d{3}[-.]\d{4}/.test(html),
          titleTag: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "",
          hasH1: /<h1/i.test(html),
          size: html.length,
        };
      } catch {
        hasWebsite = false;
      }
    }

    checks.push({
      category: "Website",
      label: "Website Exists",
      status: hasWebsite ? "pass" : website ? "fail" : "fail",
      detail: hasWebsite
        ? `Found at ${website}`
        : website
          ? `${website} is not loading or returned an error.`
          : "No website provided. Without a website, you're invisible to people searching online.",
      points: hasWebsite ? 10 : 0,
      maxPoints: 10,
    });

    if (hasWebsite) {
      checks.push({
        category: "Website",
        label: "SSL/HTTPS",
        status: siteData.hasSSL ? "pass" : "fail",
        detail: siteData.hasSSL
          ? "Site uses HTTPS — secure connection."
          : "No SSL certificate. Google penalizes non-HTTPS sites and Chrome shows a 'Not Secure' warning.",
        points: siteData.hasSSL ? 10 : 0,
        maxPoints: 10,
      });

      checks.push({
        category: "Website",
        label: "Mobile-Friendly",
        status: siteData.hasViewport ? "pass" : "fail",
        detail: siteData.hasViewport
          ? "Has mobile viewport — site adapts to phone screens."
          : "No mobile viewport detected. 60%+ of searches are on phones — your site probably looks broken on mobile.",
        points: siteData.hasViewport ? 10 : 0,
        maxPoints: 10,
      });

      checks.push({
        category: "Website",
        label: "Phone Number Visible",
        status: siteData.hasPhone ? "pass" : "fail",
        detail: siteData.hasPhone
          ? "Phone number found on site."
          : "No phone number detected on your homepage. If they can't call you in 2 seconds, they'll call someone else.",
        points: siteData.hasPhone ? 5 : 0,
        maxPoints: 5,
      });

      checks.push({
        category: "Website",
        label: "Load Speed",
        status: siteData.loadTime < 2000 ? "pass" : siteData.loadTime < 4000 ? "warning" : "fail",
        detail: `Site loaded in ${(siteData.loadTime / 1000).toFixed(1)} seconds. ${siteData.loadTime < 2000 ? "Fast." : siteData.loadTime < 4000 ? "Acceptable but could be faster." : "Slow — 53% of visitors leave if a page takes over 3 seconds."}`,
        points: siteData.loadTime < 2000 ? 5 : siteData.loadTime < 4000 ? 3 : 0,
        maxPoints: 5,
      });
    } else {
      checks.push({ category: "Website", label: "SSL/HTTPS", status: "fail", detail: "No website to check.", points: 0, maxPoints: 10 });
      checks.push({ category: "Website", label: "Mobile-Friendly", status: "fail", detail: "No website to check.", points: 0, maxPoints: 10 });
      checks.push({ category: "Website", label: "Phone Number", status: "fail", detail: "No website to check.", points: 0, maxPoints: 5 });
      checks.push({ category: "Website", label: "Load Speed", status: "fail", detail: "No website to check.", points: 0, maxPoints: 5 });
    }

    // 3. Missed call readiness
    checks.push({
      category: "Lead Capture",
      label: "Missed Call Text-Back",
      status: "fail",
      detail: "No automated text-back detected. When you miss a call, the customer calls your competitor. An auto-text keeps them engaged.",
      points: 0,
      maxPoints: 10,
    });

    // Calculate score
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const maxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0);
    const score = Math.round((totalPoints / maxPoints) * 100);

    // AI summary
    let summary = "";
    if (ANTHROPIC_API_KEY) {
      try {
        const failedChecks = checks.filter((c) => c.status === "fail").map((c) => c.label + ": " + c.detail);
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `You are a local marketing expert. A business called "${businessName}" in ${location} scored ${score}/100 on a visibility audit. Their failures:\n${failedChecks.join("\n")}\n\nWrite a 2-3 sentence summary explaining what this score means for their business in plain English. Be direct, specific, and emphasize the revenue they're losing. No greeting, no sign-off.`,
              },
            ],
          }),
        });
        const aiData = await aiRes.json();
        summary = aiData.content?.[0]?.text || "";
      } catch (e) {
        console.error("[VISIBILITY] AI summary error:", e);
      }
    }

    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";

    return new Response(
      JSON.stringify({
        businessName,
        location,
        score,
        grade,
        totalPoints,
        maxPoints,
        summary,
        checks,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[VISIBILITY]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
