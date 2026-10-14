// js/manage-events.js - organisers manage their own events; admin manages all events.
// Author: Muhammad Anas (AM2512021976)

const user = requireRole(['organiser', 'admin']);

let currentPage = 1;
let lastPage = 1;
let venues = [];       // for the dropdown and the capacity check
let pageEvents = {};   // events on the current page, by id
let editingEvent = null; // null means "creating a new event"

const field = (id) => document.getElementById(id);
const rowsEl = field('rows');
const tableEl = field('table');
const loadingEl = field('loading');
const emptyEl = field('empty');
const messageEl = field('message');
const form = field('eventForm');
const formMessage = field('formMessage');
const saveBtn = field('saveBtn');
const eventModal = new bootstrap.Modal(field('eventModal'));

const STATUS_BADGE = { draft: 'text-bg-warning', published: 'text-bg-success', cancelled: 'text-bg-secondary' };

// "2026-12-05 20:30:00" (API) <-> "2026-12-05T20:30" (datetime-local input)
function toInputDate(s) { return s ? s.slice(0, 16).replace(' ', 'T') : ''; }
function toApiDate(v) { return v ? v.replace('T', ' ') + ':00' : ''; }

function actionButton(action, id, text, style) {
  return '<button type="button" class="btn btn-sm ' + style + ' ms-1" data-action="' + action +
    '" data-id="' + id + '">' + text + '</button>';
}

function actionsFor(e) {
  const buttons = [];
  if (e.status !== 'cancelled') buttons.push(actionButton('edit', e.id, 'Edit', 'btn-outline-primary'));
  if (e.status === 'draft') buttons.push(actionButton('publish', e.id, 'Publish', 'btn-success'));
  if (e.status === 'published') buttons.push(actionButton('cancel', e.id, 'Cancel', 'btn-outline-danger'));
  buttons.push(actionButton('delete', e.id, 'Delete', 'btn-danger'));
  return buttons.join('');
}

function drawRows(events) {
  pageEvents = {};
  rowsEl.innerHTML = events.map((e) => {
    pageEvents[e.id] = e;
    return '<tr>' +
      '<td><a href="event.html?id=' + e.id + '" class="text-decoration-none">' + esc(e.title) + '</a>' +
        '<div class="small text-secondary">' + esc(e.category) +
        (user.role === 'admin' ? ' &middot; by ' + esc(e.organiser.name) : '') + '</div></td>' +
      '<td class="small">' + formatDate(e.starts_at) + '</td>' +
      '<td class="small">' + esc(e.venue.name) + '<div class="text-secondary">' + esc(e.venue.city) + '</div></td>' +
      '<td>' + formatPrice(e.ticket_price) + '</td>' +
      '<td>' + e.available_tickets + ' / ' + e.total_tickets + '</td>' +
      '<td><span class="badge ' + STATUS_BADGE[e.status] + '">' + esc(e.status) + '</span></td>' +
      '<td class="text-end text-nowrap">' + actionsFor(e) + '</td>' +
    '</tr>';
  }).join('');
}

async function loadVenues() {
  try {
    const result = await apiRequest('GET', '/venues?per_page=100&sort=name');
    venues = result.data;
    field('venue_id').innerHTML = '<option value="">Choose a venue</option>' +
      venues.map((v) => '<option value="' + v.id + '">' + esc(v.name) + ', ' + esc(v.city) +
        ' (holds ' + v.capacity + ')</option>').join('');
  } catch (err) {
    showAlert(messageEl, 'Could not load venues: ' + friendlyError(err), 'danger');
  }
}

async function loadEvents() {
  const params = new URLSearchParams({ page: currentPage, per_page: 10 });
  if (user.role === 'organiser') params.set('organiser_id', user.id); // organisers only see their own
  const search = field('search').value.trim();
  const status = field('statusFilter').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  hideAlert(messageEl);
  emptyEl.classList.add('d-none');
  tableEl.classList.add('d-none');
  loadingEl.classList.remove('d-none');

  try {
    const result = await apiRequest('GET', '/events?' + params.toString());
    lastPage = result.last_page;
    if (result.data.length === 0) {
      emptyEl.classList.remove('d-none');
    } else {
      drawRows(result.data);
      tableEl.classList.remove('d-none');
    }
    field('pageInfo').textContent =
      'Page ' + result.current_page + ' of ' + result.last_page + ' (' + result.total + ' events)';
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger');
  } finally {
    loadingEl.classList.add('d-none');
    field('prevBtn').disabled = currentPage <= 1;
    field('nextBtn').disabled = currentPage >= lastPage;
  }
}

function openForm(ev) {
  editingEvent = ev || null;
  form.reset();
  clearFieldErrors(form);
  hideAlert(formMessage);
  field('formTitle').textContent = ev ? 'Edit event' : 'New event';
  field('statusGroup').classList.toggle('d-none', !!ev); // when editing, use the Publish/Cancel buttons instead

  if (ev) {
    field('title').value = ev.title;
    field('category').value = ev.category;
    field('description').value = ev.description || '';
    field('venue_id').value = ev.venue_id;
    field('starts_at').value = toInputDate(ev.starts_at);
    field('ends_at').value = toInputDate(ev.ends_at);
    field('ticket_price').value = Number(ev.ticket_price);
    field('total_tickets').value = ev.total_tickets;
  }
  eventModal.show();
}

