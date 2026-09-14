// ─────────────────────────────────────────────────────────────
// src/config/businessConfig.js
// Centralized configuration per business type — drives all
// conditional UI, terminology, and feature flags.
// ─────────────────────────────────────────────────────────────

const BUSINESS_CONFIGS = {
  // ─── PHARMACY ──────────────────────────────────────────────
  PHARMACY: {
    typeKey: 'PHARMACY',
    label: 'Pharmacy / Medical Store',
    subtitle: 'Wholesale Management',

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
  },

  // ─── GENERAL / GROCERY STORE ────────────────────────────────
  GENERAL_STORE: {
    typeKey: 'GENERAL_STORE',
    label: 'General / Grocery Store',
    subtitle: 'Store Management',

    showBatchNo: false,
    showExpiryDate: true,
    showPacking: false,
    showTradePrice: false,
    showNearExpiryFilter: true,

    showPricingModes: false,
    defaultPricingMode: 'RETAIL',
    pricingModes: [
      { value: 'RETAIL', label: 'Sale Price', abbr: 'S' },
    ],

    showOfferLists: true,
    showSchemeFields: false,
    offerListsLabel: 'Promotions',
    offerListsSingular: 'Promotion',

    productLabel: 'Item',
    productsLabel: 'Items',
    supplierLabel: 'Supplier',
    suppliersLabel: 'Suppliers',
    categoryPlaceholder: 'Dairy, Beverages, Snacks...',
    unitOptions: ['piece', 'kg', 'liter', 'pack', 'box', 'bag', 'dozen', 'carton', 'bottle'],
    defaultUnit: 'piece',
    costLabel: 'Cost Price',
    tradePriceLabel: '',
    salePriceLabel: 'Sale Price',
  },

  // ─── HARDWARE STORE ─────────────────────────────────────────
  HARDWARE_STORE: {
    typeKey: 'HARDWARE_STORE',
    label: 'Hardware Store',
    subtitle: 'Store Management',

    showBatchNo: false,
    showExpiryDate: false,
    showPacking: false,
    showTradePrice: false,
    showNearExpiryFilter: false,

    showPricingModes: false,
    defaultPricingMode: 'RETAIL',
    pricingModes: [
      { value: 'RETAIL', label: 'Sale Price', abbr: 'S' },
    ],

    showOfferLists: true,
    showSchemeFields: false,
    offerListsLabel: 'Promotions',
    offerListsSingular: 'Promotion',

    productLabel: 'Item',
    productsLabel: 'Items',
    supplierLabel: 'Supplier',
    suppliersLabel: 'Suppliers',
    categoryPlaceholder: 'Plumbing, Electrical, Tools...',
    unitOptions: ['piece', 'meter', 'foot', 'kg', 'liter', 'pair', 'set', 'roll', 'box', 'pack'],
    defaultUnit: 'piece',
    costLabel: 'Cost Price',
    tradePriceLabel: '',
    salePriceLabel: 'Sale Price',
  },
};

/**
 * Get the config for a given business type.
 * Falls back to PHARMACY if unknown type.
 */
export function getBusinessConfig(businessType) {
  return BUSINESS_CONFIGS[businessType] || BUSINESS_CONFIGS.PHARMACY;
}

/** All available business types (for signup picker) */
export const BUSINESS_TYPES = [
  { key: 'PHARMACY', label: 'Pharmacy / Medical Store', icon: '💊', desc: 'Drug distribution, wholesale medical supplies, batch & expiry tracking' },
  { key: 'GENERAL_STORE', label: 'General / Grocery Store', icon: '🛒', desc: 'Retail & wholesale grocery, FMCG, daily essentials' },
  { key: 'HARDWARE_STORE', label: 'Hardware Store', icon: '🔧', desc: 'Tools, building materials, plumbing & electrical supplies' },
];

export default BUSINESS_CONFIGS;
