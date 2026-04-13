// Domain-based multi-tenant configuration — "One Brain, Two Faces"

export type BrandKey = "training" | "agency";

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

export function getDomainBrand(): BrandKey {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
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

export function getBrandConfig(): BrandConfig {
  return getDomainBrand() === "agency" ? AGENCY_CONFIG : TRAINING_CONFIG;
}

export const isAgencyDomain = () => getDomainBrand() === "agency";
export const isTrainingDomain = () => getDomainBrand() === "training";
