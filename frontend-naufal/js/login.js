// js/login.js

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');

renderNavbar(null);   // guest navbar
renderFooter();

if (new URLSearchParams(window.location.search).has('expired')) {
  showAlert('Your session expired. Please log in again.', 'warning');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert();
  clearFieldErrors(form);

  // 1. Browser validation (required, type="email")
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  setButtonLoading(loginBtn, true);
  try {
    // 2. Call the API
    const result = await apiRequest('POST', '/auth/login', {
      email: form.email.value.trim(),
      password: form.password.value,
    });

    // 3. Save the token and user, then go to that role's home page
    const user = result.data.user;
    saveSession(result.data.access_token, user);
    window.location.href = HOME_PAGE[user.role] || 'index.html';
  } catch (err) {
    if (err.status === 422) showFieldErrors(err.errors);
    if (err.status === 429) {
      showAlert('Too many login attempts. Wait one minute and try again.', 'warning');
    } else {
      showAlert(err.message, 'danger');   // e.g. 401 "Invalid email or password."
    }
  } finally {
    setButtonLoading(loginBtn, false, 'Log in');
  }
});