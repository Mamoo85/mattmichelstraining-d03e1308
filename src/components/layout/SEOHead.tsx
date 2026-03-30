import { Helmet } from "react-helmet-async";

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

const SITE_URL = "https://www.mattmichelstraining.com";
const DEFAULT_OG = "https://www.mattmichelstraining.com/pwa-512x512.png";

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
  const fullTitle = title.includes("M²") || title.includes("Matt Michels") ? title : `${title} | Matt Michels Training`;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
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
        name: "M² Training",
        url: SITE_URL,
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
      brand: { "@type": "Brand", name: "M² Training" },
    });
  }

  if (jsonLd) schemas.push(jsonLd);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Matt Michels Training" />

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
