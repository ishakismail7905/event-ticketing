// js/register.js: POST /auth/register (always creates a customer)

const form = document.getElementById('registerForm');
const registerBtn = document.getElementById('registerBtn');

// Already logged in? No need to register.
const existing = getUser();
if (existing) window.location.href = HOME_PAGE[existing.role] || 'index.html';

renderNavbar(null);
renderFooter();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  clearFieldErrors(form);

  // Custom browser rule: passwords must match
  const mismatch = form.password.value !== form.password_confirmation.value;
  form.password_confirmation.setCustomValidity(mismatch ? 'Passwords do not match.' : '');

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  setButtonLoading(registerBtn, true);
  try {
    const result = await apiRequest('POST', '/auth/register', {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim() || null,
      password: form.password.value,
      password_confirmation: form.password_confirmation.value,
    });
    // The API returns a token straight away, so log the new customer in
    saveSession(result.data.access_token, result.data.user);
    window.location.href = 'index.html';
  } catch (err) {
    if (err.status === 422) showFieldErrors(err.errors);   // e.g. email already taken
    showAlert(err.message);
    setButtonLoading(registerBtn, false, 'Create account');
  }
});