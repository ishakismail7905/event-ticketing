// js/index.js: public page, so no requireRole()

const user = getUser();   // null if guest
renderNavbar(user);
renderFooter();

if (new URLSearchParams(window.location.search).has('denied')) {
  showAlert('Your role is not allowed to open that page.', 'warning');
}

document.getElementById('welcome').textContent = user
  ? `Welcome, ${user.name}! You are logged in as ${user.role}.`
  : 'Welcome, guest! Log in to book tickets.';