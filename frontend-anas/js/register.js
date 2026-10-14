// js/register.js - customer registration form.
// Author: Muhammad Anas (AM2512021976)

const form = document.getElementById('registerForm');
const messageEl = document.getElementById('message');
const registerBtn = document.getElementById('registerBtn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(messageEl);
  clearFieldErrors(form);

  const body = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    password_confirmation: document.getElementById('password_confirmation').value,
  };
  const phone = document.getElementById('phone').value.trim();
  if (phone) body.phone = phone; // only send phone if the user typed one

  // Browser-side validation, same rules as the API
  let valid = true;
  if (!body.name) { setFieldError('name', 'Enter your name.'); valid = false; }
  if (!body.email || !document.getElementById('email').checkValidity()) {
    setFieldError('email', 'Enter a valid email address.'); valid = false;
  }
  if (body.password.length < 8) {
    setFieldError('password', 'Password must be at least 8 characters.'); valid = false;
  }
  if (body.password !== body.password_confirmation) {
    setFieldError('password_confirmation', 'Passwords do not match.'); valid = false;
  }
  if (!valid) return;

  setButtonLoading(registerBtn, true, 'Creating account...');
  try {
    const result = await apiRequest('POST', '/auth/register', body);
    saveSession(result); // the API logs the new customer in straight away
    showAlert(messageEl, 'Account created! Welcome, ' + result.data.user.name + '. Taking you to events...', 'success');
    form.reset();
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  } catch (err) {
    if (err.status === 422) {
      showFieldErrors(err.errors); // server messages under each field
      showAlert(messageEl, 'Please fix the highlighted fields.', 'danger');
    } else {
      showAlert(messageEl, friendlyError(err), 'danger');
    }
    setButtonLoading(registerBtn, false);
  }
});