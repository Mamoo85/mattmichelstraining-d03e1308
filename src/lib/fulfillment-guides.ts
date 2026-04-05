/**
 * Shared fulfillment guides — extracted from AdminFulfillment.tsx.
 * Used by AdminFulfillment, AdminPurchaseAlert, and AdminCommandCenter.
 */

/* ── Types ─────────────────────────────────────────────────── */
export interface FulfillmentStep {
  label: string;
  description: string;
  action: "send_email" | "manual_check" | "field_input" | "navigate" | "complete" | "check_website";
  emailSubject?: string;
  emailBody?: string;
  checkUrl?: string;
  checkText?: string;
  fieldLabel?: string;
  fieldPlaceholder?: string;
  dbField?: "phone" | "website" | "notes";
  navigateTo?: string;
  navigateText?: string;
  nextStage: string;
}

export interface ProductGuide {
  name: string;
  icon: string;
  needsSetup: boolean;
  steps: FulfillmentStep[];
  timeline?: { label: string; delay: string }[];
  automatedSteps?: string[];
}

/* ── Fulfillment Guides ─────────────────────────────────────── */
export const GUIDES: Record<string, ProductGuide> = {
  gbp_saas_subscription: {
    name: "GBP SaaS", icon: "📍", needsSetup: true,
    timeline: [
      { label: "Send GBP access request email", delay: "Now" },
      { label: "Client adds you as GBP Manager", delay: "1-2 days" },
      { label: "Save GBP Profile ID", delay: "Same day" },
      { label: "First auto-post goes out", delay: "Next Mon/Wed/Fri" },
    ],
    automatedSteps: [
      "AI generates and publishes GBP posts 3x/week (Mon/Wed/Fri 10am ET)",
      "Posts are tailored to their business type automatically",
    ],
    steps: [
      {
        label: "Send GBP Access Request Email",
        description: "Ask customer to add matt@mattmichelstraining.com as a Manager on their Google Business Profile.",
        action: "send_email",
        emailSubject: "Action needed: Add me to your Google Business Profile",
        emailBody: `Hey [NAME],\n\nYour GBP posting service is set up on my end. To start pushing posts to your Google Business Profile I just need you to add my Google account as a Manager.\n\nHere's how (takes 2 minutes):\n1. Go to business.google.com\n2. Click your business\n3. Business Profile settings → Managers → Add\n4. Enter: matt@mattmichelstraining.com\n5. Set role to Manager → Invite\n\nI'll take it from there.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📧 Awaiting GBP Access",
      },
      {
        label: "Accept Invitation in Google Business",
        description: "Check your Google Business account for the invitation and accept it.",
        action: "manual_check",
        checkUrl: "https://business.google.com",
        checkText: "Open Google Business",
        nextStage: "⚙️ Configuring",
      },
      {
        label: "Save Their GBP Profile ID",
        description: "Get their GBP profile/location ID and save it to their record so the cron job picks them up.",
        action: "field_input",
        fieldLabel: "GBP Profile ID",
        fieldPlaceholder: "e.g. 123456789",
        dbField: "notes",
        nextStage: "🧪 Testing",
      },
      {
        label: "Verify First Post Goes Out",
        description: "Posts run Mon/Wed/Fri at 10am ET. Confirm first post published successfully.",
        action: "complete",
        nextStage: "✅ Active",
      },
    ],
  },

  social_media_subscription: {
    name: "Social Media AI", icon: "📱", needsSetup: true,
    timeline: [
      { label: "Send account connection link", delay: "Now" },
      { label: "Client connects Facebook/Instagram/LinkedIn", delay: "1-2 days" },
      { label: "First auto-post goes out", delay: "Next Mon/Wed/Fri" },
    ],
    automatedSteps: [
      "AI generates and publishes social posts 3x/week",
      "Posts are customized per platform (Facebook, Instagram, LinkedIn)",
    ],
    steps: [
      {
        label: "Send Account Connection Link",
        description: "Email customer the link to connect their Facebook, Instagram, and LinkedIn accounts.",
        action: "send_email",
        emailSubject: "Connect your social accounts — 2 minutes",
        emailBody: `Hey [NAME],\n\nYour Social Media AI service is active! To start posting automatically I need you to connect your accounts.\n\nConnect here:\nhttps://mattmichelstraining.com/social-connect\n\nYou'll link Facebook, Instagram, and LinkedIn in one quick flow. Once connected I'll post 3x per week automatically — Mon, Wed, Fri.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📧 Awaiting Account Connection",
      },
      {
        label: "Verify Accounts Connected",
        description: "Check the Social Media Setup tab to confirm all platforms are connected for this client.",
        action: "navigate",
        navigateTo: "/admin",
        navigateText: "Go to Social Media Setup Tab",
        nextStage: "⚙️ Verifying",
      },
      {
        label: "Confirm Live",
        description: "First posts will go out next Mon/Wed/Fri. Mark active once confirmed.",
        action: "complete",
        nextStage: "✅ Active",
      },
    ],
  },

  missed_call_subscription: {
    name: "Missed Call SMS", icon: "📞", needsSetup: true,
    timeline: [
      { label: "Email asking for their business phone number", delay: "Now" },
      { label: "Save their phone number", delay: "When they reply" },
      { label: "Test the auto-text system", delay: "Same day" },
      { label: "Send go-live confirmation", delay: "After test passes" },
    ],
    automatedSteps: [
      "Twilio auto-texts any missed call within 60 seconds",
      "No ongoing work needed — fully autonomous after setup",
    ],
    steps: [
      {
        label: "Get Their Business Phone Number",
        description: "Email the customer asking for the phone number customers call.",
        action: "send_email",
        emailSubject: "Quick question — Missed Call SMS setup",
        emailBody: `Hey [NAME],\n\nYour Missed Call Text-Back is ready. I just need one thing:\n\nWhat's your main business phone number — the one customers call?\n\nReply here or text me at (313) 806-4952 and I'll have it live same day.\n\n— Matt`,
        nextStage: "📧 Awaiting Phone Number",
      },
      {
        label: "Save Their Business Phone Number",
        description: "Enter their business phone number to save it to their profile.",
        action: "field_input",
        fieldLabel: "Business Phone Number",
        fieldPlaceholder: "(313) 555-1234",
        dbField: "phone",
        nextStage: "⚙️ Configuring",
      },
      {
        label: "Test the System",
        description: "Call their business number and don't answer. Within 60 seconds they should receive an auto-text.",
        action: "manual_check",
        checkText: "Test Passed ✓",
        nextStage: "🧪 Testing",
      },
      {
        label: "Send Go-Live Confirmation",
        description: "Let the customer know it's live and working.",
        action: "send_email",
        emailSubject: "Your Missed Call SMS is live ✓",
        emailBody: `Hey [NAME],\n\nYou're all set — Missed Call Text-Back is live.\n\nAnytime someone calls and you don't answer, they'll automatically get a text within 60 seconds.\n\nLet me know if you have any questions.\n\n— Matt\n(313) 806-4952`,
        nextStage: "✅ Active",
      },
    ],
  },

  chatbot_subscription: {
    name: "AI Chatbot", icon: "🤖", needsSetup: true,
    timeline: [
      { label: "Embed code auto-emailed at purchase", delay: "Instant" },
      { label: "Client installs on their website", delay: "1-3 days" },
      { label: "Verify chatbot appears on site", delay: "After install" },
    ],
    automatedSteps: [
      "Embed code is emailed automatically at purchase",
      "Chatbot runs 24/7 once installed — no ongoing work",
    ],
    steps: [
      {
        label: "Embed Code Was Auto-Sent",
        description: "The embed code was automatically emailed at purchase. Confirm they got it.",
        action: "manual_check",
        checkText: "Email Confirmed ✓",
        nextStage: "📧 Awaiting Install",
      },
      {
        label: "Verify Chatbot on Their Website",
        description: "Visit their site and confirm the chatbot widget appears in the bottom corner.",
        action: "check_website",
        nextStage: "🧪 Testing",
      },
      {
        label: "Mark Active",
        description: "Chatbot is live and working.",
        action: "complete",
        nextStage: "✅ Active",
      },
    ],
  },

  web_design: {
    name: "Web Design", icon: "🌐", needsSetup: true,
    timeline: [
      { label: "Send intake questionnaire", delay: "Now" },
      { label: "Review intake & confirm scope", delay: "When they reply" },
      { label: "Build the site", delay: "3-7 days" },
      { label: "Send preview link for review", delay: "After build" },
      { label: "Apply revisions", delay: "After feedback" },
      { label: "Launch & request Google review", delay: "After approval" },
    ],
    automatedSteps: [
      "Welcome email is sent automatically at purchase",
      "After launch: monthly retainer services run on autopilot",
    ],
    steps: [
      {
        label: "Send Intake Questionnaire",
        description: "Email the client to collect brand details, goals, content, and assets.",
        action: "send_email",
        emailSubject: "Let's build your website — quick intake inside",
        emailBody: `Hey [NAME],\n\nExcited to get started! Before I dive in, I need a few things:\n\n1. Business name and tagline\n2. Primary service(s) or product(s)\n3. Top 3 competitors\n4. Logo (attach or link)\n5. Brand colors (or preferred scheme)\n6. 2-3 websites you like the look of\n7. #1 goal of the site (book calls, generate leads, sell products)\n8. Any photos (attach or link)\n\nOnce I have these I'll move fast.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📋 Awaiting Intake",
      },
      {
        label: "Review Intake & Confirm Scope",
        description: "Review what the client sent. Reply to confirm scope and timeline.",
        action: "manual_check",
        checkText: "Intake Reviewed ✓",
        nextStage: "🔨 Building",
      },
      {
        label: "Build the Site",
        description: "Build the site. Manual work step.",
        action: "manual_check",
        checkText: "Site Built ✓",
        nextStage: "👁 In Review",
      },
      {
        label: "Send Preview Link",
        description: "Send the client a link to review before launch.",
        action: "send_email",
        emailSubject: "Your website preview is ready",
        emailBody: `Hey [NAME],\n\nYour site is ready for review!\n\nPreview: [PASTE PREVIEW URL]\n\nLet me know any changes within 48 hours. I'll do up to 2 rounds of revisions then we launch.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📝 Revisions",
      },
      {
        label: "Apply Revisions",
        description: "Make requested changes from client review.",
        action: "manual_check",
        checkText: "Revisions Done ✓",
        nextStage: "🚀 Ready to Launch",
      },
      {
        label: "Launch & Request Google Review",
        description: "Point their domain live, then email asking for a Google review.",
        action: "send_email",
        emailSubject: "Your website is live! One small favor...",
        emailBody: `Hey [NAME],\n\nYour site is live!\n\nIf you're happy with it, I'd really appreciate a quick Google review:\nhttps://g.page/r/[YOUR_REVIEW_LINK]\n\nTakes 30 seconds and helps other local businesses find me.\n\nThanks for trusting me with your online presence.\n\n— Matt\n(313) 806-4952`,
        nextStage: "✅ Active",
      },
    ],
  },

  contractor_lead_subscription: {
    name: "Contractor Leads", icon: "🏗️", needsSetup: true,
    timeline: [
      { label: "Verify lead source is active", delay: "Now" },
      { label: "Send welcome & expectations email", delay: "Same day" },
      { label: "First leads start arriving", delay: "Within 48 hours" },
    ],
    automatedSteps: [
      "Leads are captured and forwarded automatically via email/SMS",
      "Lead notification cron runs every 15 minutes",
    ],
    steps: [
      {
        label: "Confirm Lead Source is Active",
        description: "Verify ads or lead source are running and sending leads to the contractor_leads table.",
        action: "manual_check",
        checkText: "Lead Source Confirmed ✓",
        nextStage: "⚙️ Configuring",
      },
      {
        label: "Send Welcome & Expectations Email",
        description: "Set expectations: leads will arrive via email/SMS as they come in.",
        action: "send_email",
        emailSubject: "Your contractor lead service is active",
        emailBody: `Hey [NAME],\n\nYour exclusive contractor lead service is active.\n\nHere's how it works:\n• When a new lead comes in for your trade in your area, you'll get an instant email and/or text\n• You'll have the lead's name, phone, and job description\n• Call or text them immediately — speed to lead wins the job\n\nFirst leads should start arriving within 48 hours.\n\n— Matt\n(313) 806-4952`,
        nextStage: "✅ Active",
      },
    ],
  },

  // SMS products — generic guide for all 10
  sms_product: {
    name: "SMS Service", icon: "💬", needsSetup: true,
    timeline: [
      { label: "Send setup email asking for phone list", delay: "Now" },
      { label: "Client provides phone numbers", delay: "1-3 days" },
      { label: "Import contacts and activate", delay: "Same day" },
    ],
    automatedSteps: [
      "SMS sends run on automated cron schedules",
      "TCPA compliance (opt-out checking) is automatic",
    ],
    steps: [
      {
        label: "Send Setup Email",
        description: "Email the customer asking for their contact list and business details.",
        action: "send_email",
        emailSubject: "Quick setup — just need your contact list",
        emailBody: `Hey [NAME],\n\nYour SMS service is ready to go. I just need:\n\n1. Your customer phone list (spreadsheet or CSV)\n2. Your business name as you want it to appear in texts\n3. Your business hours\n\nReply with these and I'll have everything running within 24 hours.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📧 Awaiting Info",
      },
      {
        label: "Import Contacts & Activate",
        description: "Upload their phone list and activate the service.",
        action: "manual_check",
        checkText: "Contacts Imported ✓",
        nextStage: "✅ Active",
      },
    ],
  },

  digital_foundation: {
    name: "Digital Foundation", icon: "🏠", needsSetup: true,
    timeline: [
      { label: "Send intake questionnaire", delay: "Now" },
      { label: "Build the website", delay: "3-7 days" },
      { label: "Set up GBP posting", delay: "After site launch" },
      { label: "Configure missed call text-back", delay: "After site launch" },
    ],
    automatedSteps: [
      "GBP posts 3x/week on autopilot after setup",
      "Missed call text-back runs 24/7 after phone number configured",
      "Welcome email sent automatically at purchase",
    ],
    steps: [
      {
        label: "Send Intake Questionnaire",
        description: "Collect brand info, goals, content, and assets for the website build.",
        action: "send_email",
        emailSubject: "Let's build your digital foundation — quick intake",
        emailBody: `Hey [NAME],\n\nExcited to get started on your Digital Foundation package! This includes your website, Google Business Profile posting, and Missed Call Text-Back.\n\nFirst, I need a few things for the website:\n\n1. Business name and tagline\n2. Primary services\n3. Logo and brand colors\n4. Photos of your work/team\n5. Your main business phone number\n6. Google Business Profile login (I'll help if you don't have one)\n\nOnce I have these I'll move fast.\n\n— Matt\n(313) 806-4952`,
        nextStage: "📋 Awaiting Intake",
      },
      {
        label: "Build the Website",
        description: "Build the client's website using intake info.",
        action: "manual_check",
        checkText: "Site Built ✓",
        nextStage: "🔨 Building",
      },
      {
        label: "Set Up GBP Posting",
        description: "Get GBP Manager access and save their profile ID for automated posting.",
        action: "field_input",
        fieldLabel: "GBP Profile ID",
        fieldPlaceholder: "e.g. 123456789",
        dbField: "notes",
        nextStage: "⚙️ Configuring GBP",
      },
      {
        label: "Configure Missed Call Text-Back",
        description: "Save their business phone number for missed call auto-texts.",
        action: "field_input",
        fieldLabel: "Business Phone Number",
        fieldPlaceholder: "(313) 555-1234",
        dbField: "phone",
        nextStage: "🧪 Testing",
      },
      {
        label: "Launch & Confirm Everything Active",
        description: "Site live, GBP posting, missed call — all systems go.",
        action: "complete",
        nextStage: "✅ Active",
      },
    ],
  },
};

