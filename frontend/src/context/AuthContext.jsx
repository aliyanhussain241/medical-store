// ─────────────────────────────────────────────────────────────
// src/context/AuthContext.jsx
// Global auth state — user, tokens, login/logout
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.me()
        .then((res) => setUser(res.data.user))
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(accessToken, refreshToken, userData) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
  }

  function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    authAPI.logout(refreshToken).catch(() => {});
    localStorage.clear();
    setUser(null);
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
