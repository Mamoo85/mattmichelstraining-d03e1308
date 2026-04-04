import { Link } from "react-router-dom";

const LegalFooter = () => (
  <footer className="border-t border-border bg-muted/30 mt-12">
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
      <span>© {new Date().getFullYear()} M2 Development</span>
      <Link to="/legal/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
      <Link to="/legal/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
      <Link to="/legal/refund" className="hover:text-foreground transition-colors">Refund Policy</Link>
      <Link to="/legal/sms-consent" className="hover:text-foreground transition-colors">SMS Consent</Link>
      <Link to="/legal/ai-disclosure" className="hover:text-foreground transition-colors">AI Disclosure</Link>
    </div>
  </footer>
);

export default LegalFooter;