/* Default guide for any product not explicitly listed */
export const DEFAULT_GUIDE: ProductGuide = {
  name: "New Service", icon: "⚡", needsSetup: true,
  timeline: [
    { label: "Send welcome email", delay: "Now" },
    { label: "Complete setup", delay: "Within 24 hours" },
  ],
  automatedSteps: [],
  steps: [
    {
      label: "Send Welcome & Setup Email",
      description: "Email the customer confirming their purchase and explaining what happens next.",
      action: "send_email",
      emailSubject: "Your service is being set up",
      emailBody: `Hey [NAME],\n\nThanks for signing up! I'm setting up your service now and will be in touch within 24 hours with next steps.\n\nQuestions? Reply here or text (313) 806-4952.\n\n— Matt`,
      nextStage: "📧 Contacted",
    },
    {
      label: "Complete Setup",
      description: "Perform any manual setup steps required for this service.",
      action: "manual_check",
      checkText: "Setup Complete ✓",
      nextStage: "✅ Active",
    },
  ],
};

/* Products that are 100% automatic — no action needed */
export const AUTO_PRODUCTS = new Set([
  "website_audit", "gbp_post_pack", "competitor_report",
  "field_rep_subscription", "b2b_database_subscription",
  "review_responder_subscription", "seo_report_subscription",
]);

/** SMS product types that share the generic SMS guide */
const SMS_TYPES = new Set([
  "review_monitor", "sms_blast", "noshow_rebooker", "estimate_drip",
  "invoice_chaser", "afterjob_drip", "promo_blaster", "referral_program",
  "slow_day_sms", "homeowner_campaign",
]);

export function getGuide(serviceType: string): ProductGuide {
  if (AUTO_PRODUCTS.has(serviceType)) {
    return { name: serviceType, icon: "✅", needsSetup: false, steps: [], automatedSteps: ["This product is fully automated. No setup required."] };
  }
  if (SMS_TYPES.has(serviceType)) {
    return { ...GUIDES.sms_product, name: serviceType };
  }
  return GUIDES[serviceType] ?? { ...DEFAULT_GUIDE, name: serviceType };
}

/** Human-readable product name from service_type key */
export function productLabel(serviceType: string): string {
  const guide = getGuide(serviceType);
  if (guide.name === serviceType) {
    // Convert snake_case to Title Case
    return serviceType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return guide.name;
}
