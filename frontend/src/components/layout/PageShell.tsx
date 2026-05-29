import { ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import AppNavbar from "./AppNavbar";
import BottomTabBar from "./BottomTabBar";

interface PageShellProps {
  children: ReactNode;
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Hide bottom nav (default: shown) */
  hideBottomNav?: boolean;
}

const PageShell = ({ children, className = "", hideBottomNav }: PageShellProps) => {
  const scrollRef = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={scrollRef}
      className={`min-h-dvh bg-background text-foreground ${className}`}
    >
      <AppNavbar />
      <main className="pt-14">{children}</main>
      {!hideBottomNav && <BottomTabBar />}
    </div>
  );
};

export default PageShell;
