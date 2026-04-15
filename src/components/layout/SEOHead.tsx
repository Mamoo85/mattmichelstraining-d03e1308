import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { getDomainBrand } from "@/lib/domainConfig";

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  type?: "website" | "article" | "product";
  article?: {
    author: string;
    publishedTime?: string;
    category?: string;
  };
  product?: {
    name: string;
    price: number;
    currency?: string;
    availability?: string;
    image?: string;
  };
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

const M2_SITE_URL = "https://www.mattmichelstraining.com";
const DWA_SITE_URL = "https://www.detroitwebagent.com";
const DEFAULT_OG = "https://www.mattmichelstraining.com/pwa-512x512.png";

// Routes that belong to the DWA brand regardless of domain
const DWA_ROUTES = [
  "/agency", "/hire-alert", "/hire-alert-trial", "/hire-alert-healthcare",
  "/field-service", "/contractor-leads", "/dead-lead-intake", "/dead-lead-stats",
  "/missed-call-catch", "/missed-call-text", "/my-techalert", "/roi",
  "/all-services", "/free-tools", "/free-site-scanner", "/web-design-services",
  "/detroit-web-design", "/get-started", "/seo-guard",
  "/lead-unlocked", "/lead-claimed", "/ai-phone-answering",
  "/manufacturing-web-design", "/real-estate-web-design",
  "/dwa-admin",
];

function isDWAPage(pathname: string): boolean {
  if (getDomainBrand() === "agency") return true;
  return DWA_ROUTES.some(r => pathname.startsWith(r));
}

const SEOHead = ({
  title,
  description,
  path,
  ogImage,
  type = "website",
  article,
  product,
  jsonLd,
  noindex = false,
}: SEOHeadProps) => {
  const location = useLocation();
  const isDWA = isDWAPage(location.pathname);
  const brandName = isDWA ? "Detroit Web Agency" : "Matt Michels Training";
  const siteUrl = isDWA ? DWA_SITE_URL : M2_SITE_URL;

  const fullTitle = title.includes("M2") || title.includes("Matt Michels") || title.includes("Detroit Web Agency")
    ? title
    : `${title} | ${brandName}`;
  const canonical = path ? `${siteUrl}${path}` : undefined;
  const image = ogImage || DEFAULT_OG;

  // Build JSON-LD schemas
  const schemas: Record<string, unknown>[] = [];

  if (article) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      author: { "@type": "Person", name: article.author },
      publisher: {
        "@type": "Organization",
        name: brandName,
        url: siteUrl,
      },
      datePublished: article.publishedTime,
      articleSection: article.category,
      mainEntityOfPage: canonical,
      image,
    });
  }

  if (product) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description,
      image: product.image || image,
      offers: {
        "@type": "Offer",
        price: product.price,
        priceCurrency: product.currency || "USD",
        availability: product.availability || "https://schema.org/InStock",
        url: canonical,
      },
      brand: { "@type": "Brand", name: brandName },
    });
  }

  if (jsonLd) schemas.push(jsonLd);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={brandName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Article meta */}
      {article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {article?.author && (
        <meta property="article:author" content={article.author} />
      )}

      {/* JSON-LD */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
