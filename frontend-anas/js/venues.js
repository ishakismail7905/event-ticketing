// js/venues.js - organisers and admin create and edit venues; only admin can delete.
// Author: Muhammad Anas (AM2512021976)

const user = requireRole(['organiser', 'admin']);

let currentPage = 1;
let lastPage = 1;
let pageVenues = {};
let editingVenue = null; // null means "creating"

const field = (id) => document.getElementById(id);
const rowsEl = field('rows');
const tableEl = field('table');
const loadingEl = field('loading');
const emptyEl = field('empty');
const messageEl = field('message');
const form = field('venueForm');
const formMessage = field('formMessage');
const saveBtn = field('saveBtn');
const venueModal = new bootstrap.Modal(field('venueModal'));

function actionButton(action, id, text, style) {
  return '<button type="button" class="btn btn-sm ' + style + ' ms-1" data-action="' + action +
    '" data-id="' + id + '">' + text + '</button>';
}

function drawRows(venues) {
  pageVenues = {};
  rowsEl.innerHTML = venues.map((v) => {
    pageVenues[v.id] = v;
    return '<tr>' +
      '<td>' + esc(v.name) + '</td>' +
      '<td>' + esc(v.address) + '</td>' +
      '<td>' + esc(v.city) + '</td>' +
      '<td>' + v.capacity + '</td>' +
      '<td class="text-end text-nowrap">' +
        actionButton('edit', v.id, 'Edit', 'btn-outline-primary') +
        (user.role === 'admin' ? actionButton('delete', v.id, 'Delete', 'btn-danger') : '') +
      '</td>' +
    '</tr>';
  }).join('');
}

async function loadVenues() {
  const params = new URLSearchParams({ page: currentPage, per_page: 10, sort: 'name' });
  const search = field('search').value.trim();
  if (search) params.set('search', search);

  hideAlert(messageEl);
  emptyEl.classList.add('d-none');
  tableEl.classList.add('d-none');
  loadingEl.classList.remove('d-none');

  try {
    const result = await apiRequest('GET', '/venues?' + params.toString());
    lastPage = result.last_page;
    if (result.data.length === 0) {
      emptyEl.classList.remove('d-none');
    } else {
      drawRows(result.data);
      tableEl.classList.remove('d-none');
    }
    field('pageInfo').textContent =
      'Page ' + result.current_page + ' of ' + result.last_page + ' (' + result.total + ' venues)';
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    field('prevBtn').disabled = currentPage <= 1;
    field('nextBtn').disabled = currentPage >= lastPage;
  }
}

function openForm(v) {
  editingVenue = v || null;
  form.reset();
  clearFieldErrors(form);
  hideAlert(formMessage);
  field('formTitle').textContent = v ? 'Edit venue' : 'New venue';
  if (v) {
    field('name').value = v.name;
    field('address').value = v.address;
    field('city').value = v.city;
    field('capacity').value = v.capacity;
  }
  venueModal.show();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  hideAlert(formMessage);

  const capacityText = field('capacity').value;
  const data = {
    name: field('name').value.trim(),
    address: field('address').value.trim(),
    city: field('city').value.trim(),
    capacity: capacityText === '' ? '' : Number(capacityText),
  };

  // Browser-side validation
  let ok = true;
  if (!data.name) { setFieldError('name', 'Enter the venue name.'); ok = false; }
  if (!data.address) { setFieldError('address', 'Enter the address.'); ok = false; }
  if (!data.city) { setFieldError('city', 'Enter the city.'); ok = false; }
  if (!Number.isInteger(data.capacity) || data.capacity < 1) {
    setFieldError('capacity', 'Enter a whole number of at least 1.'); ok = false;
  }
  if (!ok) return;

  // When editing, only send what changed
  let body = data;
  if (editingVenue) {
    body = {};
    for (const key in data) {
      if (data[key] !== editingVenue[key]) body[key] = data[key];
    }
    if (Object.keys(body).length === 0) {
      showAlert(formMessage, 'Nothing has changed yet.', 'info');
      return;
    }
  }

  setButtonLoading(saveBtn, true, 'Saving...');
  try {
    const result = editingVenue
      ? await apiRequest('PUT', '/venues/' + editingVenue.id, body)
      : await apiRequest('POST', '/venues', body);
    venueModal.hide();
    await loadVenues();
    showAlert(messageEl, result.message + ' "' + result.data.name + '"', 'success');
  } catch (err) {
    if (err.status === 422) {
      showFieldErrors(err.errors); // e.g. "A venue with this name already exists in this city."
      showAlert(formMessage, 'Please fix the highlighted fields.', 'danger');
    } else {
      showAlert(formMessage, friendlyError(err), 'danger'); // e.g. 409 capacity too low
    }
  } finally {
    setButtonLoading(saveBtn, false);
  }
});

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const v = pageVenues[button.dataset.id];

  if (button.dataset.action === 'edit') { openForm(v); return; }
  if (!confirm('Are you sure you want to delete "' + v.name + '"? This cannot be undone.')) return;

  setButtonLoading(button, true, 'Deleting...');
  try {
    const result = await apiRequest('DELETE', '/venues/' + v.id);
    await loadVenues();
    showAlert(messageEl, result.message, 'success');
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger'); // e.g. 409 "This venue has events"
    setButtonLoading(button, false);
  }
});

field('newVenueBtn').addEventListener('click', () => openForm(null));
field('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentPage = 1;
  loadVenues();
});
field('prevBtn').addEventListener('click', () => { currentPage--; loadVenues(); });
field('nextBtn').addEventListener('click', () => { currentPage++; loadVenues(); });

if (user) {
  renderNavbar();
  loadVenues();
}