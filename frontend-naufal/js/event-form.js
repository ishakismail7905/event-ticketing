// js/event-form.js: create (POST /events) and edit (PUT /events/{id})
// Edit mode when the URL has ?id=, e.g. event-form.html?id=3

const user = requireRole(['organiser', 'admin']);

const eventId = new URLSearchParams(window.location.search).get('id');
const isEdit = Boolean(eventId);
const form = document.getElementById('eventForm');
const saveBtn = document.getElementById('saveBtn');
let venues = [];

// API uses "2027-06-15 20:00:00"; <input type="datetime-local"> uses "2027-06-15T20:00"
const apiToInput = (value) => value.slice(0, 16).replace(' ', 'T');
const inputToApi = (value) => value.replace('T', ' ') + ':00';

function nowForInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setFormDisabled(disabled) {
  form.querySelectorAll('input, select, textarea, button').forEach(el => (el.disabled = disabled));
}

// Total tickets can't exceed the chosen venue's capacity
function updateCapacity() {
  const venue = venues.find(v => v.id === Number(form.venue_id.value));
  form.total_tickets.max = venue ? venue.capacity : '';
  document.getElementById('capacityHint').textContent = venue ? `Venue capacity: ${venue.capacity}` : '';
}

async function init() {
  renderNavbar(user);
  renderFooter();
  document.getElementById('formTitle').textContent = isEdit ? 'Edit event' : 'New event';
  form.starts_at.min = nowForInput();   // start must be in the future
  setFormDisabled(true);                // until data has loaded

  try {
    // Venues for the dropdown
    const venueResult = await apiRequest('GET', '/venues?per_page=100&sort=name');
    venues = venueResult.data;
    form.venue_id.innerHTML = '<option value="">Choose a venue…</option>' + venues.map(v =>
      `<option value="${v.id}">${escapeHtml(v.name)}, ${escapeHtml(v.city)} (capacity ${v.capacity})</option>`
    ).join('');

    // Edit mode: load the event and fill the form
    if (isEdit) {
      const { data } = await apiRequest('GET', `/events/${eventId}`);
      if (data.status === 'cancelled') {
        showAlert('This event is cancelled and can no longer be edited.', 'warning');
        return;   // keep the form disabled
      }
      form.title.value = data.title;
      form.category.value = data.category;
      form.description.value = data.description || '';
      form.venue_id.value = data.venue_id;
      form.starts_at.value = apiToInput(data.starts_at);
      form.ends_at.value = apiToInput(data.ends_at);
      form.ticket_price.value = data.ticket_price;
      form.total_tickets.value = data.total_tickets;
      form.status.value = data.status;
    }

    setFormDisabled(false);
    updateCapacity();
  } catch (err) {
    showAlert(err.status === 404 ? 'Event not found.' : err.message);
  }
}

form.venue_id.addEventListener('change', updateCapacity);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  clearFieldErrors(form);

  // Custom browser rule: end must be after start
  const badEnd = form.starts_at.value && form.ends_at.value && form.ends_at.value <= form.starts_at.value;
  form.ends_at.setCustomValidity(badEnd ? 'End must be after the start.' : '');

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const payload = {
    title: form.title.value.trim(),
    category: form.category.value.trim(),
    description: form.description.value.trim(),
    venue_id: Number(form.venue_id.value),
    starts_at: inputToApi(form.starts_at.value),
    ends_at: inputToApi(form.ends_at.value),
    ticket_price: Number(form.ticket_price.value),
    total_tickets: Number(form.total_tickets.value),
    status: form.status.value,
  };

  setButtonLoading(saveBtn, true);
  try {
    const result = isEdit
      ? await apiRequest('PUT', `/events/${eventId}`, payload)
      : await apiRequest('POST', '/events', payload);
    // Show the success message on the list page after redirecting
    sessionStorage.setItem('flash', result.message || 'Event saved.');
    window.location.href = 'manage-events.html';
  } catch (err) {
    if (err.status === 422) showFieldErrors(err.errors);   // server validation
    showAlert(err.message);   // 409 e.g. "The venue is already booked for … at that time."
    setButtonLoading(saveBtn, false, 'Save event');
  }
});

if (user) init();