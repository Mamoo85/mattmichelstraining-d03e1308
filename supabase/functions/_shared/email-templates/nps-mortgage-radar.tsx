/**
 * NPS survey email — Mortgage Radar.
 * Renders a simple inline HTML string; sender invokes this to build the body.
 */
export function npsMortgageRadarHtml(opts: { firstName?: string; replyTo: string; milestoneDay: number }) {
  const name = opts.firstName ? `${opts.firstName}, ` : "";
  return /* html */ `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;background:#f6f8fb;padding:32px;color:#0a1628">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e2e8f0">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Mortgage Radar — Day ${opts.milestoneDay} check-in</p>
      <h1 style="margin:0 0 12px;font-size:22px">Quick favor, ${name}take 10 seconds?</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        On a scale of <strong>1–10</strong>, how likely are you to recommend Mortgage Radar to another LO?
      </p>
      <p style="margin:0 0 16px">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<a href="mailto:${opts.replyTo}?subject=NPS%20${n}&body=Score:%20${n}%0A%0AWhy?" style="display:inline-block;margin:2px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;text-decoration:none;color:#0a1628;font-weight:600">${n}</a>`).join("")}
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#64748b">— Matt @ Detroit Web Agency</p>
    </div>
  </div>`;
}
