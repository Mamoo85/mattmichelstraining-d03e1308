import TabPlaceholder from "./TabPlaceholder";

export const SiteRadarTab = () => (
  <TabPlaceholder
    title="SiteRadar"
    accent="Real-time visitor intelligence"
    description="Anonymous visitors deanonymized via IP → company match. Bias: facilities directors, plant engineers, hospital chief engineers."
    kpis={[
      { label: "Visitors (7d)",    value: "284", sub: "↑ 24%", accent: "text-[#27CCC0]" },
      { label: "ICP matches",      value: "41",  sub: "14% of total" },
      { label: "Returning ICPs",   value: "9",   sub: "Hot — 3+ visits", accent: "text-[#c12a3b]" },
      { label: "Apollo enriched",  value: "37",  sub: "Auto-emailed: 12" },
    ]}
    rows={[
      { tag: "🏭 ICP", primary: "Stellantis Facilities Mgmt — Sterling Heights",        secondary: "/services/boiler-tune-up · 4 pages · 8m 12s · 3rd visit",        right: "2:14 PM" },
      { tag: "🏥 ICP", primary: "Detroit Medical Center — Midtown",                     secondary: "/service · 2 pages · 3m 04s · 1st visit",                       right: "11:47 AM" },
      { tag: "🏫 ICP", primary: "Wayne County Schools — Maintenance Dept",              secondary: "/ · 1 page · 0m 41s · 1st visit",                              right: "9:03 AM" },
      { tag: "🏥 ICP", primary: "Henry Ford Health — Plant Engineering",                secondary: "/services/pressure-vessel · 6 pages · 11m · 2nd visit",         right: "Yesterday" },
      {                primary: "Anonymous (Comcast Detroit)",                          secondary: "/contact · 1 page · 0m 22s",                                    right: "Yesterday" },
    ]}
  />
);

export const MissedCallTab = () => (
  <TabPlaceholder
    title="Missed-Call Catch"
    accent="Every missed call → instant text-back"
    description="Inbound calls forward to (313) 590-4404 mirror line. After 30 sec, caller gets auto-text + voicemail transcript lands here."
    kpis={[
      { label: "Calls (7d)",       value: "23",   sub: "8 missed" },
      { label: "Auto-texts sent",  value: "8",    sub: "100% coverage", accent: "text-[#27CCC0]" },
      { label: "Replies",          value: "5",    sub: "62% recovery", accent: "text-[#c12a3b]" },
      { label: "Avg response",     value: "28s",  sub: "Goal: < 60s" },
    ]}
    rows={[
      { tag: "Recovered", primary: "(248) 555-0199 — 'Need emergency tune-up tomorrow'",  secondary: "Voicemail 0:47 · auto-text replied in 1:12", right: "3:42 PM" },
      { tag: "Recovered", primary: "(313) 555-0117 — 'Pricing on a service contract'",     secondary: "Voicemail 0:22 · auto-text replied in 4:08", right: "1:14 PM" },
      {                   primary: "(586) 555-0142 — Henry Ford facilities",               secondary: "Voicemail 1:34 · auto-text sent · awaiting reply", right: "10:22 AM" },
      {                   primary: "(248) 555-0188 — Unknown",                             secondary: "Voicemail 0:12 · auto-text sent",                  right: "9:08 AM" },
    ]}
  />
);

export const BuyerRadarTab = () => (
  <TabPlaceholder
    title="Buyer Radar"
    accent="MITN.info · SAM.gov · Michigan procurement"
    description="Live RFP feed for industrial / commercial boiler bids. Pat is texted within 5 min of any new posting matching his profile."
    kpis={[
      { label: "Active RFPs",      value: "14",   sub: "$3.1M total value", accent: "text-[#27CCC0]" },
      { label: "Hot (today)",      value: "2",    sub: "$2.74M",            accent: "text-[#c12a3b]" },
      { label: "Bid responses",    value: "3",    sub: "Drafted in CRM" },
      { label: "Won (90d)",        value: "1",    sub: "$340k Wayne County" },
    ]}
    rows={[
      { tag: "🔥 Hot",  primary: "Stellantis Truck Plant — Boiler Retrofit",       secondary: "MITN.info · Posted 2h ago · Bid due May 24",     right: "$2.4M" },
      { tag: "🔥 Hot",  primary: "Wayne County — Steam Plant Maintenance",          secondary: "MITN.info · Posted yesterday · Bid due May 30",  right: "$340k/y" },
      {                 primary: "Detroit Public Schools — Boiler Tune-Up RFP",     secondary: "MITN.info · Posted 2d ago · Bid due Jun 5",       right: "$180k" },
      {                 primary: "Wayne State — Combustion Analysis Annual",        secondary: "MITN.info · Posted 3d ago · Bid due Jun 10",      right: "$45k/y" },
      {                 primary: "Detroit Water — Industrial Boiler Service",       secondary: "MITN.info · Posted 5d ago",                       right: "$95k" },
    ]}
  />
);

