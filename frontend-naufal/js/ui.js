// js/ui.js: small helpers reused on every page

function showAlert(message, type = 'danger') {
  const box = document.getElementById('alert');
  box.className = `alert alert-${type}`;
  box.textContent = message;
}

function hideAlert() {
  document.getElementById('alert').className = 'alert d-none';
}

// Put Laravel 422 errors under the matching input, e.g. errors.email → <input name="email">
function showFieldErrors(errors) {
  for (const [field, messages] of Object.entries(errors)) {
    const input = document.querySelector(`[name="${field}"]`);
    const feedback = document.getElementById(`${field}-error`);
    if (input) input.classList.add('is-invalid');
    if (feedback) feedback.textContent = messages[0];
  }
}

function clearFieldErrors(form) {
  form.classList.remove('was-validated');
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

// Disable a button and show a spinner while a request runs
function setButtonLoading(button, loading, text) {
  button.disabled = loading;
  button.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm me-2"></span>Please wait…'
    : text;
}
// Escape text before putting it inside innerHTML (prevents HTML injection)
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

// "2026-12-05 20:30:00" → "5 Dec 2026, 8:30 pm"
function formatDateTime(value) {
  const date = new Date(value.replace(' ', 'T'));
  return date.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

// "0.00" → "Free", "45.00" → "RM 45.00"
function formatPrice(value) {
  return Number(value) === 0 ? 'Free' : 'RM ' + Number(value).toFixed(2);
}