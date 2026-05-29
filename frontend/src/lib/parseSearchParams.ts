/** Parse URL search params into a plain object. */
export function parseParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => { result[key] = value; });
  return result;
}
