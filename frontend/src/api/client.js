// ─────────────────────────────────────────────────────────────
// src/api/client.js  — Axios instance with JWT auto-attach + refresh
// ─────────────────────────────────────────────────────────────
import axios from 'axios';
import { sessionEpoch, clearSession } from './session';

// In production (Electron build), VITE_API_URL is baked in at build time.
// In dev mode, it falls back to '/api' which the Vite proxy forwards to localhost:5000.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

const pendingWrites = new Map();
let writeEpoch = sessionEpoch();
function releaseWrite(config) {
  if (config?._writeSignature && pendingWrites.get(config._writeSignature) === config.headers['Idempotency-Key']) pendingWrites.delete(config._writeSignature);
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  config._sessionEpoch ??= sessionEpoch();
  if (writeEpoch !== sessionEpoch()) { pendingWrites.clear(); writeEpoch = sessionEpoch(); }
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase()) && !config.headers['Idempotency-Key']) {
    const body = typeof FormData !== 'undefined' && config.data instanceof FormData
      ? JSON.stringify([...config.data.entries()].map(([name, value]) => [name, typeof value === 'string' ? value : [value.name, value.size, value.lastModified]]))
      : typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {});
    config._writeSignature = `${config.method}:${config.url}:${body}`;
    const key = pendingWrites.get(config._writeSignature) || crypto.randomUUID();
    pendingWrites.set(config._writeSignature, key);
    config.headers['Idempotency-Key'] = key;
  }
  const token = localStorage.getItem('accessToken');
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  if (config._sessionEpoch !== sessionEpoch()) throw new axios.CanceledError('Session changed.');
  return config;
});

// On 401 TOKEN_EXPIRED — attempt token refresh
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => {
    releaseWrite(response.config);
    if (response.config._sessionEpoch !== sessionEpoch()) throw new axios.CanceledError('Session changed.');
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || originalRequest._sessionEpoch !== sessionEpoch()) return Promise.reject(new axios.CanceledError('Session changed.'));
    const code = error.response?.data?.code;
    // Preserve the key after an unknown network outcome so a manual retry does
    // not post twice. Definite client rejection may start a new attempt.
    if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 401) releaseWrite(originalRequest);

    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { timeout: 30000 });
        if (originalRequest._sessionEpoch !== sessionEpoch()) throw new axios.CanceledError('Session changed.');
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (originalRequest._sessionEpoch === sessionEpoch()) {
          clearSession();
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
