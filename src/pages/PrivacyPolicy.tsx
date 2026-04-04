export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-slate-800 px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: March 30, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">1. Who We Are</h2>
        <p className="leading-relaxed text-slate-700">
          M2 Development ("we," "us," or "our") operates mattmichelstraining.com and related services. Owner: Matt Michels, Grosse Pointe, MI. Contact: matt@mattmichelstraining.com | (313) 806-4952.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li><strong>Contact info</strong> — name, email address, phone number, business name when you fill out a form or sign up for a service.</li>
          <li><strong>Payment info</strong> — processed by Stripe. We do not store your card number.</li>
          <li><strong>Usage data</strong> — pages visited, browser type, IP address, collected automatically via standard web server logs.</li>
          <li><strong>SMS opt-in</strong> — when you provide your phone number and consent to receive text messages from us.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">3. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>Deliver the services you purchased (lead generation, SMS marketing, AI tools, newsletters, etc.)</li>
          <li>Send transactional and service-related emails and text messages</li>
          <li>Process payments through Stripe</li>
          <li>Respond to your inquiries</li>
          <li>Improve our services</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">4. SMS / Text Message Communications</h2>
        <p className="leading-relaxed text-slate-700 mb-3">
          By providing your phone number and checking the SMS consent box on any of our forms, you agree to receive automated text messages from M² Performance Training, including service updates, marketing messages, and reminders.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li><strong>Message frequency varies</strong> depending on the service.</li>
          <li><strong>Message and data rates may apply.</strong></li>
          <li>Reply <strong>STOP</strong> at any time to unsubscribe. Reply <strong>HELP</strong> for help.</li>
          <li>We do not share your phone number with third parties for their marketing purposes.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">5. Sharing Your Information</h2>
        <p className="leading-relaxed text-slate-700">
          We do not sell your personal information. We share data only with service providers necessary to operate our business (Stripe for payments, Resend for email, Twilio for SMS, Supabase for database hosting, Anthropic for AI processing). Each provider is bound by their own privacy policy and data processing agreements.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">6. Data Retention</h2>
        <p className="leading-relaxed text-slate-700">
          We retain your information for as long as your account is active or as needed to provide services. You may request deletion at any time by emailing matt@mattmichelstraining.com.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">7. Your Rights</h2>
        <p className="leading-relaxed text-slate-700">
          You may request access to, correction of, or deletion of your personal data at any time. Email matt@mattmichelstraining.com with your request.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">8. Cookies</h2>
        <p className="leading-relaxed text-slate-700">
          We use cookies and local storage to maintain session state and improve performance. You can disable cookies in your browser settings, though some features may not function properly.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">9. Children's Privacy</h2>
        <p className="leading-relaxed text-slate-700">
          Our services are not directed to children under 13. We do not knowingly collect data from children.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">10. Changes to This Policy</h2>
        <p className="leading-relaxed text-slate-700">
          We may update this policy. Changes will be posted on this page with an updated date. Continued use of our services after changes constitutes acceptance.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">11. Contact</h2>
        <p className="leading-relaxed text-slate-700">
          Matt Michels — M² Performance Training<br />
          Grosse Pointe, MI<br />
          matt@mattmichelstraining.com<br />
          (313) 806-4952
        </p>
      </section>
    </div>
  );
}
