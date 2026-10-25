const API = import.meta.env.VITE_API_URL;
const KEY = "chatbuddy_token";

export const getToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
};
export const clearToken = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {}
};

// Adds "Authorization: Bearer <token>" to every request that goes to our API,
// and signals when the server says the session is no longer valid.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const isApi = typeof url === "string" && url.startsWith(API);
  if (isApi) {
    const token = getToken();
    if (token) {
      const headers = new Headers(init.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      init = { ...init, headers };
    }
  }
  const res = await originalFetch(input, init);
  const isLoginCall = isApi && /\/auth\/(login|register)$/.test(url);
  if (isApi && res.status === 401 && !isLoginCall) {
    window.dispatchEvent(new Event("auth-expired"));
  }
  return res;
};