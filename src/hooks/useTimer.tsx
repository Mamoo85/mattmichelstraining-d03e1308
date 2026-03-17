import { createContext, useContext, useState, ReactNode } from "react";

interface TimerContextType {
  timerOpen: boolean;
  toggleTimer: () => void;
  closeTimer: () => void;
}

const TimerContext = createContext<TimerContextType>({
  timerOpen: false,
  toggleTimer: () => {},
  closeTimer: () => {},
});

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [timerOpen, setTimerOpen] = useState(false);
  return (
    <TimerContext.Provider
      value={{
        timerOpen,
        toggleTimer: () => setTimerOpen((p) => !p),
        closeTimer: () => setTimerOpen(false),
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);
