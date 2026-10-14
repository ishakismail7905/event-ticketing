// js/users.js - admin manages user accounts.
// Author: Muhammad Anas (AM2512021976)

const user = requireRole(['admin']);

let currentPage = 1;
let lastPage = 1;
let pageUsers = {};
let editingUser = null; // null means "creating"

const field = (id) => document.getElementById(id);
const rowsEl = field('rows');
const tableEl = field('table');
const loadingEl = field('loading');
const emptyEl = field('empty');
const messageEl = field('message');
const form = field('userForm');
const formMessage = field('formMessage');
const saveBtn = field('saveBtn');
const userModal = new bootstrap.Modal(field('userModal'));

const ROLE_BADGE = { admin: 'text-bg-dark', organiser: 'text-bg-primary', staff: 'text-bg-info', customer: 'text-bg-light border' };

function actionButton(action, id, text, style) {
  return '<button type="button" class="btn btn-sm ' + style + ' ms-1" data-action="' + action +
    '" data-id="' + id + '">' + text + '</button>';
}

function drawRows(users) {
  pageUsers = {};
  rowsEl.innerHTML = users.map((u) => {
    pageUsers[u.id] = u;
    const isMe = u.id === user.id;
    return '<tr>' +
      '<td>' + esc(u.name) + (isMe ? ' <span class="small text-secondary">(you)</span>' : '') + '</td>' +
      '<td>' + esc(u.email) + '</td>' +
      '<td>' + esc(u.phone || '-') + '</td>' +
      '<td><span class="badge ' + ROLE_BADGE[u.role] + '">' + esc(u.role) + '</span></td>' +
      '<td class="text-end text-nowrap">' +
        actionButton('edit', u.id, 'Edit', 'btn-outline-primary') +
        (isMe ? '' : actionButton('delete', u.id, 'Delete', 'btn-danger')) +
      '</td>' +
    '</tr>';
  }).join('');
}

async function loadUsers() {
  const params = new URLSearchParams({ page: currentPage, per_page: 10 });
  const search = field('search').value.trim();
  const role = field('roleFilter').value;
  if (search) params.set('search', search);
  if (role) params.set('role', role);

  hideAlert(messageEl);
  emptyEl.classList.add('d-none');
  tableEl.classList.add('d-none');
  loadingEl.classList.remove('d-none');

  try {
    const result = await apiRequest('GET', '/users?' + params.toString());
    lastPage = result.last_page;
    if (result.data.length === 0) {
      emptyEl.classList.remove('d-none');
    } else {
      drawRows(result.data);
      tableEl.classList.remove('d-none');
    }
    field('pageInfo').textContent =
      'Page ' + result.current_page + ' of ' + result.last_page + ' (' + result.total + ' users)';
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    field('prevBtn').disabled = currentPage <= 1;
    field('nextBtn').disabled = currentPage >= lastPage;
  }
}

function openForm(u) {
  editingUser = u || null;
  form.reset();
  clearFieldErrors(form);
  hideAlert(formMessage);
  field('formTitle').textContent = u ? 'Edit user' : 'New user';
  field('passwordHelp').textContent = u
    ? 'Leave empty to keep the current password.'
    : 'At least 8 characters.';
  if (u) {
    field('name').value = u.name;
    field('email').value = u.email;
    field('phone').value = u.phone || '';
    field('role').value = u.role;
  }
  userModal.show();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  hideAlert(formMessage);

  const data = {
    name: field('name').value.trim(),
    email: field('email').value.trim(),
    phone: field('phone').value.trim(),
    role: field('role').value,
    password: field('password').value,
  };

  // Browser-side validation
  let ok = true;
  if (!data.name) { setFieldError('name', 'Enter a name.'); ok = false; }
  if (!data.email || !field('email').checkValidity()) { setFieldError('email', 'Enter a valid email address.'); ok = false; }
  if (!editingUser && data.password.length < 8) { setFieldError('password', 'Password must be at least 8 characters.'); ok = false; }
  if (editingUser && data.password && data.password.length < 8) { setFieldError('password', 'New password must be at least 8 characters.'); ok = false; }
  if (!ok) return;

  let body = {};
  if (editingUser) {
    // Only send what changed; an empty password box means "keep the old one"
    ['name', 'email', 'role'].forEach((k) => { if (data[k] !== editingUser[k]) body[k] = data[k]; });
    if (data.phone !== (editingUser.phone || '')) body.phone = data.phone;
    if (data.password) body.password = data.password;
    if (Object.keys(body).length === 0) {
      showAlert(formMessage, 'Nothing has changed yet.', 'info');
      return;
    }
  } else {
    body = { name: data.name, email: data.email, role: data.role, password: data.password };
    if (data.phone) body.phone = data.phone;
  }

  setButtonLoading(saveBtn, true, 'Saving...');
  try {
    const result = editingUser
      ? await apiRequest('PUT', '/users/' + editingUser.id, body)
      : await apiRequest('POST', '/users', body);
    userModal.hide();
    await loadUsers();
    showAlert(messageEl, result.message + ' (' + result.data.name + ', ' + result.data.role + ')', 'success');
  } catch (err) {
    if (err.status === 422) {
      showFieldErrors(err.errors); // e.g. "The email has already been taken."
      showAlert(formMessage, 'Please fix the highlighted fields.', 'danger');
    } else {
      showAlert(formMessage, friendlyError(err), 'danger'); // e.g. 409 "You cannot change your own role."
    }
  } finally {
    setButtonLoading(saveBtn, false);
  }
});

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const u = pageUsers[button.dataset.id];

  if (button.dataset.action === 'edit') { openForm(u); return; }
  if (!confirm('Are you sure you want to delete ' + u.name + ' (' + u.email + ')? This cannot be undone.')) return;

  setButtonLoading(button, true, 'Deleting...');
  try {
    const result = await apiRequest('DELETE', '/users/' + u.id);
    await loadUsers();
    showAlert(messageEl, result.message, 'success');
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger'); // e.g. 409 "has events or bookings"
    setButtonLoading(button, false);
  }
});

field('newUserBtn').addEventListener('click', () => openForm(null));
field('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentPage = 1;
  loadUsers();
});
field('prevBtn').addEventListener('click', () => { currentPage--; loadUsers(); });
field('nextBtn').addEventListener('click', () => { currentPage++; loadUsers(); });

if (user) {
  renderNavbar();
  loadUsers();
}