function readForm() {
  const price = field('ticket_price').value;
  const total = field('total_tickets').value;
  return {
    title: field('title').value.trim(),
    category: field('category').value.trim(),
    description: field('description').value.trim(),
    venue_id: Number(field('venue_id').value),
    starts_at: toApiDate(field('starts_at').value),
    ends_at: toApiDate(field('ends_at').value),
    ticket_price: price === '' ? '' : Number(price),
    total_tickets: total === '' ? '' : Number(total),
  };
}

// Browser-side validation, matching the API rules
function validate(d) {
  let ok = true;
  const fail = (f, msg) => { setFieldError(f, msg); ok = false; };

  if (!d.title) fail('title', 'Enter a title.');
  if (!d.category) fail('category', 'Enter a category.');
  if (!d.venue_id) fail('venue_id', 'Choose a venue.');
  if (!d.starts_at) fail('starts_at', 'Choose when the event starts.');
  else if (!editingEvent && new Date(field('starts_at').value) <= new Date()) fail('starts_at', 'The start must be in the future.');
  if (!d.ends_at) fail('ends_at', 'Choose when the event ends.');
  else if (d.starts_at && d.ends_at <= d.starts_at) fail('ends_at', 'The end must be after the start.');
  if (d.ticket_price === '' || d.ticket_price < 0) fail('ticket_price', 'Enter a price of 0 or more.');
  if (!Number.isInteger(d.total_tickets) || d.total_tickets < 1) {
    fail('total_tickets', 'Enter a whole number of at least 1.');
  } else {
    const venue = venues.find((v) => v.id === d.venue_id);
    if (venue && d.total_tickets > venue.capacity) fail('total_tickets', 'This venue only holds ' + venue.capacity + ' people.');
  }
  return ok;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  hideAlert(formMessage);

  const data = readForm();
  if (!validate(data)) return;

  let body = {};
  if (editingEvent) {
    // Only send the fields that actually changed
    const original = {
      title: editingEvent.title,
      category: editingEvent.category,
      description: editingEvent.description || '',
      venue_id: editingEvent.venue_id,
      starts_at: editingEvent.starts_at,
      ends_at: editingEvent.ends_at,
      ticket_price: Number(editingEvent.ticket_price),
      total_tickets: editingEvent.total_tickets,
    };
    for (const key in data) {
      if (data[key] !== original[key]) body[key] = data[key];
    }
    if (Object.keys(body).length === 0) {
      showAlert(formMessage, 'Nothing has changed yet.', 'info');
      return;
    }
  } else {
    body = data;
    if (!body.description) delete body.description;
    body.status = field('status').value;
  }

  setButtonLoading(saveBtn, true, 'Saving...');
  try {
    const result = editingEvent
      ? await apiRequest('PUT', '/events/' + editingEvent.id, body)
      : await apiRequest('POST', '/events', body);
    eventModal.hide();
    await loadEvents();
    showAlert(messageEl, result.message + ' "' + result.data.title + '"', 'success');
  } catch (err) {
    if (err.status === 422) {
      showFieldErrors(err.errors); // server messages under each field
      showAlert(formMessage, 'Please fix the highlighted fields.', 'danger');
    } else {
      showAlert(formMessage, friendlyError(err), 'danger'); // e.g. 409 venue already booked
    }
  } finally {
    setButtonLoading(saveBtn, false);
  }
});

rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const ev = pageEvents[button.dataset.id];
  const action = button.dataset.action;

  if (action === 'edit') { openForm(ev); return; }
  if (action === 'publish' && !confirm('Publish "' + ev.title + '"? Customers will be able to see and book it.')) return;
  if (action === 'cancel' && !confirm('Are you sure you want to cancel "' + ev.title + '"? Its confirmed bookings will be cancelled too. This cannot be undone.')) return;
  if (action === 'delete' && !confirm('Are you sure you want to delete "' + ev.title + '"? This cannot be undone.')) return;

  setButtonLoading(button, true, 'Working...');
  try {
    let result;
    if (action === 'publish') result = await apiRequest('PUT', '/events/' + ev.id, { status: 'published' });
    if (action === 'cancel') result = await apiRequest('PUT', '/events/' + ev.id, { status: 'cancelled' });
    if (action === 'delete') result = await apiRequest('DELETE', '/events/' + ev.id);
    await loadEvents();
    showAlert(messageEl, result.message, 'success');
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger'); // e.g. 409 "This event has bookings"
    setButtonLoading(button, false);
  }
});

field('newEventBtn').addEventListener('click', () => openForm(null));
field('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentPage = 1;
  loadEvents();
});
field('prevBtn').addEventListener('click', () => { currentPage--; loadEvents(); });
field('nextBtn').addEventListener('click', () => { currentPage++; loadEvents(); });

if (user) {
  renderNavbar();
  field('pageTitle').textContent = user.role === 'admin' ? 'All events' : 'My events';
  loadVenues();
  loadEvents();
}