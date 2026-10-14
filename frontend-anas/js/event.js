// js/event.js - event details page and the customer booking form.
// Author: Muhammad Anas (AM2512021976)

renderNavbar();

const user = getUser();
const eventId = new URLSearchParams(window.location.search).get('id');
let currentEvent = null;

const messageEl = document.getElementById('message');
const bookForm = document.getElementById('bookForm');
const quantityEl = document.getElementById('quantity');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'alert alert-' + type + ' mt-3';
}

function formatDate(s) {
  return new Date(s.replace(' ', 'T')).toLocaleString('en-MY', { dateStyle: 'full', timeStyle: 'short' });
}

function formatPrice(p) {
  return Number(p) === 0 ? 'Free' : 'RM ' + Number(p).toFixed(2);
}

function updateTotal() {
  const qty = Number(quantityEl.value) || 0;
  document.getElementById('total').textContent = formatPrice(qty * Number(currentEvent.ticket_price));
}

function drawEvent(e) {
  currentEvent = e;
  // textContent is used so text from the API can never run as HTML
  document.getElementById('category').textContent = e.category;
  document.getElementById('title').textContent = e.title;
  document.getElementById('description').textContent = e.description;
  document.getElementById('when').textContent = formatDate(e.starts_at) + ' to ' + formatDate(e.ends_at);
  document.getElementById('venue').textContent = e.venue.name + ', ' + (e.venue.address || '') + ' ' + e.venue.city;
  document.getElementById('organiser').textContent = e.organiser.name;
  document.getElementById('price').textContent = formatPrice(e.ticket_price);
  document.getElementById('tickets').textContent = e.available_tickets + ' of ' + e.total_tickets;

  const notice = document.getElementById('bookNotice');
  if (!user) {
    notice.innerHTML = 'Please <a href="login.html">log in</a> as a customer to book tickets.';
    notice.classList.remove('d-none');
  } else if (user.role !== 'customer') {
    notice.textContent = 'Only customers can book tickets. You are logged in as ' + user.role + '.';
    notice.classList.remove('d-none');
  } else if (e.available_tickets === 0) {
    notice.textContent = 'This event is sold out.';
    notice.classList.remove('d-none');
  } else {
    bookForm.classList.remove('d-none');
    updateTotal();
  }
}

async function loadEvent() {
  if (!eventId) {
    document.getElementById('loading').classList.add('d-none');
    showMessage('No event selected.', 'danger');
    return;
  }
  try {
    const result = await apiRequest('GET', '/events/' + encodeURIComponent(eventId));
    drawEvent(result.data);
    document.getElementById('eventBox').classList.remove('d-none');
  } catch (err) {
    showMessage(err.status === 404 ? 'Event not found.' : err.message, 'danger');
  } finally {
    document.getElementById('loading').classList.add('d-none');
  }
}

quantityEl.addEventListener('input', () => { if (currentEvent) updateTotal(); });

bookForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  messageEl.className = 'alert d-none';
  quantityEl.classList.remove('is-invalid');

  // Browser-side validation
  const qty = Number(quantityEl.value);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    quantityEl.classList.add('is-invalid');
    document.getElementById('quantityError').textContent = 'Enter a whole number from 1 to 10.';
    return;
  }
  if (!confirm('Book ' + qty + ' ticket(s) for ' + currentEvent.title + '?')) return;

  const btn = document.getElementById('bookBtn');
  btn.disabled = true;
  document.getElementById('spinner').classList.remove('d-none');
  try {
    const result = await apiRequest('POST', '/bookings', { event_id: currentEvent.id, quantity: qty });
    showMessage('Booking confirmed! Reference: ' + result.data.booking_reference, 'success');
    loadEventQuietly();
  } catch (err) {
    if (err.status === 401) {
      window.location.href = 'login.html'; // token expired
      return;
    }
    if (err.status === 422 && err.errors.quantity) {
      quantityEl.classList.add('is-invalid');
      document.getElementById('quantityError').textContent = err.errors.quantity[0];
    }
    // 403 and 409 messages come straight from the API (for example "Only 3 tickets are left")
    showMessage(err.status === 403 ? 'You are not allowed to book tickets. ' + err.message : err.message, 'danger');
  } finally {
    btn.disabled = false;
    document.getElementById('spinner').classList.add('d-none');
  }
});

// Refresh the tickets-left number after a booking without hiding the page
async function loadEventQuietly() {
  try {
    const result = await apiRequest('GET', '/events/' + encodeURIComponent(eventId));
    document.getElementById('tickets').textContent =
      result.data.available_tickets + ' of ' + result.data.total_tickets;
    currentEvent = result.data;
  } catch { /* the success message is already shown, so ignore this */ }
}

loadEvent();
