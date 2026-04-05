/**
 * Admin Guides — step-by-step contextual help for every admin tool.
 * Used by AdminHelpCard to show inline guides on each tab.
 */

export interface GuideScenario {
  trigger: string;
  steps: string[];
}

export interface GuideContent {
  id: string;
  title: string;
  body: string;
  tips?: string[];
  scenarios?: GuideScenario[];
  whenSomeoneBuys?: string;
}

export const ADMIN_GUIDES: Record<string, GuideContent> = {
  /* ── QUICK ACTIONS ──────────────────────────────────────── */
  "command-deck": {
    id: "command-deck",
    title: "Command Deck — Your Control Center",
    body: "One-tap buttons for your most common admin tasks. Use this when you need to do something fast — send a test email, trigger a cron, or run a quick action.",
    tips: [
      "Quick Fire Actions trigger edge functions instantly",
      "Test Email verifies your Resend email setup is working",
      "Agent status cards show which AI agents are online or scheduled",
    ],
  },

  "lead-command": {
    id: "lead-command",
    title: "Lead Command Center",
    body: "Your prospecting pipeline. See every lead that's been discovered, contacted, or replied. This is where you find new customers.",
    tips: [
      "Leads are auto-discovered daily from Google Maps across 45+ industries",
      "Lead scores (0-100) are calculated by Scout AI based on website quality, GBP presence, review count",
      "Click a lead to see their full profile, then use Sniper AI to generate a personalized cold email",
      "Hot leads (score 70+) should be prioritized — they're most likely to buy",
    ],
    scenarios: [
      {
        trigger: "A lead replies to your cold email",
        steps: [
          "Tom Agent will flag the reply in your notifications",
          "Open the lead and read their reply",
          "If interested: reply with pricing or schedule a call",
          "If asking questions: answer and share your portfolio page",
          "Update their status to 'replied' or 'won'",
        ],
      },
    ],
  },

  /* ── BUSINESS ───────────────────────────────────────────── */
  "biz-overview": {
    id: "biz-overview",
    title: "Business Dashboard — Your Daily Check-in",
    body: "This is your first stop every morning. See total MRR (monthly recurring revenue), active clients by product, email delivery stats, and drip campaign conversions.",
    tips: [
      "MRR = sum of all active subscription monthly prices",
      "Client counts are pulled from 23+ product tables in real-time",
      "Email stats show delivery success rate from your Resend sends",
      "Green = healthy, Yellow = needs attention, Red = action required",
    ],
  },

  fulfillment: {
    id: "fulfillment",
    title: "Fulfillment Tracker — Onboard New Clients",
    body: "When someone buys a service, they show up here with step-by-step instructions. Follow the steps in order — each one tells you exactly what to do. Click email buttons to send pre-written emails with one tap.",
    tips: [
      "New purchases appear with an orange 'Action Required' badge",
      "Each product has its own guide with 2-6 steps",
      "Email buttons open pre-written emails in your mail app — just hit send",
      "Field inputs save directly to the client's database record",
      "Once all steps are done, status changes to 'Active'",
    ],
    whenSomeoneBuys: "Open Fulfillment, find the new client at the top, and follow the numbered steps. Each step has a button — email, check, or save. Work through them in order. The whole process takes 5-15 minutes per client.",
    scenarios: [
      {
        trigger: "Someone buys GBP SaaS ($49-99/mo)",
        steps: [
          "Email them asking to add you as GBP Manager (pre-written, one click)",
          "Wait for them to accept (usually 1-2 days)",
          "Accept the invitation in your Google Business account",
          "Save their GBP Profile ID to their record",
          "Verify the first auto-post goes out on Mon/Wed/Fri",
        ],
      },
      {
        trigger: "Someone buys Web Design ($499-3499)",
        steps: [
          "Send intake questionnaire email (pre-written, one click)",
          "Review their answers when they reply",
          "Build the site (3-7 days)",
          "Send preview link for review",
          "Apply revisions (up to 2 rounds)",
          "Launch the site and request a Google review",
        ],
      },
      {
        trigger: "Someone buys Missed Call SMS ($49/mo)",
        steps: [
          "Email asking for their business phone number (one click)",
          "Save the phone number to their profile",
          "Test the system — call their number, don't answer, wait for auto-text",
          "Send go-live confirmation email",
        ],
      },
    ],
  },

  ops: {
    id: "ops",
    title: "Ops Center — Full Product Roster",
    body: "See every product line with client counts and MRR. This is your bird's-eye view of the entire operation — all 17+ product types in one table.",
    tips: [
      "Each row shows: product name, active client count, MRR contribution",
      "Click any product row to see its specific clients",
      "Total MRR at the bottom is your monthly recurring revenue",
    ],
  },

  pipeline: {
    id: "pipeline",
    title: "B2B Pipeline — Track Your Sales Funnel",
    body: "Visual pipeline of B2B clients from prospect to active. Drag clients between stages or update their status. Real-time updates via Supabase.",
    tips: [
      "Stages: New → Contacted → Proposal Sent → Won → Active",
      "Click a client card to see their full details and history",
      "New leads from the Prospector appear in the 'New' column automatically",
    ],
  },

  revenue: {
    id: "revenue",
    title: "Revenue & Ledger",
    body: "Detailed financial tracking. See Stripe payments, subscription status, and revenue trends. Use 'Force Stripe Sync' if a user's tier looks wrong.",
    tips: [
      "Revenue data comes directly from your Stripe account",
      "Force Stripe Sync fixes tier mismatches caused by webhook delays",
      "Export data to CSV for your accountant at tax time",
    ],
  },

  health: {
    id: "health",
    title: "Client Health Monitor",
    body: "Monitors whether your automated services are actually delivering. Each client gets a health score based on when the service last ran successfully.",
    tips: [
      "Green = delivered within expected window",
      "Yellow = delivery slightly delayed",
      "Red = service hasn't delivered — investigate immediately",
      "Checks 22 different service types automatically",
    ],
  },

  sandbox: {
    id: "sandbox",
    title: "Product Sandbox — Test Everything",
    body: "Run $0 test checkouts for any product. This creates a real Stripe session but charges nothing. Use this to verify the entire purchase flow works before selling to real clients.",
    tips: [
      "Test checkouts use your email (matt@mattmichelstraining.com)",
      "The full flow runs: Stripe checkout → webhook → client creation → emails",
      "After testing, delete test records from the relevant product table",
    ],
  },

  referrals: {
    id: "referrals",
    title: "Referrals",
    body: "Track referral program activity. See who's referring new clients and how much credit they've earned.",
  },

  "email-log": {
    id: "email-log",
    title: "Email Log",
    body: "Every email sent by the system. Check delivery status, bounce rates, and troubleshoot failed sends. Filter by date or recipient.",
  },

  /* ── MARKETING ──────────────────────────────────────────── */
  "ad-campaigns": {
    id: "ad-campaigns",
    title: "Ad Campaigns — Your Marketing Arsenal",
    body: "Landing page URLs for ad campaigns, Selma's AI campaign queue, and the AI campaign generator. Copy landing page URLs and use them in Facebook/Google ads.",
    tips: [
      "Ad Pages section has click-to-copy URLs for all your landing pages",
      "Use /ad/digital-foundation for your main paid ad campaigns",
      "Use /ad/free-audit as a lead magnet — free visibility score",
      "Selma AI generates campaign ideas and ad copy automatically",
    ],
  },

  outreach: {
    id: "outreach",
    title: "Email Outreach",
    body: "Manage cold email campaigns. See sent emails, open rates, and reply tracking. The system sends up to 40 personalized emails per day automatically.",
    tips: [
      "Outreach runs automatically — 40 emails/day cap",
      "Emails are AI-personalized per prospect using Sniper AI",
      "4-email drip sequence fires after initial outreach",
      "Tom Agent monitors for replies and flags hot leads",
    ],
  },

  "m2-hub": {
    id: "m2-hub",
    title: "Growth Hub",
    body: "Central hub for growth initiatives. Track your marketing experiments, content pipeline, and growth metrics.",
  },

  /* ── AGENCY ─────────────────────────────────────────────── */
  crm: {
    id: "crm",
    title: "Web Design CRM",
    body: "Track web design clients from lead to launch. Every project has stages: Lead → Proposal → Intake → Building → Review → Live. Update status as you work through each project.",
    tips: [
      "Click a client to see their full project details",
      "Use the timeline to track communications and milestones",
      "After launch, move them to 'Active' and set up retainer billing",
    ],
    whenSomeoneBuys: "They'll appear in Fulfillment first. After you send the intake questionnaire and start building, track progress here in the CRM.",
  },

  prospector: {
    id: "prospector",
    title: "Prospector — Find New Clients",
    body: "AI-powered lead discovery. The system searches Google Maps daily for local businesses that need web design, GBP, or digital marketing. Results are scored and ranked.",
    tips: [
      "Runs daily across 45+ industries and 100+ Michigan cities",
      "Lead Score: 80+ = excellent prospect, 50-79 = good, below 50 = low priority",
      "Click 'Generate Email' to have Sniper AI write a personalized cold email",
      "Click 'Start Drip' to begin the 4-email automated sequence",
      "Filter by industry, city, or score to focus your outreach",
    ],
    scenarios: [
      {
        trigger: "You want to find new web design clients",
        steps: [
          "Open Prospector — new leads appear daily",
          "Sort by lead score (highest first)",
          "Click the best leads to review their website and GBP",
          "Click 'Generate Email' for a personalized cold email",
          "Click 'Start Drip' to begin the 4-email sequence",
          "Tom Agent monitors for replies — you'll be notified",
        ],
      },
    ],
  },

  "agency-crm": {
    id: "agency-crm",
    title: "Agency CRM — All B2B Clients",
    body: "Master client list across all agency services. Every B2B client (web design, GBP, social media, SMS, etc.) appears here with their service subscriptions and status.",
    tips: [
      "Search by business name, email, or industry",
      "Each client card shows all their active services",
      "Click to see full client profile with communication history",
    ],
  },

  "site-builder": {
    id: "site-builder",
    title: "Site Builder",
    body: "AI-powered website generator. Enter business details and Builder Agent creates a complete website automatically. Use this to quickly prototype sites for web design clients.",
    tips: [
      "Enter business name, industry, and key services",
      "Builder generates a full multi-page site in minutes",
      "Export the generated code and customize as needed",
    ],
  },

  automation: {
    id: "automation",
    title: "Automation Hub",
    body: "One-button triggers for the full outreach sequence. Select leads and fire the complete pipeline: cold email → drip sequence → follow-up.",
  },

  /* ── PEOPLE ─────────────────────────────────────────────── */
  athletes: {
    id: "athletes",
    title: "All Users",
    body: "Every registered user on the platform. Search, filter, manage subscriptions, send magic login links, and extend trials.",
    tips: [
      "Send Magic Link: lets a user log in without a password",
      "Extend Trial: adds days to any user's free trial",
      "Click any user to see their full profile, workouts, and subscription history",
    ],
  },

  support: {
    id: "support",
    title: "Support Tickets",
    body: "Open support tickets from users. AI can triage and suggest responses. Reply directly from here or escalate complex issues.",
  },

  /* ── TRAINING ───────────────────────────────────────────── */
  programs: {
    id: "programs",
    title: "Programs",
    body: "Create and manage training programs. AI can generate entire multi-week programs based on your parameters.",
  },

  "ai-queue": {
    id: "ai-queue",
    title: "AI Queue",
    body: "AI-generated content waiting for your approval. Review and approve before it goes live to athletes.",
  },
};

/** Get guide for a tool key, returns undefined if no guide exists */
export function getAdminGuide(toolKey: string): GuideContent | undefined {
  return ADMIN_GUIDES[toolKey];
}
