import { useRef, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Download, PenLine, RotateCcw, Phone, Mail, MapPin } from "lucide-react";

const ORANGE = "#e8621a";
const DARK = "#1e293b";
const LIGHT = "#f8fafc";
const BORDER = "#e2e8f0";

/* ─── Signature Pad ────────────────────────────────────────────────────── */
function SignaturePad({ onSign }: { onSign: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const start = (e: MouseEvent | TouchEvent) => {
      drawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setSigned(true);
      e.preventDefault();
    };
    const stop = () => {
      if (drawing.current) {
        drawing.current = false;
        onSign(canvas.toDataURL());
      }
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", stop);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", stop);
    };
  }, [onSign]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    onSign("");
  };

  return (
    <div>
      <div className="relative border-2 border-dashed rounded-lg overflow-hidden" style={{ borderColor: signed ? ORANGE : BORDER, background: "#fafafa" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <PenLine size={16} /> Draw your signature here
            </span>
          </div>
        )}
      </div>
      {signed && (
        <button onClick={clear} className="mt-2 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <RotateCcw size={12} /> Clear and redo
        </button>
      )}
    </div>
  );
}

/* ─── Section Heading ──────────────────────────────────────────────────── */
function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: ORANGE }}>
        {number}
      </div>
      <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: DARK }}>{title}</h3>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */
