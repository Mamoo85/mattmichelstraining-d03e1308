// Domain-based multi-tenant configuration — "One Brain, Two Faces"

export type BrandKey = "training" | "agency" | "djconley";

export interface BrandConfig {
  key: BrandKey;
  siteName: string;
  tagline: string;
  contactPhone: string;
  contactEmail: string;
  footerCompany: string;
  footerLocation: string;
}

const AGENCY_DOMAINS = ["detroitwebagent.com", "www.detroitwebagent.com"];
const DJ_CONLEY_DOMAINS = [
  "pat.detroitwebagent.com",
  "sandbox.djconley.com",
  "djconley.com",
  "www.djconley.com",
];

export function getDomainBrand(): BrandKey {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (DJ_CONLEY_DOMAINS.includes(host)) return "djconley";
  if (AGENCY_DOMAINS.includes(host)) return "agency";
  return "training";
}

const TRAINING_CONFIG: BrandConfig = {
  key: "training",
  siteName: "Matt Michels Training",
  tagline: "Strength & Conditioning · Grosse Pointe, MI",
  contactPhone: "(313) 992-1219",
  contactEmail: "matt@mattmichelstraining.com",
  footerCompany: "Matt Michels Training",
  footerLocation: "Grosse Pointe, MI",
};

const AGENCY_CONFIG: BrandConfig = {
  key: "agency",
  siteName: "Detroit Web Agency",
  tagline: "High-Performance Websites & Automated Systems for Michigan Businesses",
  contactPhone: "(313) 992-1219",
  contactEmail: "matt@detroitwebagent.com",
  footerCompany: "Detroit Web Agency",
  footerLocation: "Grosse Pointe, MI",
};

const DJ_CONLEY_CONFIG: BrandConfig = {
  key: "djconley",
  siteName: "D.J. Conley Associates, Inc.",
  tagline: "A name you can trust",
  contactPhone: "248-589-8220",
  contactEmail: "service@djconley.com",
  footerCompany: "D.J. Conley Associates, Inc.",
  footerLocation: "Troy, MI",
};

export function getBrandConfig(): BrandConfig {
  const brand = getDomainBrand();
  if (brand === "djconley") return DJ_CONLEY_CONFIG;
  return brand === "agency" ? AGENCY_CONFIG : TRAINING_CONFIG;
}

export const isAgencyDomain = () => getDomainBrand() === "agency";
export const isTrainingDomain = () => getDomainBrand() === "training";
export const isDJConleyDomain = () => getDomainBrand() === "djconley";
