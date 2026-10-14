// js/login.js - handles the login form.
// Author: Muhammad Anas (AM2512021976)

const form = document.getElementById('loginForm');
const messageBox = document.getElementById('message');
const loginBtn = document.getElementById('loginBtn');
const spinner = document.getElementById('spinner');
const btnText = document.getElementById('btnText');

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = 'alert alert-' + type;
}

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  spinner.classList.toggle('d-none', !isLoading);
  btnText.textContent = isLoading ? 'Logging in...' : 'Log in';
}

function clearErrors() {
  messageBox.className = 'alert d-none';
  ['email', 'password'].forEach((f) => {
    document.getElementById(f).classList.remove('is-invalid');
    document.getElementById(f + 'Error').textContent = '';
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Browser-side validation
  let valid = true;
  if (!email || !email.includes('@')) {
    document.getElementById('email').classList.add('is-invalid');
    document.getElementById('emailError').textContent = 'Enter a valid email address.';
    valid = false;
  }
  if (!password) {
    document.getElementById('password').classList.add('is-invalid');
    document.getElementById('passwordError').textContent = 'Enter your password.';
    valid = false;
  }
  if (!valid) return;

  setLoading(true);
  try {
    const result = await apiRequest('POST', '/auth/login', { email, password });
    saveSession(result);
    const user = result.data.user;
    
        window.location.href = 'index.html';
  } catch (err) {
    if (err.status === 422) {
      // Server-side validation: show each message under its field
      for (const field in err.errors) {
        const input = document.getElementById(field);
        if (input) {
          input.classList.add('is-invalid');
          document.getElementById(field + 'Error').textContent = err.errors[field][0];
        }
      }
    }
    // 401 = wrong password, 429 = too many tries, 0 = server down
    showMessage(err.message, 'danger');
  } finally {
    setLoading(false);
  }
});
