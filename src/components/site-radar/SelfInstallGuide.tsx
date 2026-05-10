import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  snippet: string;
  installed: boolean;
}

const PLATFORMS = [
  { id: "wordpress", label: "WordPress" },
  { id: "wix", label: "Wix" },
  { id: "squarespace", label: "Squarespace" },
  { id: "shopify", label: "Shopify" },
  { id: "lovable", label: "Lovable" },
  { id: "godaddy", label: "GoDaddy" },
  { id: "webflow", label: "Webflow" },
  { id: "html", label: "Raw HTML" },
];

const STEPS: Record<string, { title: string; steps: string[]; tip?: string }> = {
  wordpress: {
    title: "WordPress (5 clicks)",
    steps: [
      "Log in to your WordPress admin (yoursite.com/wp-admin)",
      "In the left sidebar click Plugins → Add New",
      "Search for 'Insert Headers and Footers' (by WPCode) → Install → Activate",
      "Go to Settings → WPCode → Header & Footer",
      "Paste the snippet into the 'Footer' box (NOT header) → click Save",
    ],
    tip: "The 'Footer' box puts the script before </body>, which is exactly where it needs to go.",
  },
  wix: {
    title: "Wix (Custom Code)",
    steps: [
      "Open your Wix dashboard → Settings",
      "Click Custom Code (under Advanced)",
      "Click + Add Custom Code (top right)",
      "Paste the snippet into the code box",
      "Choose 'All pages' → 'Body — end' → Apply",
    ],
    tip: "Wix Custom Code requires a paid Premium plan. If you're on free, use the Install Concierge below to email your webmaster.",
  },
  squarespace: {
    title: "Squarespace",
    steps: [
      "Open your site → Settings → Advanced → Code Injection",
      "Paste the snippet into the 'Footer' field",
      "Click Save (top left)",
    ],
    tip: "Code Injection requires a Business plan or higher.",
  },
  shopify: {
    title: "Shopify",
    steps: [
      "Shopify admin → Online Store → Themes",
      "Click Actions (next to your live theme) → Edit code",
      "Open Layout → theme.liquid",
      "Find the </body> tag (near the bottom) — paste the snippet on the line ABOVE it",
      "Click Save (top right)",
    ],
  },
  lovable: {
    title: "Lovable (your site here)",
    steps: [
      "Open your Lovable project → click Settings (gear icon)",
      "Find 'Custom HTML' or 'Tracking & Analytics' section",
      "Paste the snippet into the body/footer code block → Save",
      "If your project doesn't have that, message me — I'll add it for you in 30 seconds.",
    ],
    tip: "Most Lovable templates inject custom HTML via index.html. If you built your site here at Detroit Web Agency, just reply to your welcome email and we'll handle it.",
  },
  godaddy: {
    title: "GoDaddy Website Builder",
    steps: [
      "Log in to GoDaddy → My Products → Website Builder → Edit Website",
      "Click + (Add Section) on any page → search 'HTML'",
      "Add the HTML/Custom Code section → paste the snippet",
      "Move it to the footer of the page → Publish",
    ],
    tip: "GoDaddy doesn't have a global header/footer injector on cheaper plans, so you'll add it once per page or use the 'Footer' template if available.",
  },
  webflow: {
    title: "Webflow",
    steps: [
      "Webflow Designer → Project Settings → Custom Code",
      "Paste the snippet into the 'Footer Code' box (NOT head)",
      "Click Save Changes",
      "Hit Publish (top right) → publish to your live domain",
    ],
  },
  html: {
    title: "Raw HTML / any custom site",
    steps: [
      "Open your site's main HTML file (index.html or your template)",
      "Find the closing </body> tag (near the very bottom)",
      "Paste the snippet on the line directly ABOVE </body>",
      "Save and re-deploy",
    ],
    tip: "Same approach works for Next.js (_document.tsx <body> bottom), Astro, Hugo, Jekyll, Eleventy — anywhere with a <body> tag.",
  },
};

export default function SelfInstallGuide({ snippet, installed }: Props) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("wordpress");

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (installed) {
    return (
      <Card className="border-emerald-900/40 bg-[#0a1628]/80 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          ✓ Tracking is live
        </p>
        <p className="mt-1 text-xs text-slate-400">
          You're all set. Your dashboard is updating in real time.
        </p>
      </Card>
    );
  }

  const cur = STEPS[tab];

  return (
    <Card className="border-cyan-900/40 bg-gradient-to-br from-[#0a1628] to-[#0d2547] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            Install SiteRadar in 60 seconds
          </p>
        </div>
        <Badge className="bg-amber-500/15 text-amber-400">Not yet installed</Badge>
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Pick your platform below and follow the steps. The snippet is one line — just paste it before
        the closing <code className="text-cyan-400">&lt;/body&gt;</code> tag (every option below shows
        you exactly where).
      </p>

      {/* The snippet — front and center, big copy button */}
      <div className="mb-4 rounded-lg border border-cyan-900/40 bg-[#030711] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Your snippet
          </span>
          <Button
            onClick={copy}
            size="sm"
            className="h-7 bg-cyan-400 text-slate-900 hover:bg-cyan-300"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" /> Copied!
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" /> Copy snippet
              </>
            )}
          </Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-cyan-200">
          {snippet}
        </pre>
      </div>

      {/* Platform tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 flex h-auto flex-wrap justify-start gap-1 bg-[#030711] p-1">
          {PLATFORMS.map((p) => (
            <TabsTrigger
              key={p.id}
              value={p.id}
              className="text-xs data-[state=active]:bg-cyan-400 data-[state=active]:text-slate-900"
            >
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORMS.map((p) => {
          const s = STEPS[p.id];
          return (
            <TabsContent key={p.id} value={p.id} className="mt-0">
              <div className="rounded-lg border border-slate-800 bg-[#030711] p-4">
                <h4 className="mb-3 text-sm font-bold text-white">{s.title}</h4>
                <ol className="space-y-2 text-xs text-slate-300">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-400">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                {s.tip && (
                  <p className="mt-3 rounded border border-cyan-900/40 bg-cyan-400/5 p-2 text-[11px] leading-relaxed text-cyan-200">
                    💡 {s.tip}
                  </p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
        <p className="flex-1 text-[11px] text-slate-500">
          Status flips to <span className="text-emerald-400">Live</span> automatically the moment
          your first visitor pings.
        </p>
        <a
          href="mailto:matt@detroitwebagent.com?subject=SiteRadar%20install%20help"
          className="text-[11px] text-cyan-400 hover:underline"
        >
          Need help? Email me <ExternalLink className="ml-0.5 inline h-3 w-3" />
        </a>
      </div>
    </Card>
  );
}