export default function ProposalStewartDental() {
  const [agreed, setAgreed] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [clientName, setClientName] = useState("Dr. Robert B. Stewart, DDS, MS");
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const handleSubmit = () => {
    if (!agreed || !signatureData) return;
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = () => window.print();

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: LIGHT }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: ORANGE }}>
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: DARK }}>Agreement Signed!</h1>
          <p className="text-slate-600 mb-6">Thanks, Dr. Stewart. Matt will be in touch within 24 hours to get started. Check your email for a copy of this agreement.</p>
          <div className="text-sm text-slate-500 border rounded-lg p-4" style={{ borderColor: BORDER }}>
            <p className="font-medium mb-1">Questions? Contact Matt directly:</p>
            <p>(313) 806-4952 | matt@mattmichelstraining.com</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Website Proposal — Stewart Dental Group | Matt Michels Training, LLC</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { font-size: 12px; }
          canvas { display: none; }
          .sig-placeholder::after { content: "________________________"; display: block; border-bottom: 1px solid #000; width: 300px; margin-top: 40px; }
        }
      `}</style>

      <div className="min-h-screen" style={{ background: LIGHT, fontFamily: "system-ui, sans-serif" }}>

        {/* ── Header ── */}
        <div className="text-white py-10 px-6 print-header" style={{ background: DARK }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Matt Michels Training, LLC</div>
                <h1 className="text-2xl sm:text-3xl font-bold">Website Design Proposal</h1>
                <p className="text-slate-400 text-sm mt-1">Prepared for Stewart Dental Group · April 2026</p>
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <div className="flex items-center gap-2"><Phone size={13} />(313) 806-4952</div>
                <div className="flex items-center gap-2"><Mail size={13} />matt@mattmichelstraining.com</div>
                <div className="flex items-center gap-2"><MapPin size={13} />Grosse Pointe, MI</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">

          {/* ── Action buttons ── */}
          <div className="flex gap-3 no-print">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-white transition-colors" style={{ borderColor: BORDER, color: DARK }}>
              <Download size={14} /> Download / Print PDF
            </button>
          </div>

          {/* ── Project Overview ── */}
          <div className="bg-white rounded-xl border p-6 sm:p-8" style={{ borderColor: BORDER }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>Project Overview</div>
            <p className="text-slate-700 leading-relaxed">
              A fully custom, premium website for Stewart Dental Group — designed to represent a Mayo Clinic-trained, board-certified prosthodontist at the level your Grosse Pointe patients expect. Mobile-first, fast, and built to generate new patient inquiries for implants, crowns, veneers, and CAD/CAM same-day procedures.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {["8 Custom Pages", "Mobile Optimized", "Local SEO Built-In", "SSL + Domain", "Google Analytics", "Contact Form"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={14} style={{ color: ORANGE }} /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* ── What's Included ── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: BORDER }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ORANGE }}>What's Included</div>
              <ul className="space-y-2 text-sm text-slate-700">
                {[
                  "Home page (matching approved design)",
                  "About Dr. Stewart",
                  "Dental Implants page",
                  "Crowns & Bridges page",
                  "Veneers & Cosmetic page",
                  "CAD/CAM Same-Day Crowns page",
                  "New Patients page",
                  "Contact page with map",
                  "Service page copywriting",
                  "Local SEO keywords on every page",
                  "Mobile-responsive on all devices",
                  "Google Analytics 4 setup",
                  "SSL certificate (https)",
                  "Domain connection",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: BORDER }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Not Included (Available Add-Ons)</div>
              <ul className="space-y-2 text-sm text-slate-500">
                {[
                  "Patient intake forms (HIPAA-compliant tool req. ~$30/mo + $200 setup)",
                  "Online scheduling integration",
                  "Custom logo design",
                  "Professional photography",
                  "Patient portal",
                ].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-slate-300">—</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Pricing ── */}
          <div className="bg-white rounded-xl border p-6 sm:p-8" style={{ borderColor: BORDER }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: ORANGE }}>Investment</div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Website design & build (8 pages)", "$1,500"],
                  ["Monthly hosting & maintenance", "$99/mo"],
                ].map(([label, price]) => (
                  <tr key={label} className="border-b last:border-0" style={{ borderColor: BORDER }}>
                    <td className="py-3 text-slate-700">{label}</td>
                    <td className="py-3 text-right font-bold" style={{ color: DARK }}>{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 p-3 rounded-lg text-sm text-slate-600" style={{ background: LIGHT }}>
              <span className="font-medium">Payment:</span> $750 deposit to begin · $750 at launch · Maintenance starts at launch
            </div>
          </div>

          {/* ── Free Bundle ── */}
          <div className="rounded-xl border-2 p-6 sm:p-8" style={{ borderColor: ORANGE, background: "#fff8f5" }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Free for Your First 60 Days</div>
            <p className="text-slate-600 text-sm mb-5">I'm including three automated marketing services so you can see exactly what they do — no pitch, just results.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: "GBP Posts", desc: "AI-written posts to your Google Business Profile 3x/week. Keeps you active in local search.", value: "$300–$500/mo value" },
                { title: "Social Media AI", desc: "Facebook + Instagram posts 3x/week. Professional dental content, no patient photos needed.", value: "$500–$800/mo value" },
                { title: "Review Monitor", desc: "Instant alerts on every new Google and Yelp review so nothing goes unanswered.", value: "$99–$199/mo value" },
              ].map(s => (
                <div key={s.title} className="bg-white rounded-lg p-4 border" style={{ borderColor: BORDER }}>
                  <div className="font-bold text-sm mb-1" style={{ color: DARK }}>{s.title}</div>
                  <p className="text-xs text-slate-500 mb-2">{s.desc}</p>
                  <div className="text-xs font-bold" style={{ color: ORANGE }}>{s.value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">Total free value: ~$900–$1,500/mo. After 60 days: continue all three for $199/mo (agencies charge 5–10× this).</p>
          </div>

          {/* ── Timeline ── */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: BORDER }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: ORANGE }}>Timeline</div>
            <div className="space-y-3">
              {[
                ["Day 1", "Kickoff + content questionnaire sent to you"],
                ["Day 7", "Your content due (logo, photos, services list)"],
                ["Day 14", "Design mockup delivered for your review"],
                ["Day 21", "Full site live on staging URL"],
                ["Days 22–28", "Your revisions (2 rounds included)"],
                ["Day 30–35", "Launch on stewartdentalgroup.com"],
              ].map(([day, desc]) => (
                <div key={day} className="flex gap-4 text-sm">
                  <div className="w-20 flex-shrink-0 font-bold text-right" style={{ color: ORANGE }}>{day}</div>
                  <div className="text-slate-600">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CONTRACT ── */}
          <div className="bg-white rounded-xl border p-6 sm:p-8 print-break" style={{ borderColor: BORDER }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Service Agreement</div>
            <h2 className="text-lg font-bold mb-1" style={{ color: DARK }}>Web Design Services Agreement</h2>
            <p className="text-xs text-slate-500 mb-6">Matt Michels Training, LLC ("Designer") · Stewart Dental Group ("Client") · April 2026</p>

            <div className="space-y-0 text-sm text-slate-700 leading-relaxed">
              {[
                {
                  n: "1", title: "Scope of Work",
                  body: "Designer will design and develop a website as described in the Proposal above (up to 8 pages, contact form, Google Maps embed, Analytics setup, SSL, domain connection, service page copy). Work not listed in the Proposal — including patient intake forms, HIPAA-compliant tools, online scheduling, or logo design — is out of scope and will be quoted separately before any additional work begins.",
                },
                {
                  n: "2", title: "Payment",
                  body: "Total project fee: $1,500. Payment schedule: $750 upon signing this agreement (project does not begin without receipt of deposit); $750 upon launch and Client approval. Monthly maintenance retainer: $99/mo, beginning at launch date, billed automatically to card on file. Invoices unpaid after 14 days are subject to a 5% late fee. Project pauses if payment is more than 30 days overdue.",
                },
                {
                  n: "3", title: "Timeline",
                  body: "Designer will deliver a staging site for Client review within 21 days of receiving all required content and assets. Timeline assumes Client provides all materials within 7 days of kickoff. Delays caused by Client's late content submission extend all milestones accordingly.",
                },
                {
                  n: "4", title: "Client Responsibilities",
                  body: "Client agrees to provide the following within 7 days of signing: vector logo files, staff photos, any existing brand assets, and access credentials for their domain registrar. Client will designate one point of contact for all approvals. If the project goes without Client response for 60 or more consecutive days, a $200 project restart fee applies.",
                },
                {
                  n: "5", title: "Revisions",
                  body: "Two (2) rounds of revisions are included in the project fee. A revision is defined as changes to existing content, layout, or copy — not new pages, new features, or redesigns. Revisions beyond two rounds are billed at $100 per hour. Design approval is considered granted if Client does not respond within 10 business days of delivery.",
                },
                {
                  n: "6", title: "Intellectual Property",
                  body: "Upon receipt of final payment in full, Client owns the final website design and all custom code written specifically for this project. Designer retains ownership of reusable templates, frameworks, and tools used in production. Third-party platforms (Lovable, Supabase, Vercel, Formspree, or similar) remain subject to their own terms of service. Designer may display this project in a professional portfolio unless Client requests otherwise in writing.",
                },
                {
                  n: "7", title: "HIPAA / Healthcare Compliance Disclaimer",
                  body: "Designer is not a HIPAA consultant and is not responsible for ensuring that this website, or any third-party tools integrated into it, comply with HIPAA, state health privacy laws, or any other healthcare regulation. Client is solely responsible for obtaining all required Business Associate Agreements with all vendors, reviewing applicable compliance requirements with qualified legal counsel, and ensuring all patient-facing tools meet the law. A standard contact form collecting only name, phone number, email address, and preferred appointment time does not collect Protected Health Information (PHI) and does not fall under HIPAA requirements. Any online patient intake forms requiring medical history, insurance information, or clinical data must use a separately contracted HIPAA-compliant form platform.",
                },
                {
                  n: "8", title: "Limitation of Liability",
                  body: "Designer's total liability for any claim arising from this agreement shall not exceed the total amount paid by Client for the project. Designer is not liable for indirect, consequential, incidental, or punitive damages of any kind. Client agrees to indemnify and hold Designer harmless against any third-party claims arising from Client-provided content, Client's own HIPAA obligations, or Client's use of the website after launch.",
                },
                {
                  n: "9", title: "Termination",
                  body: "Either party may terminate this agreement with 14 days written notice. If Client terminates: the deposit is non-refundable; all work completed to date will be invoiced at $100 per hour and files delivered to Client only upon payment of any outstanding balance. If Designer terminates: all completed work will be delivered to Client and the unused portion of the deposit refunded on a pro-rata basis.",
                },
                {
                  n: "10", title: "Domain, Hosting & Post-Launch",
                  body: "The domain stewartdentalgroup.com remains the property of Client at all times. Designer will manage DNS settings on Client's behalf only with Client's written permission. If Client terminates the monthly maintenance retainer, Client assumes full responsibility for all hosting, security updates, plugin updates, and ongoing site maintenance. Designer has no ongoing obligation beyond what is specifically described in the active retainer agreement.",
                },
                {
                  n: "11", title: "Third-Party Platforms",
                  body: "This website may be built using third-party platforms including but not limited to Lovable, Supabase, Vercel, Formspree, and Google Analytics. Client acknowledges that the uptime, pricing, features, and availability of these platforms are entirely outside Designer's control. Designer is not liable for service interruptions, pricing changes, feature removals, or discontinuation of any third-party platform.",
                },
                {
                  n: "12", title: "Entire Agreement",
                  body: "This agreement and the Proposal above constitute the entire agreement between the parties and supersede all prior discussions, representations, or agreements. Any modifications to this agreement must be made in writing and signed by both parties.",
                },
              ].map(clause => (
                <div key={clause.n}>
                  <SectionHeading number={clause.n} title={clause.title} />
                  <p className="text-slate-600 text-sm leading-relaxed pl-10">{clause.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Signature Section ── */}
          <div className="bg-white rounded-xl border-2 p-6 sm:p-8 no-print" style={{ borderColor: ORANGE }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>Sign & Agree</div>
            <h2 className="text-lg font-bold mb-6" style={{ color: DARK }}>Ready to get started?</h2>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Your Full Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: BORDER }}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Date</label>
                <div className="border rounded-lg px-3 py-2.5 text-sm text-slate-600" style={{ borderColor: BORDER }}>{today}</div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Signature <span className="text-slate-400 font-normal normal-case tracking-normal">(draw with mouse or finger)</span>
                </label>
                <SignaturePad onSign={setSignatureData} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0"
                  style={{ accentColor: ORANGE }}
                />
                <span className="text-sm text-slate-600">
                  I have read and agree to all terms in the Service Agreement above, including the HIPAA disclaimer (Section 7). I understand that a $750 deposit is required to begin and that the project timeline starts upon receipt of payment and content assets.
                </span>
              </label>

              <button
                onClick={handleSubmit}
                disabled={!agreed || !signatureData}
                className="w-full py-4 rounded-xl text-white font-bold text-sm uppercase tracking-widest transition-all"
                style={{
                  background: agreed && signatureData ? ORANGE : "#cbd5e1",
                  cursor: agreed && signatureData ? "pointer" : "not-allowed",
                }}
              >
                {agreed && signatureData ? "Sign Agreement & Let's Build This" : "Complete all fields above to sign"}
              </button>

              <p className="text-xs text-center text-slate-400">
                Questions before signing? Call or text Matt: <a href="tel:3138064952" className="underline">(313) 806-4952</a>
              </p>
            </div>
          </div>

          {/* Print signature block */}
          <div className="hidden print:block border-t pt-8 mt-8" style={{ borderColor: BORDER }}>
            <div className="grid grid-cols-2 gap-16">
              <div>
                <div className="border-b mb-2" style={{ borderColor: DARK, paddingBottom: "40px" }} />
                <p className="text-xs">Client Signature</p>
                <p className="text-xs mt-1">{clientName}</p>
                <p className="text-xs text-slate-500">Date: _______________</p>
              </div>
              <div>
                <div className="border-b mb-2" style={{ borderColor: DARK, paddingBottom: "40px" }} />
                <p className="text-xs">Designer Signature</p>
                <p className="text-xs mt-1">Matthew Michels, Matt Michels Training, LLC</p>
                <p className="text-xs text-slate-500">Date: _______________</p>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 pb-8">
            Matt Michels Training, LLC · Grosse Pointe, MI · (313) 806-4952 · matt@mattmichelstraining.com
          </div>
        </div>
      </div>
    </>
  );
}
