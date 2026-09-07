const BASE = import.meta.env.VITE_API || '';

let token = localStorage.getItem('cm_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('cm_token', t);
  else localStorage.removeItem('cm_token');
}
export const getToken = () => token;

export async function api(path, { method = 'GET', body, form, headers = {}, signal } = {}) {
  const opts = { method, headers: { ...headers }, signal };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}/api${path}`, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erreur ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const get = (p, opts) => api(p, opts);
export const post = (p, body, opts) => api(p, { method: 'POST', body, ...opts });
export const put = (p, body, opts) => api(p, { method: 'PUT', body, ...opts });
export const patch = (p, body, opts) => api(p, { method: 'PATCH', body, ...opts });
export const del = (p, opts) => api(p, { method: 'DELETE', ...opts });
export const upload = (p, formData) => api(p, { method: 'POST', form: formData });
