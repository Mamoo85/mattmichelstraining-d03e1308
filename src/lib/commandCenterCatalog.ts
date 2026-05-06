/**
 * Curated catalog of common SaaS / business tools for Command Center Tab pickers.
 * Lovable-Connectors style: searchable, grouped, one click to add.
 */
export type CommandCenterCatalogEntry = {
  id: string;
  label: string;
  url: string;
  emoji: string;
  category: "Email & Calendar" | "CRM & Sales" | "Field Service" | "Accounting & Payments" | "Marketing & Ads" | "Communication" | "Productivity" | "Developer" | "Social" | "Michigan / Local" | "Other";
};

export const COMMAND_CENTER_CATALOG: CommandCenterCatalogEntry[] = [
  // Email & Calendar
  { id: "gmail",        label: "Gmail",          url: "https://mail.google.com",        emoji: "✉️", category: "Email & Calendar" },
  { id: "google_cal",   label: "Google Calendar",url: "https://calendar.google.com",    emoji: "📅", category: "Email & Calendar" },
  { id: "outlook",      label: "Outlook",        url: "https://outlook.office.com/mail",emoji: "📨", category: "Email & Calendar" },
  { id: "calendly",     label: "Calendly",       url: "https://calendly.com",           emoji: "📆", category: "Email & Calendar" },

  // CRM & Sales
  { id: "hubspot",      label: "HubSpot",        url: "https://app.hubspot.com",        emoji: "🧲", category: "CRM & Sales" },
  { id: "salesforce",   label: "Salesforce",     url: "https://login.salesforce.com",   emoji: "☁️", category: "CRM & Sales" },
  { id: "pipedrive",    label: "Pipedrive",      url: "https://app.pipedrive.com",      emoji: "🚀", category: "CRM & Sales" },
  { id: "apollo",       label: "Apollo.io",      url: "https://app.apollo.io",          emoji: "🛰️", category: "CRM & Sales" },
  { id: "hunter",       label: "Hunter.io",      url: "https://hunter.io/dashboard",    emoji: "🎯", category: "CRM & Sales" },
  { id: "snov",         label: "Snov.io",        url: "https://app.snov.io",            emoji: "🐍", category: "CRM & Sales" },

  // Field Service
  { id: "fieldservio",  label: "FieldServio",    url: "https://fieldservio.com",        emoji: "🛠️", category: "Field Service" },
  { id: "jobber",       label: "Jobber",         url: "https://secure.getjobber.com",   emoji: "🔧", category: "Field Service" },
  { id: "servicetitan", label: "ServiceTitan",   url: "https://go.servicetitan.com",    emoji: "⚙️", category: "Field Service" },
  { id: "housecall",    label: "Housecall Pro",  url: "https://app.housecallpro.com",   emoji: "🏠", category: "Field Service" },
  { id: "fielddesk",    label: "FieldDesk",      url: "https://detroitwebagent.com/field-service", emoji: "📋", category: "Field Service" },

  // Accounting & Payments
  { id: "qbo",          label: "QuickBooks Online", url: "https://qbo.intuit.com",      emoji: "💰", category: "Accounting & Payments" },
  { id: "xero",         label: "Xero",           url: "https://login.xero.com",         emoji: "📊", category: "Accounting & Payments" },
  { id: "stripe",       label: "Stripe",         url: "https://dashboard.stripe.com",   emoji: "💳", category: "Accounting & Payments" },
  { id: "square",       label: "Square",         url: "https://squareup.com/dashboard", emoji: "🟦", category: "Accounting & Payments" },
  { id: "eway",         label: "eWay",           url: "https://eway.com",               emoji: "🧾", category: "Accounting & Payments" },

  // Marketing & Ads
  { id: "meta_ads",     label: "Meta Ads Manager", url: "https://adsmanager.facebook.com", emoji: "📘", category: "Marketing & Ads" },
  { id: "google_ads",   label: "Google Ads",     url: "https://ads.google.com",         emoji: "🟢", category: "Marketing & Ads" },
  { id: "tiktok_ads",   label: "TikTok Ads",     url: "https://ads.tiktok.com",         emoji: "🎵", category: "Marketing & Ads" },
  { id: "linkedin_ads", label: "LinkedIn Ads",   url: "https://www.linkedin.com/campaignmanager", emoji: "💼", category: "Marketing & Ads" },
  { id: "mailchimp",    label: "Mailchimp",      url: "https://login.mailchimp.com",    emoji: "🐵", category: "Marketing & Ads" },
  { id: "resend",       label: "Resend",         url: "https://resend.com/emails",      emoji: "✉️", category: "Marketing & Ads" },
  { id: "lob",          label: "Lob (postcards)",url: "https://dashboard.lob.com",      emoji: "📬", category: "Marketing & Ads" },
  { id: "sinch",        label: "Sinch (fax)",    url: "https://dashboard.sinch.com",    emoji: "📠", category: "Marketing & Ads" },

  // Communication
  { id: "slack",        label: "Slack",          url: "https://slack.com/signin",       emoji: "💬", category: "Communication" },
  { id: "twilio",       label: "Twilio",         url: "https://console.twilio.com",     emoji: "📞", category: "Communication" },
  { id: "zoom",         label: "Zoom",           url: "https://zoom.us",                emoji: "🎥", category: "Communication" },
  { id: "teams",        label: "Microsoft Teams",url: "https://teams.microsoft.com",    emoji: "👥", category: "Communication" },
  { id: "discord",      label: "Discord",        url: "https://discord.com/app",        emoji: "🟣", category: "Communication" },

  // Productivity
  { id: "drive",        label: "Google Drive",   url: "https://drive.google.com",       emoji: "📁", category: "Productivity" },
  { id: "dropbox",      label: "Dropbox",        url: "https://www.dropbox.com/home",   emoji: "📦", category: "Productivity" },
  { id: "notion",       label: "Notion",         url: "https://www.notion.so",          emoji: "📓", category: "Productivity" },
  { id: "linear",       label: "Linear",         url: "https://linear.app",             emoji: "📐", category: "Productivity" },
  { id: "asana",        label: "Asana",          url: "https://app.asana.com",          emoji: "✅", category: "Productivity" },
  { id: "trello",       label: "Trello",         url: "https://trello.com",             emoji: "📌", category: "Productivity" },
  { id: "airtable",     label: "Airtable",       url: "https://airtable.com",           emoji: "🗃️", category: "Productivity" },

  // Developer
  { id: "github",       label: "GitHub",         url: "https://github.com",             emoji: "🐙", category: "Developer" },
  { id: "supabase",     label: "Supabase",       url: "https://supabase.com/dashboard", emoji: "🗄️", category: "Developer" },
  { id: "vercel",       label: "Vercel",         url: "https://vercel.com/dashboard",   emoji: "▲",  category: "Developer" },
  { id: "lovable",      label: "Lovable",        url: "https://lovable.dev",            emoji: "💖", category: "Developer" },

  // Social
  { id: "linkedin",     label: "LinkedIn",       url: "https://www.linkedin.com/feed",  emoji: "💼", category: "Social" },
  { id: "facebook",     label: "Facebook",       url: "https://www.facebook.com",       emoji: "📘", category: "Social" },
  { id: "instagram",    label: "Instagram",      url: "https://www.instagram.com",      emoji: "📸", category: "Social" },
  { id: "twitter_x",    label: "X (Twitter)",    url: "https://x.com",                  emoji: "🐦", category: "Social" },
  { id: "tiktok",       label: "TikTok",         url: "https://www.tiktok.com",         emoji: "🎵", category: "Social" },
  { id: "youtube",      label: "YouTube Studio", url: "https://studio.youtube.com",     emoji: "📺", category: "Social" },

  // Michigan / Local
  { id: "mitn",         label: "MITN",           url: "https://mitn.info",              emoji: "📋", category: "Michigan / Local" },
  { id: "michigan_lara",label: "Michigan LARA",  url: "https://www.michigan.gov/lara",  emoji: "🏛️", category: "Michigan / Local" },
  { id: "bseed",        label: "Detroit BSEED",  url: "https://detroitmi.gov/departments/buildings-safety-engineering-and-environmental-department", emoji: "🏗️", category: "Michigan / Local" },
  { id: "wayne_county", label: "Wayne County",   url: "https://www.waynecounty.com",    emoji: "🗺️", category: "Michigan / Local" },
];

export const CATEGORY_ORDER: CommandCenterCatalogEntry["category"][] = [
  "Email & Calendar",
  "CRM & Sales",
  "Field Service",
  "Accounting & Payments",
  "Marketing & Ads",
  "Communication",
  "Productivity",
  "Developer",
  "Social",
  "Michigan / Local",
  "Other",
];
