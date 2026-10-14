// js/index.js - public event list with search, sort and pagination.
// Author: Muhammad Anas (AM2512021976)

renderNavbar(); // no login needed: guests can browse events

let currentPage = 1;
let lastPage = 1;

const listEl = document.getElementById('eventList');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const messageEl = document.getElementById('message');

// Escape text from the API before putting it in HTML
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

function formatDate(s) {
  // API date format: "YYYY-MM-DD HH:MM:SS"
  return new Date(s.replace(' ', 'T')).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPrice(p) {
  return Number(p) === 0 ? 'Free' : 'RM ' + Number(p).toFixed(2);
}

function drawEvents(events) {
  listEl.innerHTML = events.map((e) => {
    const soldOut = e.available_tickets === 0;
        return '<div class="col-md-6"><div class="card h-100 event-card"><div class="card-body">' +
      '<span class="badge text-bg-success mb-2">' + esc(e.category) + '</span>' +
      (e.status !== 'published' ? ' <span class="badge text-bg-warning mb-2">' + esc(e.status) + '</span>' : '') +
            '<h2 class="h5"><a class="text-decoration-none stretched-link" href="event.html?id=' + e.id + '">' + esc(e.title) + '</a></h2>' +
      '<p class="mb-1 small text-secondary">' + formatDate(e.starts_at) + '</p>' +
      '<p class="mb-2 small">' + esc(e.venue.name) + ', ' + esc(e.venue.city) + '</p>' +
      '<p class="mb-0"><strong>' + formatPrice(e.ticket_price) + '</strong> &middot; ' +
      (soldOut ? '<span class="text-danger">Sold out</span>' : e.available_tickets + ' tickets left') + '</p>' +
      '</div></div></div>';
  }).join('');
}

async function loadEvents() {
  const params = new URLSearchParams({
    page: currentPage,
    per_page: 6,
    sort: document.getElementById('sort').value,
  });
  const search = document.getElementById('search').value.trim();
  if (search) params.set('search', search);

  // loading state
  messageEl.className = 'alert d-none';
  emptyEl.classList.add('d-none');
  listEl.innerHTML = '';
  loadingEl.classList.remove('d-none');

  try {
    const result = await apiRequest('GET', '/events?' + params.toString());
    lastPage = result.last_page;

    if (result.data.length === 0) {
      emptyEl.classList.remove('d-none'); // empty state
    } else {
      drawEvents(result.data);
    }
    document.getElementById('pageInfo').textContent =
      'Page ' + result.current_page + ' of ' + result.last_page + ' (' + result.total + ' events)';
  } catch (err) {
    // error state: show the API message on screen
    messageEl.textContent = err.message;
    messageEl.className = 'alert alert-danger';
  } finally {
    loadingEl.classList.add('d-none');
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= lastPage;
  }
}

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentPage = 1;
  loadEvents();
});
document.getElementById('prevBtn').addEventListener('click', () => { currentPage--; loadEvents(); });
document.getElementById('nextBtn').addEventListener('click', () => { currentPage++; loadEvents(); });

loadEvents();
