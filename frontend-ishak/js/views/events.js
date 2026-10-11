// Events page: browse, search, filter, sort and page through events (GET /events).

import { get } from '../api.js';
import { hasRole } from '../session.js';
import { esc, dateParts, formatTime, parseDate, money, statusBadge, loadingHtml, emptyHtml, showError, renderPagination } from '../ui.js';

const SORTS = {
    'starts_at:asc': 'Date, soonest first',
    'starts_at:desc': 'Date, latest first',
    'ticket_price:asc': 'Price, low to high',
    'ticket_price:desc': 'Price, high to low',
    'title:asc': 'Title, A to Z',
};

export async function render(container) {
    const seesAllStatuses = hasRole('admin', 'organiser', 'staff');

    // What the user has typed or chosen. Changing any of it reloads the list.
    const filters = { search: '', category: '', date_from: '', date_to: '', available_only: false, status: '', sort: 'starts_at:asc', page: 1 };

    container.innerHTML = `
        <h1>Events</h1>
        <p class="lead-text">Find something to go to, then book your tickets.</p>

        <form class="filter-bar mb-3" id="event-filters" role="search" aria-label="Filter events">
            <div class="row g-2 align-items-end">
                <div class="col-12 col-lg-4">
                    <label class="form-label" for="f-search">Search</label>
                    <input class="form-control" id="f-search" name="search" type="search" placeholder="Title or description">
                </div>
                <div class="col-6 col-lg-2">
                    <label class="form-label" for="f-category">Category</label>
                    <select class="form-select" id="f-category" name="category"><option value="">All</option></select>
                </div>
                <div class="col-6 col-lg-2">
                    <label class="form-label" for="f-from">From</label>
                    <input class="form-control" id="f-from" name="date_from" type="date">
                </div>
                <div class="col-6 col-lg-2">
                    <label class="form-label" for="f-to">To</label>
                    <input class="form-control" id="f-to" name="date_to" type="date">
                </div>
                <div class="col-6 col-lg-2">
                    <label class="form-label" for="f-sort">Sort by</label>
                    <select class="form-select" id="f-sort" name="sort">
                        ${Object.entries(SORTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                    </select>
                </div>
                ${seesAllStatuses ? `
                <div class="col-6 col-lg-2">
                    <label class="form-label" for="f-status">Status</label>
                    <select class="form-select" id="f-status" name="status">
                        <option value="">All</option><option value="published">Published</option>
                        <option value="draft">Draft</option><option value="cancelled">Cancelled</option>
                    </select>
                </div>` : ''}
                <div class="col-auto">
                    <div class="form-check mb-2">
                        <input class="form-check-input" id="f-available" name="available_only" type="checkbox">
                        <label class="form-check-label" for="f-available">Only events with tickets left</label>
                    </div>
                </div>
                <div class="col-auto ms-auto">
                    <button class="btn btn-quiet" type="reset">Clear filters</button>
                </div>
            </div>
        </form>

        <div id="event-results" aria-live="polite"></div>
        <div class="mt-3" id="event-pages"></div>`;

    const form = container.querySelector('#event-filters');
    const results = container.querySelector('#event-results');
    const pages = container.querySelector('#event-pages');

    async function load() {
        results.innerHTML = loadingHtml('Loading events');
        pages.innerHTML = '';
        const [sort, direction] = filters.sort.split(':');
        try {
            const page = await get('/events', { ...filters, sort, direction, per_page: 6 });
            if (page.data.length === 0) {
                results.innerHTML = emptyHtml('No events match these filters', 'Try a different search, or clear the filters.');
                return;
            }
            results.innerHTML = `<ul class="event-list">${page.data.map(eventRow).join('')}</ul>`;
            renderPagination(pages, page, (number) => {
                filters.page = number;
                load();
            });
        } catch (error) {
            showError(results, error, load); // e.g. a 422 when "To" is before "From"
        }
    }

    function readFilters() {
        filters.search = form.elements.search.value.trim();
        filters.category = form.elements.category.value;
        filters.date_from = form.elements.date_from.value;
        filters.date_to = form.elements.date_to.value;
        filters.sort = form.elements.sort.value;
        filters.available_only = form.elements.available_only.checked;
        filters.status = form.elements.status ? form.elements.status.value : '';
        filters.page = 1;
        load();
    }

    // Reload when a filter changes. Typing in the search box waits until the user pauses.
    let typingTimer;
    form.addEventListener('input', (event) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(readFilters, event.target.name === 'search' ? 350 : 0);
    });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        readFilters();
    });
    form.addEventListener('reset', () => setTimeout(readFilters, 0));

    // Fill the category list from the events that exist.
    get('/events', { per_page: 100 }).then((page) => {
        const categories = [...new Set(page.data.map((event) => event.category))].sort();
        form.elements.category.insertAdjacentHTML('beforeend', categories.map((name) => `<option>${esc(name)}</option>`).join(''));
    }).catch(() => { /* the list still works without the category choices */ });

    await load();
}

/** One event as a row in the list. */
function eventRow(event) {
    const date = dateParts(event.starts_at);
    const ended = parseDate(event.ends_at) < new Date();
    const soldOut = event.available_tickets === 0;
    const sold = event.total_tickets - event.available_tickets;
    const percentSold = Math.round((sold / event.total_tickets) * 100);

    let availability = `${event.available_tickets} of ${event.total_tickets} tickets left`;
    if (event.status === 'cancelled') {
        availability = 'Event cancelled';
    } else if (ended) {
        availability = 'This event has ended';
    } else if (soldOut) {
        availability = 'Sold out';
    }

    return `
        <li class="event-row">
            <div class="event-date" aria-hidden="true">
                <span class="month">${date.month}</span><span class="day num">${date.day}</span><span class="year num">${date.year}</span>
            </div>
            <div>
                <h2 class="event-title"><a href="#/events/${event.id}">${esc(event.title)}</a></h2>
                <p class="event-meta">
                    ${esc(date.weekday)} ${date.day} ${date.month}, ${formatTime(event.starts_at)} at ${esc(event.venue.name)}, ${esc(event.venue.city)}
                </p>
                <p class="event-meta mb-0">${esc(event.category)} ${event.status !== 'published' ? statusBadge(event.status) : ''}</p>
            </div>
            <div class="event-side">
                <div class="event-price num">${money(event.ticket_price)}</div>
                <div class="seats num">${availability}</div>
                <div class="seats-bar" role="img" aria-label="${percentSold}% of tickets booked"><span style="width:${percentSold}%"></span></div>
            </div>
        </li>`;
}
