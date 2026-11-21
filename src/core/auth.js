import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config.js";

const AUTH_API = `${SUPABASE_URL}/auth/v1`;
const STORAGE_KEY = "ba-academy.auth.session.v1";
const REFRESH_MARGIN_SECONDS = 60;
let refreshInFlight = null;
let refreshTimer = null;
const subscribers = new Set();

export function calculateExpiry(expiresIn, now = Date.now()) {
  return Math.floor(now / 1000) + Math.max(0, Number(expiresIn) || 0);
}

export function normalizeAuthError(payload, fallback = "Échec de l’authentification.") {
  return payload?.msg || payload?.message || payload?.error_description ||
    payload?.error || fallback;
}

function storage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredSession() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}

function publishSession(session, event = "SIGNED_IN") {
  for (const callback of subscribers) callback(event, session);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("academy:auth-change", {
      detail: { event, session }
    }));
  }
}

function storeSession(payload) {
  const session = {
    ...payload,
    expires_at: payload.expires_at || calculateExpiry(payload.expires_in)
  };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    throw new Error("Le stockage de session du navigateur est indisponible.");
  }
  scheduleRefresh(session);
  return session;
}

function clearStoredSession(event = "SIGNED_OUT") {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory session is still cleared.
  }
  publishSession(null, event);
}

async function authRequest(path, { method = "GET", body, accessToken } = {}) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Accept: "application/json"
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${AUTH_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeAuthError(payload, `Service Auth indisponible (HTTP ${response.status}).`));
  }
  return payload;
}

function scheduleRefresh(session) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(1000, (session.expires_at - REFRESH_MARGIN_SECONDS - Date.now() / 1000) * 1000);
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => {});
  }, Math.min(delay, 2147483647));
}

export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  const current = readStoredSession();
  if (!current?.refresh_token) return null;
  refreshInFlight = (async () => {
    try {
      const payload = await authRequest("/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: current.refresh_token }
      });
      const session = storeSession(payload);
      publishSession("TOKEN_REFRESHED", session);
      return session;
    } catch (error) {
      if (/refresh token|invalid grant|session.*not found|refresh_token_not_found/i.test(error.message)) {
        clearStoredSession("SIGNED_OUT");
      }
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function getSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (session.expires_at <= Date.now() / 1000 + REFRESH_MARGIN_SECONDS) {
    return refreshSession();
  }
  scheduleRefresh(session);
  return session;
}

export async function getAccessToken() {
  return (await getSession())?.access_token || null;
}

export async function getCurrentUser() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  return authRequest("/user", { accessToken });
}

export async function signInWithPassword(email, password) {
  const payload = await authRequest("/token?grant_type=password", {
    method: "POST",
    body: { email: email.trim(), password }
  });
  const session = storeSession(payload);
  publishSession("SIGNED_IN", session);
  return session;
}

export async function signOut() {
  const accessToken = await getAccessToken();
  try {
    if (accessToken) {
      await authRequest("/logout?scope=local", {
        method: "POST",
        accessToken
      });
    }
  } finally {
    clearStoredSession("SIGNED_OUT");
  }
}

export function subscribeToAuthChanges(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
