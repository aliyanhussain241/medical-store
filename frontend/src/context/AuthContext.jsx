// ─────────────────────────────────────────────────────────────
// src/context/AuthContext.jsx
// Global auth state — user, tokens, login/logout
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/services';
import { useQueryClient } from '@tanstack/react-query';
import { clearSession, sessionEpoch } from '../api/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const epoch = sessionEpoch();
    let active = true;
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.me()
        .then((res) => { if (active && epoch === sessionEpoch()) setUser(res.data.user); })
        .catch(() => { if (active && epoch === sessionEpoch()) { clearSession(); queryClient.clear(); } })
        .finally(() => { if (active) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [queryClient]);

  function login(accessToken, refreshToken, userData) {
    queryClient.cancelQueries();
    queryClient.clear();
    clearSession();
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
  }

  function logout() {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    // Clear local state immediately so UI transitions to logged-out
    queryClient.cancelQueries();
    queryClient.clear();
    clearSession();
    setUser(null);
    // Fire server-side invalidation in background (best-effort)
    // Must pass the access token explicitly since localStorage is already cleared
    if (accessToken) {
      authAPI.logout(refreshToken, accessToken).catch(() => {});
    }
  }

  function updateUser(updated) {
    setUser((prev) => ({ ...prev, ...updated }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
