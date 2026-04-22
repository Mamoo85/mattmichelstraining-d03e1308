import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Handshake } from "lucide-react";

/**
 * Channel 6 — Trade association co-branded share kit
 * Generates a copy-paste HTML block for partner newsletters
 * (Detroit Regional Chamber, ABC of Michigan, MCA Detroit, etc).
 */
export default function AdminPartnerSignalShare() {
  const [partner, setPartner] = useState({
    name: "MCA Detroit",
    slug: "mca-detroit",
    couponCode: "MCA50",
    discountLabel: "$50 off first month",
    contact: "membership@mcadetroit.org",
  });
  const [signalCount, setSignalCount] = useState(42);

  const landingUrl = `https://www.detroitwebagent.com/p/${partner.slug}`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#0a1628;color:#fff;padding:24px;border-radius:12px;max-width:600px;margin:0 auto">
  <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#22d3ee;margin-bottom:8px">${partner.name} Member Spotlight</div>
  <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3">Free Industrial Hiring Intelligence for ${partner.name} Members</h2>
  <p style="color:#cbd5e1;line-height:1.6;margin:0 0 16px">
    Detroit Web Agency is offering ${partner.name} members <strong>2 free dossiers</strong> from this week's
    <strong>${signalCount} flagged Metro Detroit manufacturers</strong> who just posted hiring signals — meaning
    they are about to spend on equipment, consumables, and services.
  </p>
  <p style="color:#cbd5e1;line-height:1.6;margin:0 0 20px">
    Members get the full firehose at <strong>${partner.discountLabel}</strong> with code
    <code style="background:#1e293b;padding:2px 8px;border-radius:4px;color:#22d3ee">${partner.couponCode}</code>.
  </p>
  <a href="${landingUrl}?utm_source=${partner.slug}&utm_medium=newsletter&utm_campaign=partner_share"
     style="display:inline-block;background:#22d3ee;color:#0a1628;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none">
    Claim Free Dossiers →
  </a>
  <p style="color:#64748b;font-size:12px;margin:24px 0 0">
    Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219
  </p>
</div>`;

  const emailSubject = `${partner.name} Members: Free Industrial Hiring Intelligence (${signalCount} signals this week)`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Handshake className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold">Partner Signal Share Kit</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Generate a co-brandable HTML block for trade association newsletters. Trust transfer = removes
        "unknown company" objection. Aim: Detroit Regional Chamber, ABC of MI, MCA Detroit, MMA.
      </p>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">1. Partner details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Partner name</Label>
            <Input value={partner.name} onChange={(e) => setPartner({ ...partner, name: e.target.value })} />
          </div>
          <div>
            <Label>URL slug (lowercase, hyphens)</Label>
            <Input value={partner.slug} onChange={(e) => setPartner({ ...partner, slug: e.target.value })} />
          </div>
          <div>
            <Label>Stripe coupon code</Label>
            <Input value={partner.couponCode} onChange={(e) => setPartner({ ...partner, couponCode: e.target.value })} />
          </div>
          <div>
            <Label>Discount label</Label>
            <Input value={partner.discountLabel} onChange={(e) => setPartner({ ...partner, discountLabel: e.target.value })} />
          </div>
          <div>
            <Label>Partner contact email</Label>
            <Input value={partner.contact} onChange={(e) => setPartner({ ...partner, contact: e.target.value })} />
          </div>
          <div>
            <Label>Signals this week</Label>
            <Input type="number" value={signalCount} onChange={(e) => setSignalCount(Number(e.target.value))} />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">2. Email subject line</h3>
          <Button size="sm" variant="outline" onClick={() => handleCopy(emailSubject, "Subject")}>
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
        </div>
        <code className="block bg-muted p-3 rounded text-sm">{emailSubject}</code>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">3. Co-branded HTML block</h3>
          <Button size="sm" onClick={() => handleCopy(html, "HTML block")}>
            <Copy className="w-4 h-4 mr-2" /> Copy HTML
          </Button>
        </div>
        <Textarea readOnly value={html} className="font-mono text-xs h-64" />
        <p className="text-xs text-muted-foreground">
          Paste into the partner's newsletter editor. UTM tagged for attribution. Landing URL:{" "}
          <code>{landingUrl}</code>
        </p>
      </Card>

      <Card className="p-6 space-y-3">
        <h3 className="font-semibold">4. Outreach pitch to send to {partner.contact}</h3>
        <Textarea
          readOnly
          className="text-sm h-48"
          value={`Hi ${partner.name} team,

I run Detroit Web Agency — we built a tool that watches public Michigan data sources (MIOSHA, BSEED permits, SAM.gov) for Metro Detroit manufacturers about to spend money. This week we flagged ${signalCount} of them.

Your members — industrial supply reps, distributors, B2B sales — would buy this data. I'd like to offer it to ${partner.name} members at ${partner.discountLabel} (code: ${partner.couponCode}) plus 2 free sample dossiers.

In exchange: a single mention in your member newsletter or one social post. I'll provide the copy-ready HTML.

Worth a 15-min call?

Matt Michels
Detroit Web Agency
(313) 992-1219
matt@detroitwebagent.com`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            handleCopy(
              `Hi ${partner.name} team,\n\nI run Detroit Web Agency — we built a tool that watches public Michigan data sources (MIOSHA, BSEED permits, SAM.gov) for Metro Detroit manufacturers about to spend money. This week we flagged ${signalCount} of them.\n\nYour members — industrial supply reps, distributors, B2B sales — would buy this data. I'd like to offer it to ${partner.name} members at ${partner.discountLabel} (code: ${partner.couponCode}) plus 2 free sample dossiers.\n\nIn exchange: a single mention in your member newsletter or one social post. I'll provide the copy-ready HTML.\n\nWorth a 15-min call?\n\nMatt Michels\nDetroit Web Agency\n(313) 992-1219\nmatt@detroitwebagent.com`,
              "Pitch"
            )
          }
        >
          <Copy className="w-4 h-4 mr-2" /> Copy outreach pitch
        </Button>
      </Card>
    </div>
  );
}
