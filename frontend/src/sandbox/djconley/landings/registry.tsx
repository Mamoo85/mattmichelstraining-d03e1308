import { ComponentType } from "react";
import DJHomeClassic from "../pages/Home";
import HomeAuthority from "./HomeAuthority";
import HomeServiceFirst from "./HomeServiceFirst";
import HomeModern from "./HomeModern";

export type SiteVersion = {
  id: string;
  num: number;
  name: string;
  archetype: string;
  blurb: string;
  accent: string; // hex for the card chip
  Component: ComponentType;
};

// Version 1 = the exact clone of the current djconley.com (already live).
// Versions 2–4 = new premium landing designs. All share the same internal
// pages, header/footer, content and imagery — only the landing changes.
export const SITE_VERSIONS: SiteVersion[] = [
  {
    id: "classic",
    num: 1,
    name: "Classic Clone",
    archetype: "Exact replica of djconley.com",
    blurb: "Your current site, rebuilt 1:1 on our servers. Same look, faster and fully hosted by us.",
    accent: "#c12a3b",
    Component: DJHomeClassic,
  },
  {
    id: "authority",
    num: 2,
    name: "Boiler-Room Authority",
    archetype: "Premium manufacturer-rep (Cleaver-Brooks style)",
    blurb: "Cinematic hero, line-card of the brands you represent, industries grid, stats, and territory map. Reads like a national boiler-room solutions company.",
    accent: "#0b1622",
    Component: HomeAuthority,
  },
  {
    id: "service",
    num: 3,
    name: "Service-First",
    archetype: "Conversion-optimized (gets the phone ringing)",
    blurb: "Quote/service request form right in the hero, loud 24/7 emergency band, trust badges, how-it-works, and reviews. Built to turn visitors into calls.",
    accent: "#27CCC0",
    Component: HomeServiceFirst,
  },
  {
    id: "modern",
    num: 4,
    name: "Modern Engineered",
    archetype: "High-design dark/editorial (the 'wow')",
    blurb: "Bold typography, dark steel palette, capabilities grid, and a project gallery. The premium, modern look — your red accent and logo kept front and center.",
    accent: "#8e1f2b",
    Component: HomeModern,
  },
];

export function getVersion(id?: string): SiteVersion {
  return SITE_VERSIONS.find((v) => v.id === id) || SITE_VERSIONS[0];
}
