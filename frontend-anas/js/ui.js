// js/ui.js - small helpers shared by every page built after index and event.
// Author: Muhammad Anas (AM2512021976)

// Escape text from the API before putting it inside HTML
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// API date format: "YYYY-MM-DD HH:MM:SS"
function formatDate(s) {
  if (!s) return '';
  return new Date(s.replace(' ', 'T')).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPrice(p) {
  return Number(p) === 0 ? 'Free' : 'RM ' + Number(p).toFixed(2);
}

// Show a Bootstrap alert. type: 'success', 'danger', 'warning', 'info'
function showAlert(el, text, type) {
  el.textContent = text;
  el.className = 'alert alert-' + type;
}

function hideAlert(el) {
  el.className = 'alert d-none';
}

// Remove red borders and error text from every field in a form
function clearFieldErrors(form) {
  form.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
  form.querySelectorAll('.invalid-feedback').forEach((div) => { div.textContent = ''; });
}

// Mark one field as invalid. The input's id must match the API field name,
// and its error div must have the id fieldName + 'Error'.
function setFieldError(field, message) {
  const input = document.getElementById(field);
  const errorDiv = document.getElementById(field + 'Error');
  if (input) input.classList.add('is-invalid');
  if (errorDiv) errorDiv.textContent = message;
}

// Put each 422 message from the server under its field
function showFieldErrors(errors) {
  for (const field in errors) {
    setFieldError(field, errors[field][0]);
  }
}

// Disable a button and change its text while a request runs
function setButtonLoading(btn, isLoading, loadingText) {
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText || 'Please wait...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}

// Friendly text for common error codes. Falls back to the API's own message.
function friendlyError(err) {
  if (err.status === 403) return 'Your role is not allowed to do this. ' + err.message;
  if (err.status === 404) return 'That item no longer exists.';
  if (err.status === 429) return 'Too many requests. Wait a minute and try again.';
  return err.message;
}