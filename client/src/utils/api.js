const BASE = import.meta.env.VITE_SERVER_URL || '';

export async function apiFetch(path, options = {}) {
  return fetch(`${BASE}${path}`, options);
}
