// js/index.js: public event list (GET /events)

const user = getUser();   // null for guests
renderNavbar(user);
renderFooter();

if (new URLSearchParams(window.location.search).has('denied')) {
  showAlert('Your role is not allowed to open that page.', 'warning');
}

// Current search settings, sent to the API as query parameters
const state = { page: 1, search: '', category: '', sort: 'starts_at', direction: 'asc' };

const listEl = document.getElementById('eventList');
const paginationEl = document.getElementById('pagination');
const infoEl = document.getElementById('resultInfo');
const filterForm = document.getElementById('filterForm');

async function loadEvents() {
  // Loading state
  listEl.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border"></div>
      <p class="mt-2 text-muted">Loading events…</p>
    </div>`;
  paginationEl.innerHTML = '';
  infoEl.textContent = '';

  // Build e.g. /events?page=1&per_page=3&sort=starts_at&direction=asc&search=jazz
  const params = new URLSearchParams({
    page: state.page,
    per_page: 3,
    sort: state.sort,
    direction: state.direction,
  });
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);

  try {
    const result = await apiRequest('GET', '/events?' + params);
    renderEvents(result.data);
    renderPagination(result);
    if (result.total) {
      infoEl.textContent = `Showing ${result.from}–${result.to} of ${result.total} events`;
    }
  } catch (err) {
    listEl.innerHTML = '';
    showAlert(err.message);   // error state
  }
}

function renderEvents(events) {
  // Empty state
  if (events.length === 0) {
    listEl.innerHTML = '<p class="text-center text-muted py-5">No events match your search.</p>';
    return;
  }

  listEl.innerHTML = events.map(event => {
    const soldOut = event.available_tickets === 0;
    // Staff, organisers and admins also see draft/cancelled events, so label them
    const statusBadge = event.status !== 'published'
      ? `<span class="badge bg-secondary ms-1">${escapeHtml(event.status)}</span>` : '';

    return `
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body d-flex flex-column">
            <div class="mb-2">
              <span class="badge bg-info text-dark">${escapeHtml(event.category)}</span>${statusBadge}
            </div>
            <h2 class="h5 card-title">${escapeHtml(event.title)}</h2>
            <p class="small text-muted mb-1"> ${formatDateTime(event.starts_at)}</p>
            <p class="small text-muted mb-3"> ${escapeHtml(event.venue.name)}, ${escapeHtml(event.venue.city)}</p>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <strong>${formatPrice(event.ticket_price)}</strong>
              <span class="small ${soldOut ? 'text-danger' : 'text-success'}">
                ${soldOut ? 'Sold out' : event.available_tickets + ' left'}
              </span>
            </div>
            <a href="event.html?id=${event.id}" class="btn btn-outline-primary btn-sm mt-3">View details</a>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderPagination({ current_page, last_page }) {
  if (last_page <= 1) return;   // no pagination needed for one page

  const item = (page, label, disabled = false, active = false) => `
    <li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
      <button class="page-link" data-page="${page}">${label}</button>
    </li>`;

  let html = item(current_page - 1, 'Previous', current_page === 1);
  for (let p = 1; p <= last_page; p++) {
    html += item(p, p, false, p === current_page);
  }
  html += item(current_page + 1, 'Next', current_page === last_page);
  paginationEl.innerHTML = html;
}

// Clicking a page number
paginationEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-page]');
  if (!button || button.parentElement.classList.contains('disabled')) return;
  state.page = Number(button.dataset.page);
  loadEvents();
});

// Submitting search / filter / sort
filterForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideAlert();
  const [sort, direction] = filterForm.sort.value.split(':');   // "ticket_price:desc"
  state.search = filterForm.search.value.trim();
  state.category = filterForm.category.value;
  state.sort = sort;
  state.direction = direction;
  state.page = 1;   // new search always starts on page 1
  loadEvents();
});

loadEvents();