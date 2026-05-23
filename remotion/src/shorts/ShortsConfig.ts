export interface ShortConfig {
  id: string;
  bg: string;
  accent: string;
  logo: string;
  hook: string;
  beats: string[];
  proof: string;
  ctaLine1: string;
  ctaLine2: string;
  url: string;
  smsKeyword: string;
}

export const SHORTS: ShortConfig[] = [
  {
    id: "short-bundle",
    bg: "#0a1628",
    accent: "#00d4ff",
    logo: "DWA REVENUE SUITE",
    hook: "$795 of tools.",
    beats: [
      "TechAlert + FieldDesk + Missed-Call + SiteRadar + Trade Radar + Mortgage Radar",
      "Buy separately = $794/mo",
      "Bundle them = $349/mo",
    ],
    proof: "Save $445/mo. Cancel any product anytime. No contract.",
    ctaLine1: "Text BUNDLE to (313) 992-1219",
    ctaLine2: "detroitwebagent.com/bundle",
    url: "detroitwebagent.com/bundle",
    smsKeyword: "BUNDLE",
  },
  {
    id: "short-m2",
    bg: "#1e293b",
    accent: "#e8621a",
    logo: "M² PERFORMANCE",
    hook: "Personal trainer: $120/hr.",
    beats: [
      "M² Training: $19/mo.",
      "AI workouts in your trainer's voice.",
      "Video form library + progress charts.",
    ],
    proof: "Built by a former D1 athlete. 10,000+ workouts generated.",
    ctaLine1: "Text FIT to (313) 992-1219",
    ctaLine2: "mattmichelstraining.com",
    url: "mattmichelstraining.com",
    smsKeyword: "FIT",
  },
];
