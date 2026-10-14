// js/venues.js: venues list with create/edit in a modal
// GET /venues, POST /venues, PUT /venues/{id}, DELETE /venues/{id} (admin)

const user = requireRole(['organiser', 'admin']);

const state = { page: 1, search: '', min_capacity: '', sort: 'name', direction: 'asc' };
let currentVenues = [];   // venues on the current page, used to fill the edit form
let editingId = null;     // null = creating, number = editing

const rowsEl = document.getElementById('venueRows');
const paginationEl = document.getElementById('pagination');
const filterForm = document.getElementById('filterForm');
const venueForm = document.getElementById('venueForm');
const saveBtn = document.getElementById('saveBtn');
const formAlert = document.getElementById('formAlert');
const venueModal = new bootstrap.Modal(document.getElementById('venueModal'));

if (user) {
  renderNavbar(user);
  renderFooter();
  loadVenues();
}

async function loadVenues() {
  rowsEl.innerHTML = `<tr><td colspan="5" class="text-center py-4">
    <div class="spinner-border spinner-border-sm"></div> Loading venues…</td></tr>`;
  paginationEl.innerHTML = '';

  const params = new URLSearchParams({
    page: state.page, per_page: 5, sort: state.sort, direction: state.direction,
  });
  if (state.search) params.set('search', state.search);
  if (state.min_capacity) params.set('min_capacity', state.min_capacity);

  try {
    const result = await apiRequest('GET', '/venues?' + params);
    currentVenues = result.data;
    renderRows(currentVenues);
    paginationEl.innerHTML = paginationHtml(result.current_page, result.last_page);
  } catch (err) {
    rowsEl.innerHTML = '';
    showAlert(err.message);
  }
}

function renderRows(venues) {
  if (venues.length === 0) {
    rowsEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No venues found.</td></tr>';
    return;
  }

  rowsEl.innerHTML = venues.map(v => `
    <tr>
      <td><strong>${escapeHtml(v.name)}</strong></td>
      <td class="small">${escapeHtml(v.address)}</td>
      <td>${escapeHtml(v.city)}</td>
      <td>${v.capacity.toLocaleString()}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${v.id}">Edit</button>
        ${user.role === 'admin'
          ? `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${v.id}">Delete</button>`
          : ''}
      </td>
    </tr>`).join('');
}

// Open the modal empty (create) or filled (edit)
function openForm(venue = null) {
  editingId = venue ? venue.id : null;
  document.getElementById('modalTitle').textContent = venue ? 'Edit venue' : 'New venue';
  venueForm.reset();
  clearFieldErrors(venueForm);
  formAlert.classList.add('d-none');

  if (venue) {
    venueForm.name.value = venue.name;
    venueForm.address.value = venue.address;
    venueForm.city.value = venue.city;
    venueForm.capacity.value = venue.capacity;
  }
  venueModal.show();
}

document.getElementById('newVenueBtn').addEventListener('click', () => openForm());

venueForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(venueForm);
  formAlert.classList.add('d-none');

  if (!venueForm.checkValidity()) {
    venueForm.classList.add('was-validated');
    return;
  }

  const payload = {
    name: venueForm.name.value.trim(),
    address: venueForm.address.value.trim(),
    city: venueForm.city.value.trim(),
    capacity: Number(venueForm.capacity.value),
  };

  setButtonLoading(saveBtn, true);
  try {
    const result = editingId
      ? await apiRequest('PUT', `/venues/${editingId}`, payload)
      : await apiRequest('POST', '/venues', payload);
    venueModal.hide();
    showAlert(result.message || 'Venue saved.', 'success');
    loadVenues();
  } catch (err) {
    // 422: e.g. "A venue with this name already exists in this city."
    // 409: e.g. "Capacity cannot be lower than 600, the ticket total of an event at this venue."
    if (err.status === 422) showFieldErrors(err.errors);
    formAlert.textContent = err.message;
    formAlert.classList.remove('d-none');
  } finally {
    setButtonLoading(saveBtn, false, 'Save venue');
  }
});

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const venue = currentVenues.find(v => v.id === Number(button.dataset.id));

  if (button.dataset.action === 'edit') return openForm(venue);

  // Delete (admin only)
  if (!confirm(`Delete "${venue.name}"? Only venues with no events can be deleted.`)) return;
  hideAlert();
  setButtonLoading(button, true);
  try {
    const result = await apiRequest('DELETE', `/venues/${venue.id}`);
    showAlert(result.message || 'Venue deleted.', 'success');
  } catch (err) {
    showAlert(err.status === 403 ? 'Only admins can delete venues.' : err.message);   // 409 if it has events
  }
  loadVenues();
});

paginationEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-page]');
  if (!button || button.parentElement.classList.contains('disabled')) return;
  state.page = Number(button.dataset.page);
  loadVenues();
});

filterForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideAlert();
  const [sort, direction] = filterForm.sort.value.split(':');
  state.search = filterForm.search.value.trim();
  state.min_capacity = filterForm.min_capacity.value;
  state.sort = sort;
  state.direction = direction;
  state.page = 1;
  loadVenues();
});