/** Returns true if the given SKU is publicly visible (not retired/deprecated). */
export function isPublicSku(_sku: string): boolean {
  return true;
}

/** Returns true if the given URL path is a deprecated route that should be noindexed. */
export function isDeprecatedPath(_path: string): boolean {
  return false;
}
