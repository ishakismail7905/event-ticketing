// js/auth.js - save/read the login session, log out, and guard pages by role.
// Author: Muhammad Anas (AM2512021976)

const STUDENT_NAME = 'Muhammad Anas';
const STUDENT_ID = 'AM2512021976';

function saveSession(result) {
  localStorage.setItem('token', result.data.access_token);
  localStorage.setItem('user', JSON.stringify(result.data.user)); // user has .role
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Call at the top of a protected page. allowedRoles example: ['admin', 'staff']
// Leave allowedRoles empty to allow any logged-in user.
function requireRole(allowedRoles) {
  const user = getUser();
  const token = localStorage.getItem('token');
  if (!user || !token || (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role))) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

async function logout() {
  try {
    await apiRequest('POST', '/auth/logout');
  } catch {
    // even if the server call fails, we still clear the local session
  }
  clearSession();
  window.location.href = 'login.html';
}
