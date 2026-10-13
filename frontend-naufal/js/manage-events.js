// js/manage-events.js: organiser/admin event management
// GET /events, PUT /events/{id} (publish/cancel), DELETE /events/{id}

const user = requireRole(['organiser', 'admin']);

const STATUS_BADGE = { draft: 'bg-warning text-dark', published: 'bg-success', cancelled: 'bg-secondary' };
const state = { page: 1, search: '', status: '' };
const rowsEl = document.getElementById('eventRows');
const paginationEl = document.getElementById('pagination');
const filterForm = document.getElementById('filterForm');

if (user) {
  renderNavbar(user);
  renderFooter();
  document.getElementById('pageTitle').textContent =
    user.role === 'admin' ? 'All events' : 'My events';

  // Success message passed from the form page after saving
  const flash = sessionStorage.getItem('flash');
  if (flash) {
    showAlert(flash, 'success');
    sessionStorage.removeItem('flash');
  }
  loadEvents();
}

async function loadEvents() {
  rowsEl.innerHTML = `<tr><td colspan="7" class="text-center py-4">
    <div class="spinner-border spinner-border-sm"></div> Loading events…</td></tr>`;
  paginationEl.innerHTML = '';

  const params = new URLSearchParams({ page: state.page, per_page: 5, sort: 'starts_at', direction: 'asc' });
  // Organisers only manage their own events; admins see everyone's
  if (user.role === 'organiser') params.set('organiser_id', user.id);
  if (state.search) params.set('search', state.search);
  if (state.status) params.set('status', state.status);

  try {
    const result = await apiRequest('GET', '/events?' + params);
    renderRows(result.data);
    paginationEl.innerHTML = paginationHtml(result.current_page, result.last_page);
  } catch (err) {
    rowsEl.innerHTML = '';
    showAlert(err.message);
  }
}

function renderRows(events) {
  if (events.length === 0) {
    rowsEl.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
      No events yet. Click "+ New event" to create one.</td></tr>`;
    return;
  }

  rowsEl.innerHTML = events.map(ev => `
    <tr>
      <td><strong>${escapeHtml(ev.title)}</strong>
        <div class="small text-muted">${escapeHtml(ev.category)}
          ${user.role === 'admin' ? ' · by ' + escapeHtml(ev.organiser.name) : ''}</div></td>
      <td class="small">${formatDateTime(ev.starts_at)}</td>
      <td class="small">${escapeHtml(ev.venue.name)}</td>
      <td>${ev.available_tickets} / ${ev.total_tickets}</td>
      <td>${formatPrice(ev.ticket_price)}</td>
      <td><span class="badge ${STATUS_BADGE[ev.status]}">${ev.status}</span></td>
      <td class="text-nowrap">${actionButtons(ev)}</td>
    </tr>`).join('');
}

function actionButtons(ev) {
  const btn = (action, label, style) =>
    `<button class="btn btn-sm ${style} me-1" data-action="${action}" data-id="${ev.id}"
       data-title="${escapeHtml(ev.title)}">${label}</button>`;

  const buttons = [];
  // A cancelled event can't be changed any more (business rule)
  if (ev.status !== 'cancelled') {
    buttons.push(`<a href="event-form.html?id=${ev.id}" class="btn btn-sm btn-outline-primary me-1">Edit</a>`);
    if (ev.status === 'draft') buttons.push(btn('publish', 'Publish', 'btn-success'));
    buttons.push(btn('cancel', 'Cancel', 'btn-outline-warning'));
  }
  buttons.push(btn('delete', 'Delete', 'btn-outline-danger'));
  return buttons.join('');
}

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const { action, id, title } = button.dataset;

  const questions = {
    publish: `Publish "${title}"? Customers will be able to book it.`,
    cancel: `Cancel "${title}"? All confirmed bookings will be cancelled too. This cannot be undone.`,
    delete: `Delete "${title}"? Only events without bookings can be deleted.`,
  };
  if (!confirm(questions[action])) return;

  hideAlert();
  setButtonLoading(button, true);
  try {
    const result = action === 'delete'
      ? await apiRequest('DELETE', `/events/${id}`)
      : await apiRequest('PUT', `/events/${id}`, { status: action === 'publish' ? 'published' : 'cancelled' });
    showAlert(result.message || 'Event updated.', 'success');
  } catch (err) {
    // 409 e.g. "This event has bookings. Cancel the event instead of deleting it."
    showAlert(err.status === 403 ? 'You can only manage your own events.' : err.message);
  }
  loadEvents();
});

paginationEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-page]');
  if (!button || button.parentElement.classList.contains('disabled')) return;
  state.page = Number(button.dataset.page);
  loadEvents();
});

filterForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideAlert();
  state.search = filterForm.search.value.trim();
  state.status = filterForm.status.value;
  state.page = 1;
  loadEvents();
});