export const FieldDeskTab = () => (
  <TabPlaceholder
    title="FieldDesk"
    accent="Jobs · Techs · Schedule · Invoices"
    description="Boiler service tickets, dispatch, parts pull-list, and invoicing in one screen."
    kpis={[
      { label: "Open jobs",    value: "7",       sub: "2 emergency", accent: "text-[#c12a3b]" },
      { label: "Techs out",    value: "4 / 5",   sub: "All active" },
      { label: "Avg ETA",      value: "1h 47m",  sub: "Metro Detroit" },
      { label: "Pending inv.", value: "$34.2k",  sub: "12 invoices",      accent: "text-[#27CCC0]" },
    ]}
    rows={[
      { tag: "🚨 EMERGENCY", primary: "DMC Detroit Receiving — boiler #3 down",       secondary: "Tech: Mike R · ETA 47 min · 800 BHP firetube", right: "Active" },
      { tag: "🚨 EMERGENCY", primary: "Stellantis SHAP — burner lockout",              secondary: "Tech: Carlos D · ETA 1h 12m · Power Flame",     right: "Active" },
      {                      primary: "Beaumont Royal Oak — annual tune-up",           secondary: "Tech: James T · scheduled 9 AM tomorrow",       right: "Scheduled" },
      {                      primary: "Wayne State — combustion analysis",             secondary: "Tech: Alex P · scheduled Mon",                  right: "Scheduled" },
      { tag: "Invoice",      primary: "Henry Ford Macomb — pressure vessel inspection", secondary: "Completed yesterday · invoice #DJ-4827",       right: "$4,820" },
    ]}
  />
);

export const TechAlertTab = () => (
  <TabPlaceholder
    title="TechAlert"
    accent="Competitor talent + buyer hiring signals"
    description="When DMC posts a 'Plant Engineer' job — that's a maintenance director gap. We text Pat in 12 minutes."
    kpis={[
      { label: "Watch list",       value: "23",   sub: "Hospitals + plants + GCs" },
      { label: "Signals (7d)",     value: "5",    sub: "↑ 2 vs last week", accent: "text-[#27CCC0]" },
      { label: "Hot signals",      value: "2",    sub: "Outreach drafted" },
      { label: "Response rate",    value: "31%",  sub: "Industry avg: 8%" },
    ]}
    rows={[
      { tag: "🔥 Hot", primary: "DMC posted: 'Director of Plant Operations'",         secondary: "Indeed · 2 days ago · prior director left for Beaumont",  right: "$50k–$200k opp." },
      { tag: "🔥 Hot", primary: "Wayne State posted: 'Boiler Operator Lead'",         secondary: "WSU careers · yesterday · suggests retention gap",         right: "Service contract" },
      {                primary: "Beaumont Troy hired ex-Stellantis facilities VP",    secondary: "LinkedIn · 1 week ago · territory shift",                  right: "Watch" },
      {                primary: "Henry Ford Macomb opened 'HVAC Supervisor' req",     secondary: "LinkedIn · 4 days ago",                                     right: "Watch" },
    ]}
  />
);

