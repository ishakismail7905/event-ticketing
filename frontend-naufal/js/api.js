// js/api.js: one function for every API call

const API_BASE = 'http://127.0.0.1:8000/api';

async function apiRequest(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = 'Bearer ' + token;   // JWT for protected routes
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only throws when the network fails (server not running)
    throw { status: 0, message: 'Cannot reach the API. Is php artisan serve running?', errors: {} };
  }

  const data = await res.json().catch(() => ({}));

  // fetch does NOT throw on 4xx/5xx, so we check res.ok ourselves
  if (!res.ok) {
    if (res.status === 401 && token) {          // token expired or invalid
      clearSession();
      window.location.href = 'login.html?expired=1';
    }
    throw { status: res.status, message: data.message || 'Request failed.', errors: data.errors || {} };
  }
  return data;
}