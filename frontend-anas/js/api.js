// js/api.js - every request to the EventHub API goes through this file.
// Author: Muhammad Anas (AM2512021976)

const API_BASE = 'http://127.0.0.1:8000/api';

// method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: '/events', body: optional object
async function apiRequest(method, path, body) {
  const headers = { Accept: 'application/json' };

  // Send the saved JWT on protected routes
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only fails like this when the network or server is down
    throw { status: 0, message: 'Cannot reach the API. Is the backend server running?', errors: {} };
  }

  const data = await res.json().catch(() => ({}));

  // fetch does NOT fail on 401/403/404/409/422, so we check res.ok ourselves
  if (!res.ok) {
        if (res.status === 401 && token && path !== '/auth/login') {
      // token expired or invalid: clear the session and send the user to log in again
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
    throw {
      status: res.status,
      message: data.message || 'Request failed.',
      errors: data.errors || {},
    };
  }
  return data;
}
