import { ReactNode } from "react";

const ZoneThemeWrapper = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`zone-theme ${className}`}
    style={{
      // Override CSS custom properties for the ultra-dark Zone aesthetic
      "--background": "0 0% 2%",
      "--foreground": "0 0% 90%",
      "--card": "0 0% 5%",
      "--card-foreground": "0 0% 90%",
      "--popover": "0 0% 5%",
      "--popover-foreground": "0 0% 90%",
      "--border": "0 0% 10%",
      "--input": "0 0% 10%",
      "--muted": "0 0% 8%",
      "--muted-foreground": "0 0% 55%",
      "--secondary": "0 0% 8%",
      "--secondary-foreground": "0 0% 90%",
      "--accent": "0 0% 12%",
      "--accent-foreground": "0 0% 90%",
    } as React.CSSProperties}
  >
    {children}
  </div>
);

export default ZoneThemeWrapper;
