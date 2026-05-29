// ──────────────────────────────────────────────────────────────────────────
//  D.J. Conley Command Center — Changelog
//  Newest entry FIRST. Add a new object to the top of this array every time we
//  ship something to Pat's admin panel. The "What's New" board renders it
//  automatically and badges the most recent items as NEW.
// ──────────────────────────────────────────────────────────────────────────

export type UpdateKind = "new" | "improved" | "launch";

export type Update = {
  date: string;        // ISO "YYYY-MM-DD" — used for sorting + display
  kind: UpdateKind;    // controls the colored tag
  title: string;       // short, punchy
  body: string;        // one or two sentences, written FOR Pat (benefit-first)
};

export const UPDATES: Update[] = [
  {
    date: "2026-05-29",
    kind: "new",
    title: "Choose your website design",
    body: "A new “Site Versions” tab lets you compare 4 premium homepage designs side-by-side, preview each one full-screen, and pick the one you love — one click sends your choice straight to us.",
  },
  {
    date: "2026-05-29",
    kind: "new",
    title: "This “What’s New” board",
    body: "Every upgrade we add to your Command Center now shows up right here, the moment you log in. You’ll always see exactly what’s new without having to ask.",
  },
  {
    date: "2026-05-28",
    kind: "new",
    title: "Buyer Radar — live RFP feed",
    body: "We now surface active boiler & mechanical RFPs from MITN.info and SAM.gov as they post — with estimated contract value — so the big jobs come to you first.",
  },
  {
    date: "2026-05-27",
    kind: "new",
    title: "SiteRadar — see who’s visiting djconley.com",
    body: "Identifies the companies browsing your site (hospitals, plants, schools), what they viewed, and the size of the opportunity — turning anonymous traffic into named leads.",
  },
  {
    date: "2026-05-26",
    kind: "improved",
    title: "Missed-Call Recovery, faster",
    body: "When a call slips through, an auto-text now goes back to the caller in under 30 seconds — recovering roughly 38% of missed calls that used to walk to a competitor.",
  },
  {
    date: "2026-05-25",
    kind: "launch",
    title: "Your Command Center is live",
    body: "A secure, passcode-protected portal with a full live rebuild of djconley.com plus SiteRadar, Buyer Radar, Trade Radar, TechAlert, Missed-Call, FieldDesk and Reviews — all in one place.",
  },
];
