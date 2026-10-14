// js/event.js: event details (GET /events/{id}) and booking (POST /bookings)

const user = getUser();
renderNavbar(user);
renderFooter();

const eventId = new URLSearchParams(window.location.search).get('id');
const detailsEl = document.getElementById('eventDetails');
const bookingEl = document.getElementById('bookingArea');

async function loadEvent() {
  if (!eventId) {
    showAlert('No event selected.');
    return;
  }

  detailsEl.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
  bookingEl.innerHTML = '';

  try {
    const result = await apiRequest('GET', `/events/${eventId}`);
    renderDetails(result.data);
    renderBookingArea(result.data);
  } catch (err) {
    detailsEl.innerHTML = '';
    // 404 also happens when a guest/customer opens a draft event
    showAlert(err.status === 404 ? 'This event does not exist or is not available.' : err.message);
  }
}

function renderDetails(event) {
  detailsEl.innerHTML = `
    <span class="badge bg-info text-dark">${escapeHtml(event.category)}</span>
    <span class="badge bg-secondary">${escapeHtml(event.status)}</span>
    <h1 class="h2 mt-2">${escapeHtml(event.title)}</h1>
    <p class="text-muted">by ${escapeHtml(event.organiser.name)}</p>
    <p>${escapeHtml(event.description || 'No description.')}</p>

    <ul class="list-group">
      <li class="list-group-item"><strong>Starts:</strong> ${formatDateTime(event.starts_at)}</li>
      <li class="list-group-item"><strong>Ends:</strong> ${formatDateTime(event.ends_at)}</li>
      <li class="list-group-item"><strong>Venue:</strong>
        ${escapeHtml(event.venue.name)}, ${escapeHtml(event.venue.address)}, ${escapeHtml(event.venue.city)}</li>
      <li class="list-group-item"><strong>Price:</strong> ${formatPrice(event.ticket_price)}</li>
      <li class="list-group-item"><strong>Tickets left:</strong>
        ${event.available_tickets} of ${event.total_tickets}</li>
    </ul>`;
}

// What the right-hand box shows depends on who is looking
function renderBookingArea(event) {
  if (!user) {
    bookingEl.innerHTML = `
      <div class="card card-body">
        <p class="mb-2">Log in as a customer to book tickets.</p>
        <a href="login.html" class="btn btn-primary">Log in</a>
        <a href="register.html" class="btn btn-link">Create an account</a>
      </div>`;
    return;
  }

  if (user.role !== 'customer') {
    bookingEl.innerHTML = `<div class="card card-body text-muted">
      Only customer accounts can book tickets. You are logged in as ${escapeHtml(user.role)}.</div>`;
    return;
  }

  if (event.status !== 'published' || event.available_tickets === 0) {
    bookingEl.innerHTML = `<div class="card card-body text-danger">
      ${event.available_tickets === 0 ? 'This event is sold out.' : 'Booking is closed for this event.'}</div>`;
    return;
  }

  // Customer booking form
  const maxQty = Math.min(10, event.available_tickets);   // API allows 1–10 per booking
  bookingEl.innerHTML = `
    <form id="bookingForm" class="card card-body shadow-sm" novalidate>
      <h2 class="h5">Book tickets</h2>
      <label for="quantity" class="form-label">Quantity (max ${maxQty})</label>
      <input type="number" id="quantity" name="quantity" class="form-control"
             min="1" max="${maxQty}" value="1" required>
      <div class="invalid-feedback" id="quantity-error">Choose between 1 and ${maxQty} tickets.</div>
      <p class="mt-3 mb-3">Total: <strong id="totalPrice"></strong></p>
      <button type="submit" id="bookBtn" class="btn btn-success">Confirm booking</button>
    </form>`;

  const form = document.getElementById('bookingForm');
  const totalEl = document.getElementById('totalPrice');
  const bookBtn = document.getElementById('bookBtn');

  // Live total. The server calculates the real total; this is just a preview.
  const updateTotal = () => {
    const qty = Number(form.quantity.value) || 0;
    totalEl.textContent = formatPrice(qty * Number(event.ticket_price));
  };
  form.quantity.addEventListener('input', updateTotal);
  updateTotal();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    clearFieldErrors(form);

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    if (!confirm(`Book ${form.quantity.value} ticket(s) for ${event.title}?`)) return;

    setButtonLoading(bookBtn, true);
    try {
      const result = await apiRequest('POST', '/bookings', {
        event_id: event.id,
        quantity: Number(form.quantity.value),
      });
      const b = result.data;
      hideAlert();
      // Replace the form with a ticket-style confirmation
      bookingEl.innerHTML = `
        <div class="card card-body text-center ticket-card">
          <h2 class="h5 text-success mb-1">Booking confirmed! </h2>
          <div id="newQr" class="my-3"><div class="spinner-border"></div></div>
          <p class="mb-1"><code>${escapeHtml(b.booking_reference)}</code></p>
          <p class="mb-3">${b.quantity} ticket(s) · ${formatPrice(b.total_price)}</p>
          <a href="bookings.html" class="btn btn-primary btn-sm">View my bookings</a>
        </div>`;
      refreshDetails();     // update "tickets left"
      showBookingQr(b.id);  // fetch the QR automatically
    } catch (err) {
      if (err.status === 422) showFieldErrors(err.errors);
      showAlert(err.message);   // e.g. 409 "Only 3 tickets are left for this event."
      setButtonLoading(bookBtn, false, 'Confirm booking');
    }
  });
}

// Reload only the details panel (keeps the confirmation card visible)
async function refreshDetails() {
  try {
    const result = await apiRequest('GET', `/events/${eventId}`);
    renderDetails(result.data);
  } catch {
    // details stay as they were
  }
}

// Show the new booking's QR code (backend calls the goQR.me API)
async function showBookingQr(bookingId) {
  const box = document.getElementById('newQr');
  try {
    const { data } = await apiRequest('GET', `/bookings/${bookingId}/qr`);
    box.innerHTML = `<img src="${data.qr_code}" alt="QR ticket" class="img-fluid" style="max-width: 180px;">`;
  } catch (err) {
    box.innerHTML = `<p class="small text-danger mb-0">QR not available right now (${escapeHtml(err.message)}).
      You can open it later from My bookings.</p>`;
  }
}

loadEvent();