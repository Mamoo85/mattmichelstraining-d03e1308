export function djPath(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location.hostname === "pat.detroitwebagent.com") {
    return clean === "/" ? "/" : clean;
  }
  return clean === "/" ? "/sandbox/djconley" : `/sandbox/djconley${clean}`;
}
