import { Helmet } from "react-helmet-async";
import { Phone, MapPin, ArrowLeft, Shield } from "lucide-react";

const G = "#C9A84C";
const N = "#0B1426";
const C = "#F8F3EC";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: N, marginBottom: 12 }}>{title}</h2>
    <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.85 }}>{children}</div>
  </section>
);

export default function StewartDentalPrivacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Stewart Dental Group — Grosse Pointe Woods, MI</title>
        <meta name="description" content="Privacy Policy for Stewart Dental Group. Learn how we collect, use, and protect your information. HIPAA-compliant dental practice in Grosse Pointe Woods, MI." />
        <link rel="canonical" href="https://www.stewartdentalgroup.com/privacy" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Header */}
      <header className="fixed left-0 right-0 z-50" style={{ background: "rgba(253,250,245,.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(201,168,76,.25)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/stewart-dental" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: N }}>
              <span style={{ color: G, fontSize: 16 }}>✦</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600, color: N, letterSpacing: ".05em", lineHeight: 1.2 }}>STEWART<br />DENTAL GROUP</div>
          </a>
          <a href="/stewart-dental" className="flex items-center gap-2 text-xs font-semibold" style={{ color: G, textDecoration: "none" }}>
            <ArrowLeft size={14} /> Back to Home
          </a>
        </div>
      </header>

      <main className="min-h-screen" style={{ background: C, paddingTop: 96 }}>
        <div className="max-w-3xl mx-auto px-5 pb-20">
          {/* Title */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} color={G} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: G }}>Legal</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px,5vw,48px)", color: N, fontWeight: 400, marginBottom: 8 }}>Privacy Policy</h1>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Last Updated: April 4, 2026</p>
          </div>

          <Section title="1. Who We Are">
            <p>
              This privacy policy applies to the website operated by <strong>Robert B. Stewart, D.D.S., M.S., P.C.</strong> d/b/a <strong>Stewart Dental Group</strong>, located at 19635 Mack Avenue, Grosse Pointe Woods, MI 48236. Phone: (313) 882-8711.
            </p>
            <p className="mt-3">
              This website is a <strong>marketing and informational website only</strong>. It does not collect, store, transmit, or process any Protected Health Information (PHI) as defined under the Health Insurance Portability and Accountability Act of 1996 (HIPAA). Clinical intake, medical records, and PHI are managed exclusively through our HIPAA-compliant practice management software, which is separate from this website.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p className="mb-3">Through this website, we may collect the following types of information:</p>
            <p className="font-semibold mb-1" style={{ color: N }}>a) Contact Form Submissions</p>
            <p>When you submit our appointment request form, we collect your <strong>first name, last name, phone number, email address</strong> (optional), <strong>preferred appointment day</strong>, and <strong>reason for visit</strong>. This information is used solely to schedule and confirm your appointment. It is <strong>not</strong> Protected Health Information under HIPAA because it is collected in a non-clinical, marketing context before any treatment relationship is established.</p>

            <p className="font-semibold mb-1 mt-4" style={{ color: N }}>b) Automatically Collected Information</p>
            <ul className="list-disc pl-6 space-y-1 mt-1">
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Pages visited and time spent</li>
              <li>Referring website</li>
              <li>IP address (anonymized where possible)</li>
              <li>Device type (desktop, mobile, tablet)</li>
            </ul>
          </Section>

          <Section title="3. Cookies & Tracking Technologies">
            <p className="mb-3">This website uses the following cookies and tracking technologies:</p>

            <p className="font-semibold mb-1" style={{ color: N }}>a) Google Analytics (GA4)</p>
            <p>We use Google Analytics 4 to understand how visitors interact with our website. GA4 collects anonymized usage data including pages visited, session duration, and general geographic location. Google Analytics does not collect personal identifying information. You can opt out by installing the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" style={{ color: G, textDecoration: "underline" }}>Google Analytics Opt-out Browser Add-on</a>.</p>

            <p className="font-semibold mb-1 mt-4" style={{ color: N }}>b) Essential Cookies</p>
            <p>We use essential cookies to maintain basic website functionality, including cookie consent preferences. These cookies do not track your browsing activity across other websites.</p>

            <p className="font-semibold mb-1 mt-4" style={{ color: N }}>c) No Third-Party Advertising Cookies</p>
            <p>We do not use third-party advertising cookies, retargeting pixels, or social media tracking pixels on this website.</p>
          </Section>

          <Section title="4. How We Use Your Information">
            <ul className="list-disc pl-6 space-y-2">
              <li>To respond to your appointment request and schedule your visit</li>
              <li>To communicate with you about your appointment (phone or email)</li>
              <li>To improve our website functionality and user experience</li>
              <li>To analyze aggregate website traffic patterns</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> use your contact form information for marketing, email campaigns, newsletters, or any purpose unrelated to your appointment request.</p>
          </Section>

          <Section title="5. Sharing Your Information">
            <p>We do <strong>not</strong> sell, rent, trade, or otherwise share your personal information with third parties for their marketing purposes. We may share information only with:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Service providers</strong> who assist in website hosting and operation, bound by confidentiality agreements</li>
              <li><strong>Google Analytics</strong> (anonymized data only) for website performance analysis</li>
              <li><strong>Legal authorities</strong> when required by law, court order, or legal process</li>
            </ul>
          </Section>

          <Section title="6. HIPAA Compliance & Notice of Privacy Practices">
            <div className="rounded-lg p-5 mb-4" style={{ background: "white", border: `2px solid ${G}` }}>
              <p className="font-semibold mb-2" style={{ color: N }}>Important Distinction</p>
              <p>This website privacy policy governs how we handle information collected <strong>through this website only</strong>. It is separate from our <strong>HIPAA Notice of Privacy Practices (NPP)</strong>, which governs how we handle your medical records and Protected Health Information in our clinical practice.</p>
            </div>
            <p>Our HIPAA Notice of Privacy Practices is available:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>In printed form at our office front desk</li>
              <li>Upon request by calling <a href="tel:3138828711" style={{ color: G, fontWeight: 600 }}>(313) 882-8711</a></li>
              <li>As part of your new patient intake paperwork</li>
            </ul>
            <p className="mt-3">Our practice complies with all applicable HIPAA Privacy, Security, and Breach Notification Rules. All patient health records are maintained in HIPAA-compliant systems with encryption, access controls, and audit logging.</p>
          </Section>

          <Section title="7. Data Retention">
            <p>Contact form submissions are retained for the purpose of scheduling and confirming appointments. Once an appointment is scheduled or the inquiry is resolved, contact form data may be retained for up to 12 months for quality assurance purposes, after which it is securely deleted.</p>
            <p className="mt-3">Website analytics data is retained in accordance with Google Analytics' default retention settings (14 months).</p>
          </Section>

          <Section title="8. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Request access</strong> to the personal information we have collected about you through this website</li>
              <li><strong>Request correction</strong> of inaccurate personal information</li>
              <li><strong>Request deletion</strong> of your personal information from our website systems</li>
              <li><strong>Opt out</strong> of Google Analytics tracking via the browser add-on linked above</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact our office at <a href="tel:3138828711" style={{ color: G, fontWeight: 600 }}>(313) 882-8711</a>.</p>
            <p className="mt-3"><strong>Note:</strong> Rights regarding your medical records and PHI are governed by HIPAA and are addressed in our Notice of Privacy Practices, not this website privacy policy.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>This website is not directed to children under 13. We do not knowingly collect personal information from children under 13 through this website. Parental consent is obtained in-office for minor patients as part of our clinical intake process.</p>
          </Section>

          <Section title="10. Security">
            <p>We implement reasonable technical and organizational measures to protect the personal information collected through this website, including:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>SSL/TLS encryption for all data transmitted between your browser and our website</li>
              <li>Secure hosting infrastructure with regular security updates</li>
              <li>Access controls limiting who can view contact form submissions</li>
            </ul>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this privacy policy periodically. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of this website after any changes constitutes your acceptance of the updated policy.</p>
          </Section>

          <Section title="12. Contact Us">
            <div className="rounded-lg p-6" style={{ background: "white", border: "1px solid rgba(201,168,76,.2)" }}>
              <p className="font-semibold mb-3" style={{ color: N }}>Robert B. Stewart, D.D.S., M.S., P.C.</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <MapPin size={14} color={G} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span>19635 Mack Avenue, Grosse Pointe Woods, MI 48236</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={14} color={G} style={{ flexShrink: 0 }} />
                  <a href="tel:3138828711" style={{ color: G, fontWeight: 600, textDecoration: "none" }}>(313) 882-8711</a>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: N, padding: "32px 20px" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-3 text-center sm:text-left">
          <p style={{ color: "rgba(75,85,99,.45)", fontSize: 11 }}>© {new Date().getFullYear()} Stewart Dental Group. All rights reserved. Robert B. Stewart, D.D.S., M.S., P.C.</p>
          <a href="https://www.mattmichelstraining.com/detroit-web-design" target="_blank" rel="noopener noreferrer" style={{ color: G, fontSize: 11, textDecoration: "none" }}>
            Site by M2 Web Design
          </a>
        </div>
      </footer>
    </>
  );
}
