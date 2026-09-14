// ─────────────────────────────────────────────────────────────
// src/context/BusinessConfigContext.jsx
// Provides business-type configuration via useBusinessConfig()
// Reads user.businessType from AuthContext automatically
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getBusinessConfig } from '../config/businessConfig';

const BusinessConfigContext = createContext(null);

export function BusinessConfigProvider({ children }) {
  const { user } = useAuth();
  const cfg = useMemo(
    () => getBusinessConfig(user?.businessType || 'PHARMACY'),
    [user?.businessType]
  );

  return (
    <BusinessConfigContext.Provider value={cfg}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig() {
  const ctx = useContext(BusinessConfigContext);
  // Fallback for usage outside provider (e.g., login/signup pages)
  if (!ctx) return getBusinessConfig('PHARMACY');
  return ctx;
}
