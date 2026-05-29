import { Button } from "@/components/ui/button";

interface StickyMobileCTAProps {
  label?: string;
  href?: string;
  onClick?: () => void;
}

const StickyMobileCTA = ({ label = "Get Started", onClick }: StickyMobileCTAProps) => (
  <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden z-40">
    <Button className="w-full" onClick={onClick}>{label}</Button>
  </div>
);
export default StickyMobileCTA;
