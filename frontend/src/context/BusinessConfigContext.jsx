// ─────────────────────────────────────────────────────────────
// src/context/BusinessConfigContext.jsx
// Always returns Wholesale Medical / Pharmacy config.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react';
import { getBusinessConfig } from '../config/businessConfig';

const cfg = getBusinessConfig();
const BusinessConfigContext = createContext(cfg);

export function BusinessConfigProvider({ children }) {
  return (
    <BusinessConfigContext.Provider value={cfg}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig() {
  return useContext(BusinessConfigContext) || cfg;
}
