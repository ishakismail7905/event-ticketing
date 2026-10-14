// js/nav.js - draws the top navbar. Links depend on the logged-in role.
// Author: Muhammad Anas (AM2512021976)

// Add a link here each time a new page is built.
const NAV_LINKS = {
  guest:     [{ href: 'index.html', text: 'Events' }],
  customer:  [{ href: 'index.html', text: 'Events' }],
  staff:     [{ href: 'index.html', text: 'Events' }],
  organiser: [{ href: 'index.html', text: 'Events' }],
  admin:     [{ href: 'index.html', text: 'Events' }],
};

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
    ? '<span class="navbar-text me-3">' + user.name + ' (' + role + ')</span>' +
      '<button class="btn btn-sm btn-outline-light" id="logoutBtn">Log out</button>'
    : '<a class="btn btn-sm btn-outline-light" href="login.html">Log in</a>';

  document.getElementById('navbar').innerHTML =
    '<nav class="navbar navbar-expand-md navbar-dark" style="background:#0e6b5c">' +
      '<div class="container">' +
        '<a class="navbar-brand fw-bold" href="index.html">EventHub</a>' +
        '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">' +
          '<span class="navbar-toggler-icon"></span></button>' +
        '<div class="collapse navbar-collapse" id="navMenu">' +
          '<ul class="navbar-nav me-auto">' + links + '</ul>' +
          '<div class="d-flex align-items-center text-white">' + right + '</div>' +
        '</div>' +
      '</div>' +
      // Name and student ID must be visible on every page
      '<div class="w-100 text-center small text-white-50 pb-1" style="background:#0a4e43">' +
        STUDENT_NAME + ' &middot; ' + STUDENT_ID +
      '</div>' +
    '</nav>';

  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', logout);
}
