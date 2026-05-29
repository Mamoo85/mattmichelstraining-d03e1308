export interface Metro {
  id: string;
  name: string;
  state: string;
  price: number;
}

export const US_METROS: Metro[] = [
  { id: "detroit-mi", name: "Detroit", state: "MI", price: 199 },
  { id: "chicago-il", name: "Chicago", state: "IL", price: 249 },
  { id: "dallas-tx", name: "Dallas", state: "TX", price: 249 },
  { id: "atlanta-ga", name: "Atlanta", state: "GA", price: 199 },
  { id: "phoenix-az", name: "Phoenix", state: "AZ", price: 199 },
];

export const DEFAULT_METRO_ID = "detroit-mi";

export function getMetroById(id: string): Metro | undefined {
  return US_METROS.find((m) => m.id === id);
}

export function getMetroPricing(id: string): number {
  return getMetroById(id)?.price ?? 199;
}

export function getVisibleMetros(): Metro[] {
  return US_METROS;
}
