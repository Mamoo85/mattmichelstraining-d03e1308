import { ReactNode } from "react";

const ZoneThemeWrapper = ({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={`zone-theme ${className}`}
    style={{
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
      ...style,
    } as React.CSSProperties}
  >
    {children}
  </div>
);

export default ZoneThemeWrapper;
