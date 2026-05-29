import { Link } from "react-router-dom";

interface CheckoutConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const CheckoutConsentCheckbox = ({ checked, onChange }: CheckoutConsentCheckboxProps) => (
  <label className="flex items-start gap-2 cursor-pointer text-sm text-muted-foreground">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 rounded border-border"
    />
    <span>
      I agree to the{" "}
      <Link to="/legal/terms" target="_blank" className="text-primary underline">Terms of Service</Link>
      {" "}and{" "}
      <Link to="/legal/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>.
    </span>
  </label>
);

export default CheckoutConsentCheckbox;
