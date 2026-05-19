export function getToken() {
  return localStorage.getItem('token');
}

export function isLoggedIn() {
  const token = getToken();
  if (!token) return false;

  try {
    // Decode JWT payload (base64) without a library
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
