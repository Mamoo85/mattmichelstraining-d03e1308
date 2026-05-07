// Single source of truth for all DWA product prices.
// Import from here rather than hardcoding prices in components or edge functions.

export const PRICING = {
  webDesignContractor: { setup: 499, monthly: 99, label: "$499 setup + $99/mo" },
  webDesignRestaurant: { setup: 499, monthly: 79, label: "$499 setup + $79/mo" },
  techAlert:           { setup: 0, monthly: 149, label: "$149/mo" },
  techAlertSms:        { setup: 0, monthly: 49,  label: "$49/mo" },
  fieldDesk:           { setup: 0, monthly: 199, label: "$199/mo" },
  siteRadar:           { setup: 0, monthly: 49,  label: "$49/mo" },
  missedCall:          { setup: 0, monthly: 99,  label: "$99/mo" },
  mortgageRadar:       { setup: 0, monthly: 149, label: "$149/mo" },
  tradeRadar:          { setup: 0, monthly: 99,  label: "$99/mo" },
  contractorLeads:     { setup: 0, monthly: 399, label: "$399/mo" },
  deadLeadReactivation:{ setup: 0, perReply: 50, label: "$50/reply" },
  bundle:              { setup: 0, monthly: 299, label: "$299/mo" },
} as const;

export type ProductKey = keyof typeof PRICING;