export const TradeRadarTab = () => (
  <TabPlaceholder
    title="Trade Radar"
    accent="Permits · Building signals · Industrial boiler angle"
    description="BSEED, Wayne / Oakland / Macomb / Washtenaw permit data filtered for commercial boiler, pressure vessel, and industrial HVAC work."
    kpis={[
      { label: "Permits (7d)",   value: "14",  sub: "Boiler / PV / HVAC" },
      { label: "Wayne",          value: "8" },
      { label: "Oakland",        value: "4" },
      { label: "Macomb",         value: "2" },
    ]}
    rows={[
      { primary: "1 Ford Place, Detroit — boiler replacement permit",            secondary: "BSEED · 3 days ago · est. value $480k",   right: "Henry Ford" },
      { primary: "300 River Place, Detroit — pressure vessel installation",     secondary: "BSEED · 4 days ago · est. value $220k",   right: "Stellantis" },
      { primary: "16001 W 9 Mile, Southfield — industrial HVAC retrofit",       secondary: "Oakland · 5 days ago · est. value $1.2M", right: "Lear Corp" },
      { primary: "21000 Hoover Rd, Warren — boiler tune-up bid pkg",            secondary: "Macomb · 6 days ago",                      right: "DTW supplier" },
    ]}
  />
);

export const OutreachTab = () => (
  <TabPlaceholder
    title="Outreach"
    accent="Cold email + fax campaigns to industrial buyers"
    description="Apollo-enriched contact list. Targeting facilities directors, plant engineers, hospital chief engineers, school district maintenance leads."
    kpis={[
      { label: "Targets",        value: "1,847",  sub: "industrial_boiler bias" },
      { label: "Sent (30d)",     value: "423",    sub: "Manual-approved", accent: "text-[#27CCC0]" },
      { label: "Replies",        value: "47",     sub: "11.1% reply rate" },
      { label: "Meetings",       value: "9",      sub: "$1.2M in pipeline", accent: "text-[#c12a3b]" },
    ]}
    rows={[
      { primary: "Sarah K — Facilities Dir, DMC Detroit Receiving",     secondary: "Replied: 'Send me your service contract pricing'",  right: "Hot reply" },
      { primary: "Tom R — Plant Engineer, Stellantis SHAP",             secondary: "Opened email 4× · meeting Friday",                    right: "Meeting set" },
      { primary: "Pat M — Chief Engineer, Henry Ford Macomb",           secondary: "Sent · awaiting open",                                right: "Sent" },
      { primary: "Ana V — Maintenance Dir, Wayne County Schools",       secondary: "Sent · awaiting reply",                               right: "Sent" },
    ]}
  />
);

export const ReviewsTab = () => (
  <TabPlaceholder
    title="Reviews"
    accent="Google · BBB · industry directories"
    description="Auto-monitor + auto-request from satisfied service customers."
    kpis={[
      { label: "Google rating",   value: "4.8 ⭐", sub: "47 reviews",      accent: "text-[#27CCC0]" },
      { label: "BBB",              value: "A+",     sub: "Since 1962" },
      { label: "Requests sent",   value: "23",     sub: "Last 30 days" },
      { label: "New reviews",     value: "6",      sub: "Last 30 days" },
    ]}
    rows={[
      { tag: "5★", primary: "John T — DMC Detroit Receiving",            secondary: "'Mike R came out at 2 AM. Saved our boiler plant. Class act.'",  right: "Yesterday" },
      { tag: "5★", primary: "Lisa P — Beaumont Royal Oak",                secondary: "'D.J. Conley keeps our steam running. Period.'",                  right: "3 days ago" },
      { tag: "4★", primary: "Anonymous — Wayne State",                    secondary: "'Great service, slightly slow on parts.' (parts now in stock)",   right: "1 week ago" },
    ]}
  />
);

export const ReportsTab = () => (
  <TabPlaceholder
    title="Reports"
    accent="Weekly digest · ROI · Attribution"
    description="What ran this week, what it produced, what it cost, what's next."
    kpis={[
      { label: "Week ROI",        value: "11.4×",  sub: "Pipeline / spend",  accent: "text-[#27CCC0]" },
      { label: "Pipeline added",  value: "$847k",  sub: "Last 7 days",       accent: "text-[#c12a3b]" },
      { label: "Cost",            value: "$74",    sub: "Apollo + tools" },
      { label: "Hours saved",     value: "18.5",   sub: "Estimated" },
    ]}
    rows={[
      { primary: "Weekly digest — May 5, 2026",                           secondary: "Sent to pmichels@djconley.com · 14 sections", right: "Open" },
      { primary: "Apollo industrial-boiler enrichment report",            secondary: "412 contacts enriched · $42 spend",            right: "Open" },
      { primary: "SiteRadar 30-day attribution",                          secondary: "9 ICP visitors → 3 meetings → $480k pipeline",  right: "Open" },
    ]}
  />
);

