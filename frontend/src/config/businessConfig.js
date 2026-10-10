// ─────────────────────────────────────────────────────────────
// src/config/businessConfig.js
// Product lock: PHARMACY (Wholesale Medical) ONLY.
//
// To re-enable other business types in future, change:
//   ENABLED_BUSINESS_TYPES = ['PHARMACY']
// to include additional types, e.g.:
//   ENABLED_BUSINESS_TYPES = ['PHARMACY', 'GENERAL_STORE', 'HARDWARE']
// ─────────────────────────────────────────────────────────────

// ── Feature flag: controls which business types are active ────
// Currently locked to PHARMACY only. Change this one line to unlock others.
export const ENABLED_BUSINESS_TYPES = ['PHARMACY'];

const PHARMACY_CONFIG = {
  typeKey: 'PHARMACY',
  label: 'Wholesale Medical Store',
  subtitle: 'Wholesale Medical Management',

  // Product fields
  showBatchNo: true,
  showExpiryDate: true,
  showPacking: true,
  showTradePrice: true,
  showNearExpiryFilter: true,

  // Pricing
  showPricingModes: true,
  defaultPricingMode: 'RETAIL',
  pricingModes: [
    { value: 'TP', label: 'Trade Price', abbr: 'T' },
    { value: 'RETAIL', label: 'Retail', abbr: 'R' },
    { value: 'NET', label: 'Net Price', abbr: 'N' },
  ],

  // Features
  showOfferLists: true,
  showSchemeFields: true,
  offerListsLabel: 'Offer Lists',
  offerListsSingular: 'Offer List',

  // Terminology
  productLabel: 'Product',
  productsLabel: 'Products',
  supplierLabel: 'Company',
  suppliersLabel: 'Companies',
  categoryPlaceholder: 'Antibiotic, Analgesic...',
  unitOptions: ['strip', 'tablet', 'capsule', 'bottle', 'bag', 'vial', 'box', 'sachet', 'ampule'],
  defaultUnit: 'strip',
  costLabel: 'Cost / PP',
  tradePriceLabel: 'Trade Price (TP)',
  salePriceLabel: 'Retail / Sale',
};

/**
 * Returns the active business config.
 * Currently always returns PHARMACY_CONFIG since ENABLED_BUSINESS_TYPES = ['PHARMACY'].
 * Kept as a function for backward compatibility when multi-type support is re-enabled.
 */
export function getBusinessConfig() {
  return PHARMACY_CONFIG;
}

export default PHARMACY_CONFIG;
