// js/auth.js: session, role guard, navbar, footer

// Shown on every page (required by the brief)
const STUDENT = { name: 'Ahmad Naufal bin Ahmad Fuad', id: 'AM2512021850' };

// Which page each role lands on after login (we'll change these as pages get built)
const HOME_PAGE = {
  customer: 'bookings.html',
  staff: 'bookings.html',
  organiser: 'index.html',
  admin: 'index.html',
};

// Navbar links per role ('guest' = not logged in)
const NAV_LINKS = {
  guest:     [['index.html', 'Events']],
  customer:  [['index.html', 'Events'], ['bookings.html', 'My bookings']],
  staff:     [['index.html', 'Events'], ['bookings.html', 'Bookings']],
  organiser: [['index.html', 'Events'], ['manage-events.html', 'My events'],
              ['venues.html', 'Venues'], ['bookings.html', 'Bookings']],
  admin:     [['index.html', 'Events'], ['manage-events.html', 'Events admin'],
              ['venues.html', 'Venues'], ['bookings.html', 'Bookings'],
              ['users.html', 'Users']],
};

function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
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

// Protects a page. Usage: const user = requireRole(['organiser', 'admin']);
function requireRole(roles) {
  const user = getUser();
  if (!localStorage.getItem('token') || !user) {
    window.location.href = 'login.html';            // not logged in
    return null;
  }
  if (!roles.includes(user.role)) {
    window.location.href = 'index.html?denied=1';   // logged in but wrong role
    return null;
  }
  return user;
}

async function logout() {
  try {
    await apiRequest('POST', '/auth/logout');       // blacklists the JWT on the server
  } catch {
    // still log out locally even if the server call fails
  }
  clearSession();
  window.location.href = 'login.html';
}

// Navbar: links depend on the role; works for guests (user = null)
function renderNavbar(user) {
  const role = user ? user.role : 'guest';
  const links = NAV_LINKS[role]
    .map(([href, label]) => `<li class="nav-item"><a class="nav-link" href="${href}">${label}</a></li>`)
    .join('');

  document.getElementById('navbar').innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container">
        <a class="navbar-brand" href="index.html">EventHub</a>
        <ul class="navbar-nav me-auto">${links}</ul>
        <span class="navbar-text small me-3" id="nav-user"></span>
        <div id="nav-actions"></div>
      </div>
    </nav>`;

  const actions = document.getElementById('nav-actions');
  if (user) {
    // textContent so a user's name can't inject HTML
    document.getElementById('nav-user').textContent = `${user.name} (${user.role})`;
    actions.innerHTML = '<button id="logoutBtn" class="btn btn-outline-light btn-sm">Log out</button>';
    document.getElementById('logoutBtn').addEventListener('click', logout);
  } else {
    actions.innerHTML = `
      <a href="login.html" class="btn btn-outline-light btn-sm">Log in</a>
      <a href="register.html" class="btn btn-light btn-sm">Register</a>`;
  }
}

// Footer with your name and student ID
function renderFooter() {
  const footer = document.getElementById('footer');
  footer.className = 'text-center text-muted small py-3 border-top mt-5';
  footer.textContent = `Frontend by ${STUDENT.name} (${STUDENT.id})`;
}