export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white text-slate-800 px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: April 4, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">1. Agreement</h2>
        <p className="leading-relaxed text-slate-700">
          By using any service offered by Matt Michels Training (training and fitness services) or M2 Development (web design, marketing, and business automation services) — collectively "we," "us," "our" — at mattmichelstraining.com or related domains, you agree to these Terms of Service. If you do not agree, do not use our services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">2. Services</h2>
        <p className="leading-relaxed text-slate-700">
          We offer subscription-based and one-time digital services including but not limited to: AI-powered marketing tools, SMS marketing, lead generation, web design, newsletter services, GBP automation, fitness coaching and training programs, and related business services. Service details are described on each product page.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">3. Payments & Subscriptions</h2>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>Subscription fees are billed monthly through Stripe.</li>
          <li>Subscriptions auto-renew unless cancelled before the billing date.</li>
          <li>You may cancel at any time; access continues through the end of the paid period.</li>
          <li>We reserve the right to change pricing with 30 days notice.</li>
          <li>All sales are final unless otherwise stated. No refunds on completed one-time services.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">4. SMS Messaging Terms</h2>
        <p className="leading-relaxed text-slate-700 mb-3">
          By providing your phone number and consenting to SMS communications, you agree to receive automated text messages from Matt Michels Training or M2 Development, depending on the service. This includes service notifications, marketing messages, and transactional alerts.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>You represent that you are the authorized user of the phone number provided.</li>
          <li>Message frequency varies by service. Message and data rates may apply.</li>
          <li>Reply <strong>STOP</strong> to cancel. Reply <strong>HELP</strong> for help.</li>
          <li>Opting out of SMS will not affect other services you have subscribed to.</li>
          <li>We do not use SMS for spam. All messages are related to services you have opted into.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">5. Acceptable Use</h2>
        <p className="leading-relaxed text-slate-700 mb-3">You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>Use our services for any unlawful purpose</li>
          <li>Resell or redistribute our services without written permission</li>
          <li>Attempt to reverse-engineer or copy our software or AI prompts</li>
          <li>Submit false or misleading information</li>
          <li>Use our SMS or email delivery infrastructure to send unsolicited messages</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">6. AI-Generated Content</h2>
        <p className="leading-relaxed text-slate-700">
          Some services use AI to generate content such as blog posts, ad copy, scripts, and social media posts. AI-generated content is provided as-is. You are responsible for reviewing and approving any content before publishing or distribution. We make no warranties about the accuracy, completeness, or fitness of AI-generated content for any particular purpose.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">7. Fitness & Training Disclaimer</h2>
        <p className="leading-relaxed text-slate-700 mb-3">
          Our fitness and training services — including digital training programs, exercise libraries, coaching feedback, and AI-generated fitness content — are for informational and educational purposes only. They are not a substitute for professional medical advice, diagnosis, or treatment.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>You should consult a physician before beginning any exercise program.</li>
          <li>You voluntarily assume all risks associated with physical training, including but not limited to injury, illness, or aggravation of pre-existing conditions.</li>
          <li>We are not liable for injuries resulting from the use or misuse of exercises, programs, or coaching feedback provided through our platform.</li>
          <li>All training content is general in nature. Individual results depend on effort, adherence, physical condition, and factors outside our control.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">8. Minor Athletes (Under 18)</h2>
        <p className="leading-relaxed text-slate-700 mb-3">
          In compliance with Michigan law, users under 18 may only access our interactive training platform through a parent- or guardian-created account. By creating an account for a minor:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-700 leading-relaxed">
          <li>The parent or guardian consents to the minor's participation in the training platform, including workout logging, coach messaging, and community features.</li>
          <li>The parent or guardian acknowledges the inherent risks of physical training and accepts responsibility for supervising the minor's use of the platform and adherence to proper form and technique.</li>
          <li>The parent or guardian retains the right to access, review, and manage the minor's account at any time.</li>
          <li>We do not require parents or guardians to indemnify or reimburse Matt Michels Training for claims arising from a minor's injuries. Consistent with <em>MK v. Auburnfly, LLC</em> (Mich. Ct. App. 2024), we do not include parental indemnification provisions in this agreement.</li>
          <li>Nothing in this agreement waives or limits a minor's independent legal rights under Michigan law.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">9. Intellectual Property</h2>
        <p className="leading-relaxed text-slate-700">
          Content generated by our services on your behalf is owned by you. Our platform, code, prompts, and brand assets remain the property of M2 Development. Exercise libraries, training methodologies, and coaching content remain the property of Matt Michels Training.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">10. Limitation of Liability</h2>
        <p className="leading-relaxed text-slate-700">
          To the maximum extent permitted by law, Matt Michels Training and M2 Development are not liable for any indirect, incidental, or consequential damages arising from your use of our services, including but not limited to physical injury from training programs. Our total liability to you shall not exceed the amount you paid us in the 30 days prior to the claim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">11. Disclaimer of Warranties</h2>
        <p className="leading-relaxed text-slate-700">
          Services are provided "as is" without warranty of any kind. We do not guarantee specific results from lead generation, marketing, AI services, or fitness training. Business and training outcomes vary and depend on factors outside our control.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">12. Termination</h2>
        <p className="leading-relaxed text-slate-700">
          We reserve the right to suspend or terminate your access for violation of these terms, non-payment, or any other reason at our discretion, with or without notice.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">13. Governing Law</h2>
        <p className="leading-relaxed text-slate-700">
          These terms are governed by the laws of the State of Michigan. Any disputes shall be resolved in the courts of Wayne County, Michigan.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">14. Changes to Terms</h2>
        <p className="leading-relaxed text-slate-700">
          We may update these terms at any time. Continued use of our services after changes are posted constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">15. Contact</h2>
        <p className="leading-relaxed text-slate-700">
          Matt Michels — M2 Development<br />
          Grosse Pointe, MI<br />
          matt@mattmichelstraining.com<br />
          (313) 806-4952
        </p>
      </section>
    </div>
  );
}
