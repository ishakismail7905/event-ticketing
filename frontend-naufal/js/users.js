// js/users.js: admin user management
// GET /users, POST /users, PUT /users/{id}, DELETE /users/{id}

const user = requireRole(['admin']);

const ROLE_BADGE = { admin: 'bg-danger', organiser: 'bg-primary', staff: 'bg-info text-dark', customer: 'bg-secondary' };
const state = { page: 1, search: '', role: '', sort: 'id', direction: 'asc' };
let currentUsers = [];
let editingId = null;

const rowsEl = document.getElementById('userRows');
const paginationEl = document.getElementById('pagination');
const filterForm = document.getElementById('filterForm');
const userForm = document.getElementById('userForm');
const saveBtn = document.getElementById('saveBtn');
const formAlert = document.getElementById('formAlert');
const userModal = new bootstrap.Modal(document.getElementById('userModal'));

if (user) {
  renderNavbar(user);
  renderFooter();
  loadUsers();
}

async function loadUsers() {
  rowsEl.innerHTML = `<tr><td colspan="5" class="text-center py-4">
    <div class="spinner-border spinner-border-sm"></div> Loading users…</td></tr>`;
  paginationEl.innerHTML = '';

  const params = new URLSearchParams({
    page: state.page, per_page: 5, sort: state.sort, direction: state.direction,
  });
  if (state.search) params.set('search', state.search);
  if (state.role) params.set('role', state.role);

  try {
    const result = await apiRequest('GET', '/users?' + params);
    currentUsers = result.data;
    renderRows(currentUsers);
    paginationEl.innerHTML = paginationHtml(result.current_page, result.last_page);
  } catch (err) {
    rowsEl.innerHTML = '';
    showAlert(err.message);
  }
}

function renderRows(users) {
  if (users.length === 0) {
    rowsEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No users found.</td></tr>';
    return;
  }

  rowsEl.innerHTML = users.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.name)}</strong>
        ${u.id === user.id ? '<span class="badge bg-light text-dark border ms-1">you</span>' : ''}</td>
      <td>${escapeHtml(u.email)}</td>
      <td class="small">${escapeHtml(u.phone || '—')}</td>
      <td><span class="badge ${ROLE_BADGE[u.role]}">${u.role}</span></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${u.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${u.id}">Delete</button>
      </td>
    </tr>`).join('');
}

// Password is required when creating, optional when editing
function openForm(target = null) {
  editingId = target ? target.id : null;
  userForm.reset();
  clearFieldErrors(userForm);
  formAlert.classList.add('d-none');

  document.getElementById('modalTitle').textContent = target ? 'Edit user' : 'New user';
  userForm.password.required = !target;
  document.getElementById('passwordLabel').textContent = target ? 'New password' : 'Password *';
  document.getElementById('passwordHint').textContent = target ? 'Leave blank to keep the current password.' : '';

  if (target) {
    userForm.name.value = target.name;
    userForm.email.value = target.email;
    userForm.role.value = target.role;
    userForm.phone.value = target.phone || '';
  }
  userModal.show();
}

document.getElementById('newUserBtn').addEventListener('click', () => openForm());

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(userForm);
  formAlert.classList.add('d-none');

  if (!userForm.checkValidity()) {
    userForm.classList.add('was-validated');
    return;
  }

  const payload = {
    name: userForm.name.value.trim(),
    email: userForm.email.value.trim(),
    role: userForm.role.value,
    phone: userForm.phone.value.trim() || null,
  };
  // Only send a password if one was typed (PUT changes only the fields sent)
  if (userForm.password.value) payload.password = userForm.password.value;

  setButtonLoading(saveBtn, true);
  try {
    const result = editingId
      ? await apiRequest('PUT', `/users/${editingId}`, payload)
      : await apiRequest('POST', '/users', payload);
    userModal.hide();
    showAlert(result.message || 'User saved.', 'success');
    loadUsers();
  } catch (err) {
    // 422 e.g. "The email has already been taken."  409 "You cannot change your own role."
    if (err.status === 422) showFieldErrors(err.errors);
    formAlert.textContent = err.message;
    formAlert.classList.remove('d-none');
  } finally {
    setButtonLoading(saveBtn, false, 'Save user');
  }
});

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const target = currentUsers.find(u => u.id === Number(button.dataset.id));

  if (button.dataset.action === 'edit') return openForm(target);

  if (!confirm(`Delete ${target.name} (${target.email})? This cannot be undone.`)) return;
  hideAlert();
  setButtonLoading(button, true);
  try {
    const result = await apiRequest('DELETE', `/users/${target.id}`);
    showAlert(result.message || 'User deleted.', 'success');
  } catch (err) {
    showAlert(err.message);   // 409: has events/bookings, or your own account
  }
  loadUsers();
});

paginationEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-page]');
  if (!button || button.parentElement.classList.contains('disabled')) return;
  state.page = Number(button.dataset.page);
  loadUsers();
});

filterForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideAlert();
  const [sort, direction] = filterForm.sort.value.split(':');
  state.search = filterForm.search.value.trim();
  state.role = filterForm.role.value;
  state.sort = sort;
  state.direction = direction;
  state.page = 1;
  loadUsers();
});