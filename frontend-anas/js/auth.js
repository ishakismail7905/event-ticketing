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

  // Not logged in: go to the login page
  if (!user || !token) {
    window.location.href = 'login.html';
    return null;
  }

  // Logged in, but this role may not use the page: show a friendly 403 message
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
    if (typeof renderNavbar === 'function') renderNavbar();
    const main = document.querySelector('main');
    if (main) {
      main.querySelectorAll(':scope > *').forEach((el) => el.classList.add('d-none'));
      const box = document.createElement('div');
      box.className = 'alert alert-warning';
      box.textContent = 'Access denied (403). Your role (' + user.role + ') is not allowed to open this page.';
      const link = document.createElement('a');
      link.href = 'index.html';
      link.className = 'd-block mt-2';
      link.textContent = 'Back to events';
      box.appendChild(link);
      main.appendChild(box);
    }
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