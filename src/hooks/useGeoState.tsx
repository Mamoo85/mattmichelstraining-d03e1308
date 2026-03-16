import { useState, useEffect } from "react";

let cachedState: string | null = null;

export function useGeoState() {
  const [state, setState] = useState<string | null>(cachedState);

  useEffect(() => {
    if (cachedState !== null) return;
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((data) => {
        const region = data.region_code || data.region || "";
        cachedState = region;
        setState(region);
      })
      .catch(() => {
        cachedState = "";
        setState("");
      });
  }, []);

  return state;
}

export function useIsMichigan() {
  const state = useGeoState();
  if (state === null) return null; // loading
  return state === "MI" || state.toLowerCase() === "michigan";
}
