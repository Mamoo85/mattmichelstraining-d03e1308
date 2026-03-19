import { createContext, useContext, useState, ReactNode } from "react";

interface TimerContextType {
  timerOpen: boolean;
  toggleTimer: () => void;
  closeTimer: () => void;
  portalActive: boolean;
  setPortalActive: (v: boolean) => void;
}

const TimerContext = createContext<TimerContextType>({
  timerOpen: false,
  toggleTimer: () => {},
  closeTimer: () => {},
  portalActive: false,
  setPortalActive: () => {},
});

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [timerOpen, setTimerOpen] = useState(false);
  const [portalActive, setPortalActive] = useState(false);
  return (
    <TimerContext.Provider
      value={{
        timerOpen,
        toggleTimer: () => setTimerOpen((p) => !p),
        closeTimer: () => setTimerOpen(false),
        portalActive,
        setPortalActive,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
