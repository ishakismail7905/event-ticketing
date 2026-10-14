// js/bookings.js - one bookings page for every logged-in role.
// The API decides WHICH bookings each role sees; this page decides WHICH BUTTONS to show.
// Author: Muhammad Anas (AM2512021976)

const user = requireRole([]); // any logged-in role; guests go to login
const isCustomer = user && user.role === 'customer';

let currentPage = 1;
let lastPage = 1;

const rowsEl = document.getElementById('rows');
const tableEl = document.getElementById('table');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const messageEl = document.getElementById('message');
const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));

const STATUS_BADGE = { confirmed: 'text-bg-primary', checked_in: 'text-bg-success', cancelled: 'text-bg-secondary' };
const STATUS_TEXT = { confirmed: 'Confirmed', checked_in: 'Checked in', cancelled: 'Cancelled' };

function actionButton(action, id, text, style) {
  return '<button type="button" class="btn btn-sm ' + style + ' ms-1" data-action="' + action +
    '" data-id="' + id + '">' + text + '</button>';
}

// Which buttons each role gets, based on the booking's status
function actionsFor(b) {
  const buttons = [];
  if (b.status !== 'cancelled') buttons.push(actionButton('qr', b.id, 'QR ticket', 'btn-outline-secondary'));
  if (b.status === 'confirmed' && !isCustomer) buttons.push(actionButton('checkin', b.id, 'Check in', 'btn-success'));
  if (b.status === 'confirmed') buttons.push(actionButton('cancel', b.id, 'Cancel', 'btn-outline-danger'));
  if (b.status === 'cancelled' && user.role === 'admin') buttons.push(actionButton('delete', b.id, 'Delete', 'btn-danger'));
  return buttons.join('') || '<span class="small text-secondary">No actions</span>';
}

function drawRows(bookings) {
  rowsEl.innerHTML = bookings.map((b) =>
    '<tr>' +
      '<td><code>' + esc(b.booking_reference) + '</code></td>' +
      '<td>' + esc(b.event.title) + '<div class="small text-secondary">' + formatDate(b.event.starts_at) + '</div></td>' +
      (isCustomer ? '' : '<td>' + esc(b.user.name) + '<div class="small text-secondary">' + esc(b.user.email) + '</div></td>') +
      '<td>' + b.quantity + '</td>' +
      '<td>' + formatPrice(b.total_price) + '</td>' +
      '<td><span class="badge ' + STATUS_BADGE[b.status] + '">' + STATUS_TEXT[b.status] + '</span></td>' +
      '<td class="text-end text-nowrap">' + actionsFor(b) + '</td>' +
    '</tr>'
  ).join('');
}

async function loadBookings() {
  const params = new URLSearchParams({ page: currentPage, per_page: 10 });
  const search = document.getElementById('search').value.trim();
  const status = document.getElementById('status').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  // loading state
  hideAlert(messageEl);
  emptyEl.classList.add('d-none');
  tableEl.classList.add('d-none');
  loadingEl.classList.remove('d-none');

  try {
    const result = await apiRequest('GET', '/bookings?' + params.toString());
    lastPage = result.last_page;
    if (result.data.length === 0) {
      emptyEl.classList.remove('d-none'); // empty state
    } else {
      drawRows(result.data);
      tableEl.classList.remove('d-none');
    }
    document.getElementById('pageInfo').textContent =
      'Page ' + result.current_page + ' of ' + result.last_page + ' (' + result.total + ' bookings)';
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger'); // error state
  } finally {
    loadingEl.classList.add('d-none');
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= lastPage;
  }
}

async function showQr(id) {
  const body = document.getElementById('qrBody');
  body.innerHTML = '<div class="spinner-border text-success my-4"></div><p class="text-secondary">Loading QR code...</p>';
  qrModal.show();
  try {
    const result = await apiRequest('GET', '/bookings/' + id + '/qr');
    const d = result.data;
    body.innerHTML =
      '<img src="' + esc(d.qr_code) + '" alt="QR code for booking ' + esc(d.booking_reference) +
        '" class="img-fluid mb-3" style="max-width:250px">' +
      '<p class="h5 mb-1"><code>' + esc(d.booking_reference) + '</code></p>' +
      '<p class="text-secondary mb-0">Show this code at the door.</p>';
  } catch (err) {
    const text = err.status === 502
      ? 'The QR code service is not responding right now. Please try again in a minute.'
      : friendlyError(err);
    body.innerHTML = '<div class="alert alert-danger mb-0">' + esc(text) + '</div>';
  }
}

// One click handler for every button in the table
rowsEl.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'qr') { showQr(id); return; }
  if (action === 'cancel' && !confirm('Are you sure you want to cancel this booking? The tickets will go back on sale.')) return;
  if (action === 'delete' && !confirm('Are you sure you want to permanently delete this cancelled booking?')) return;

  setButtonLoading(button, true, 'Working...');
  try {
    let result;
    if (action === 'checkin') result = await apiRequest('PUT', '/bookings/' + id, { status: 'checked_in' });
    if (action === 'cancel') result = await apiRequest('PUT', '/bookings/' + id, { status: 'cancelled' });
    if (action === 'delete') result = await apiRequest('DELETE', '/bookings/' + id);
    await loadBookings();
    showAlert(messageEl, result.message, 'success'); // e.g. "Customer checked in."
  } catch (err) {
    showAlert(messageEl, friendlyError(err), 'danger'); // e.g. 409 "already cancelled"
    setButtonLoading(button, false);
  }
});

document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentPage = 1;
  loadBookings();
});
document.getElementById('prevBtn').addEventListener('click', () => { currentPage--; loadBookings(); });
document.getElementById('nextBtn').addEventListener('click', () => { currentPage++; loadBookings(); });

if (user) {
  renderNavbar();
  if (isCustomer) {
    document.getElementById('pageTitle').textContent = 'My bookings';
    document.getElementById('customerCol').classList.add('d-none'); // customers don't need their own name on every row
  }
  loadBookings();
}