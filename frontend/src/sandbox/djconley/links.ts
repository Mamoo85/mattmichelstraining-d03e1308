import { isDJConleyDomain } from "@/lib/domainConfig";

export function djPath(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  // On any DJ Conley-owned domain (djconley.com, www, sandbox, pat.*) the site
  // is mounted at the root, so links must NOT carry the /sandbox/djconley prefix.
  if (isDJConleyDomain()) {
    return clean === "/" ? "/" : clean;
  }
  // Anywhere else it's served under the /sandbox/djconley preview path.
  return clean === "/" ? "/sandbox/djconley" : `/sandbox/djconley${clean}`;
}
