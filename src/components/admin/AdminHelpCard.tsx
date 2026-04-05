/**
 * AdminHelpCard — dismissible first-visit help popups for each admin tab.
 *
 * Usage:
 *   <AdminHelpCard id="business" title="Business Tab" body="This is where you…" />
 *
 * Stores dismissed state in localStorage so it only shows once per browser.
 * The user can call `resetAdminHelp()` to show all cards again (see AdminCommandDeck).
 */
import { useState } from "react";
import { X, Info, ChevronDown, ChevronUp } from "lucide-react";

const LS_PREFIX = "admin-help-dismissed-";

export function isHelpDismissed(id: string): boolean {
  try {
    return localStorage.getItem(`${LS_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

export function dismissHelp(id: string) {
  try {
    localStorage.setItem(`${LS_PREFIX}${id}`, "1");
  } catch {}
}

export function resetAdminHelp() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

interface GuideScenario {
  trigger: string;
  steps: string[];
}

interface AdminHelpCardProps {
  id: string;
  title: string;
  body: string;
  tips?: string[];
  scenarios?: GuideScenario[];
  whenSomeoneBuys?: string;
  color?: string;
}

export function AdminHelpCard({ id, title, body, tips, scenarios, whenSomeoneBuys, color = "border-primary/30 bg-primary/5" }: AdminHelpCardProps) {
  const [dismissed, setDismissed] = useState(() => isHelpDismissed(id));
  const [collapsed, setCollapsed] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissHelp(id);
    setDismissed(true);
  };

  return (
    <div className={`rounded-lg border ${color} mb-4 overflow-hidden transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Info size={13} className="text-primary flex-shrink-0" />
        <span className="text-xs font-bold text-foreground flex-1">{title}</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label="Toggle"
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{body}</p>

          {/* When Someone Buys callout */}
          {whenSomeoneBuys && (
            <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-2.5 mb-3">
              <p className="text-[10px] font-bold text-orange-400 mb-1">When someone buys this:</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{whenSomeoneBuys}</p>
            </div>
          )}

          {tips && tips.length > 0 && (
            <ul className="space-y-1 mb-3">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                  <span className="text-[11px] text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Scenarios accordion */}
          {scenarios && scenarios.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowScenarios((s) => !s)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition"
              >
                {showScenarios ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                Common Scenarios ({scenarios.length})
              </button>
              {showScenarios && (
                <div className="mt-2 space-y-2">
                  {scenarios.map((s, i) => (
                    <div key={i} className="rounded-md border border-border/40 bg-muted/10 p-2.5">
                      <p className="text-[10px] font-bold text-foreground mb-1.5">{s.trigger}</p>
                      <ol className="space-y-0.5">
                        {s.steps.map((step, j) => (
                          <li key={j} className="text-[10px] text-muted-foreground flex gap-1.5">
                            <span className="text-primary font-bold shrink-0">{j + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleDismiss}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
          >
            Got it — don't show again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pre-configured help cards for every master tab ───────────────────────────

export const TAB_HELP: Record<string, Omit<AdminHelpCardProps, "id">> = {
  command: {
    title: "Command Deck — Your Control Center",
    body: "This is your one-stop dashboard for running the entire business with single taps. Every automation, every product, every quick action lives here.",
    tips: [
      "Quick Fire Actions trigger edge functions instantly — no scheduling needed",
      "AI Model Selector lets you pick Haiku (cheap/fast) vs Sonnet (smarter) per task type",
      "Power Tools handle bulk operations: approve queues, export CSVs, extend trials",
      "Global Announcement pushes a banner to every user on the site immediately",
    ],
  },
  business: {
    title: "Business Tab",
    body: "Overview of all revenue streams, automation fulfillment, and product health. Start here when you open the admin each day.",
    tips: [
      "Fulfillment shows which new subscribers need onboarding actions",
      "Ops Center shows MRR + client counts across all 17 products",
      "Product Sandbox lets you run $0 test checkouts for any product",
      "DB Migrations shows which schema updates have been applied",
    ],
  },
  ai: {
    title: "AI Command Center",
    body: "Central hub for every AI-powered feature: content creation, coaching replies, business analysis, and media. If it uses Claude, it's here.",
    tips: [
      "Coach AI Queue: review AI-drafted replies before they're sent to athletes",
      "AI Approval Queue: AI-generated content waiting for your sign-off",
      "CMO Intelligence generates weekly business reports automatically",
      "Churn Radar uses AI to flag clients likely to cancel",
    ],
  },
  roster: {
    title: "The Roster — Users, Support & Families",
    body: "Everything about your athletes. Search users, manage subscriptions, handle support tickets, coach reviews, and family accounts.",
    tips: [
      "Send Magic Link: lets a user log in without a password (great for support)",
      "Extend Trial: adds days to any user's free trial instantly",
      "Support Tickets: AI can triage and suggest responses automatically",
      "Families: link parent + child accounts to share a subscription",
    ],
  },
  engine: {
    title: "Training Engine — Programs, Workouts & AI Content",
    body: "Build and manage all training content. AI can generate entire programs, exercises, and daily workouts in seconds.",
    tips: [
      "AI Workouts: set parameters (style, equipment, audience) and generate in bulk",
      "AI Queue: review AI-generated content before it goes live to athletes",
      "Lift Videos & Prove It: athlete submissions waiting for your feedback",
      "Monthly Focus: set the theme for the whole month's programming",
    ],
  },
  vault: {
    title: "The Vault — Revenue, Payments & Business",
    body: "All financial data, subscription management, promotions, referrals, and legal. Your money command center.",
    tips: [
      "Force Stripe Sync: use this if any user's subscription tier looks wrong",
      "Churn Radar: AI-powered early warning system for at-risk subscribers",
      "Trash: soft-deleted items are kept for 30 days before permanent removal",
      "Referrals: see who's bringing in new clients and how much credit they've earned",
    ],
  },
  content: {
    title: "Site Content — CMS, Newsletter & Marketing",
    body: "Edit the public website, compose newsletters, manage subscribers, and run AI-powered marketing campaigns.",
    tips: [
      "Compose: write a newsletter topic and AI generates the full email",
      "Broadcasts: one-off emails to your subscriber list",
      "Media Vault: store and organize images, videos, and assets",
      "CMO Reports: AI analyzes your business and writes a weekly CEO brief",
    ],
  },
  growth: {
    title: "Growth — Outreach, SEO & Social",
    body: "Everything for growing the business: outreach campaigns, SEO content, Google Business Profile, Instagram, and ad campaigns.",
    tips: [
      "Prospector: AI finds local businesses that need web design services",
      "GBP Posts: AI posts 3x/week to Google Business for your clients",
      "Instagram: AI-generated posts for your Instagram account",
      "Search Console: monitor how pages rank on Google",
    ],
  },
  webdesign: {
    title: "Web Design — Leads, CRM & Projects",
    body: "Manage the web design service line end-to-end: prospect, CRM, build sites, and automate follow-up drip campaigns.",
    tips: [
      "B2B Pipeline: track every prospective web design client through the funnel",
      "Automation Hub: one button triggers the full outreach sequence for any lead",
      "Site Builder: generate complete websites for clients automatically",
      "Demo Links: create shareable demo URLs for client mockups",
    ],
  },
};
