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