/**
 * HTTP client.
 *
 * The access token lives only in memory (never localStorage, so injected
 * scripts cannot steal a long-lived credential). When the API answers 401,
 * the client silently calls /auth/refresh — which uses the httpOnly cookie —
 * and retries the original request once.
 */
import axios from 'axios';

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export const api = axios.create({ baseURL: '/api', withCredentials: true });

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

/** One refresh at a time, even if several requests fail together. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original && /\/auth\/(login|register|refresh)/.test(original.url || '');
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
  return error?.message || fallback;
}

/** Field-level validation errors returned by the API, keyed by field name. */
export function fieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.field).map((d) => [d.field, d.message]));
}

/** Downloads a file from an authenticated endpoint. */
export async function downloadFile(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
