// js/nav.js - draws the top navbar. Links depend on the logged-in role.
// Author: Muhammad Anas (AM2512021976)

// Add a link here each time a new page is built.
const NAV_LINKS = {
  guest:     [{ href: 'index.html', text: 'Events' }],
  customer:  [{ href: 'index.html', text: 'Events' }, { href: 'bookings.html', text: 'My bookings' }],
  staff:     [{ href: 'index.html', text: 'Events' }, { href: 'bookings.html', text: 'Bookings' }],
  organiser: [{ href: 'index.html', text: 'Events' }, { href: 'manage-events.html', text: 'My events' },
              { href: 'venues.html', text: 'Venues' }, { href: 'bookings.html', text: 'Bookings' }],
    admin:     [{ href: 'index.html', text: 'Events' }, { href: 'manage-events.html', text: 'Manage events' },
              { href: 'venues.html', text: 'Venues' }, { href: 'bookings.html', text: 'Bookings' },
              { href: 'users.html', text: 'Users' }],
};

// nav.js runs on pages without ui.js, so it has its own small escape helper
function navEsc(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

function renderNavbar() {
  const user = getUser();
  const role = user ? user.role : 'guest';
  const current = window.location.pathname.split('/').pop() || 'index.html';

  const links = NAV_LINKS[role]
    .map((l) => {
      const active = l.href === current ? ' active' : '';
      return '<li class="nav-item"><a class="nav-link' + active + '" href="' + l.href + '">' + l.text + '</a></li>';
    })
    .join('');

  const right = user
    ? '<span class="navbar-text text-white text-nowrap me-3">' + navEsc(user.name) + ' (' + navEsc(role) + ')</span>' +
      '<button class="btn btn-sm btn-outline-light text-nowrap" id="logoutBtn">Log out</button>'
    : '<a class="btn btn-sm btn-outline-light" href="login.html">Log in</a>';

  document.getElementById('navbar').innerHTML =
    '<nav class="navbar navbar-expand-lg navbar-dark" style="background:#0e6b5c">' +
      '<div class="container">' +
        '<a class="navbar-brand fw-bold" href="index.html">EventHub</a>' +
        '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu" ' +
          'aria-controls="navMenu" aria-expanded="false" aria-label="Toggle menu">' +
          '<span class="navbar-toggler-icon"></span></button>' +
        '<div class="collapse navbar-collapse" id="navMenu">' +
          '<ul class="navbar-nav me-auto">' + links + '</ul>' +
          '<div class="d-flex align-items-center">' + right + '</div>' +
        '</div>' +
      '</div>' +
    '</nav>' +
    // Name and student ID must be visible on every page: its own full-width row
    '<div class="text-center small py-1" style="background:#0a4e43; color:#d7e9e4">' +
      STUDENT_NAME + ' &middot; ' + STUDENT_ID +
    '</div>';

  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', logout);
}