export const IntegrationsTab = () => (
  <TabPlaceholder
    title="Integrations"
    accent="Connected services"
    description="What's wired into Pat's command center."
    kpis={[
      { label: "Connected", value: "9",  sub: "All healthy", accent: "text-[#27CCC0]" },
      { label: "Available", value: "14", sub: "One-click add" },
      { label: "API calls (7d)", value: "23.4k" },
      { label: "Errors", value: "0", accent: "text-[#27CCC0]" },
    ]}
    rows={[
      { tag: "✓", primary: "Apollo.io",              secondary: "industrial_boiler bias · $200/mo budget", right: "Healthy" },
      { tag: "✓", primary: "Twilio (313) 590-4404",  secondary: "Voice + SMS · A2P registered",            right: "Healthy" },
      { tag: "✓", primary: "Resend (email)",         secondary: "service@djconley.com domain verified",     right: "Healthy" },
      { tag: "✓", primary: "Google Maps + Places",   secondary: "Address validation + Street View",         right: "Healthy" },
      { tag: "✓", primary: "MITN.info scraper",      secondary: "Daily 6 AM Michigan boiler RFP scan",      right: "Healthy" },
      { tag: "✓", primary: "BSEED + Wayne County",   secondary: "Permit scan · 4× daily",                   right: "Healthy" },
      { tag: "✓", primary: "Google Reviews",         secondary: "Auto-fetch every 6h",                       right: "Healthy" },
      { tag: "✓", primary: "Hunter.io",              secondary: "Email enrichment fallback",                 right: "Healthy" },
      { tag: "✓", primary: "HubSpot CRM",            secondary: "Outbound contact sync",                     right: "Healthy" },
    ]}
  />
);

export const TeamTab = () => (
  <TabPlaceholder
    title="Team"
    accent="Seats · roles · access"
    description="Invite Pat's team to the command center. Service dispatch sees jobs, sales sees Buyer Radar, etc."
    kpis={[
      { label: "Active seats", value: "1 / 5", sub: "4 available" },
      { label: "Pending invites", value: "0" },
      { label: "Last login", value: "—", sub: "Pat hasn't logged in yet" },
      { label: "MFA", value: "Required", accent: "text-[#27CCC0]" },
    ]}
    rows={[
      { tag: "Owner", primary: "Pat Michels — pmichels@djconley.com", secondary: "Full access · invited via magic link", right: "Active" },
    ]}
  />
);

export const SettingsTab = () => (
  <TabPlaceholder
    title="Settings"
    accent="Tenant configuration"
    description="DJ Conley sandbox settings. Industry: industrial_boiler. Apollo budget: $200/mo. Coverage: Wayne / Oakland / Macomb / Washtenaw / Genesee."
    kpis={[
      { label: "Industry",        value: "industrial_boiler", accent: "text-[#27CCC0]" },
      { label: "Apollo budget",   value: "$200/mo" },
      { label: "Counties",        value: "5" },
      { label: "Free tier",       value: "Trojan Horse", accent: "text-[#c12a3b]" },
    ]}
    rows={[
      { primary: "Apollo target titles",  secondary: "Facilities Director · Plant Engineer · Chief Engineer · Maintenance Director · Director of Operations · Property Manager · VP Engineering" },
      { primary: "Apollo keywords",       secondary: "boiler · steam · pressure vessel · industrial HVAC · combustion · burner" },
      { primary: "Coverage counties",     secondary: "Wayne · Oakland · Macomb · Washtenaw · Genesee" },
      { primary: "Service phone",         secondary: "(248) 585-5340 (Pat's main) · (313) 590-4404 (mirror)" },
      { primary: "Owner email",           secondary: "pmichels@djconley.com" },
    ]}
  />
);
