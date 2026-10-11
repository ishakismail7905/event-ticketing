// Bookings page (GET /bookings). The API decides what each role sees:
// a customer gets their own bookings, an organiser gets bookings for their
// events, and staff and admins get every booking.

import { get } from '../api.js';
import { role } from '../session.js';
import { esc, formatDate, formatTime, money, statusBadge, loadingHtml, emptyHtml, showError, renderPagination } from '../ui.js';
import { allowedActions, cancelBooking, checkIn, deleteBooking } from '../booking-actions.js';

const SORTS = {
    'id:desc': 'Newest first',
    'id:asc': 'Oldest first',
    'total_price:desc': 'Total, high to low',
    'quantity:desc': 'Most tickets first',
};

export async function render(container) {
    const isCustomer = role() === 'customer';
    const filters = { search: '', status: '', sort: 'id:desc', page: 1 };

    container.innerHTML = `
        <h1>${isCustomer ? 'My bookings' : 'Bookings'}</h1>
        <p class="lead-text">${isCustomer
            ? 'Your tickets. Open one to show its QR code at the door.'
            : 'Find a booking by reference, customer or event, then check the customer in.'}</p>

        <form class="filter-bar mb-3" id="booking-filters" role="search" aria-label="Filter bookings">
            <div class="row g-2 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="b-search">Search</label>
                    <input class="form-control" id="b-search" name="search" type="search"
                           placeholder="${isCustomer ? 'Reference or event' : 'Reference, customer or event'}">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="b-status">Status</label>
                    <select class="form-select" id="b-status" name="status">
                        <option value="">All</option><option value="confirmed">Confirmed</option>
                        <option value="checked_in">Checked in</option><option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="b-sort">Sort by</label>
                    <select class="form-select" id="b-sort" name="sort">
                        ${Object.entries(SORTS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                    </select>
                </div>
            </div>
        </form>

        <div id="booking-results" aria-live="polite"></div>
        <div class="mt-3" id="booking-pages"></div>`;

    const form = container.querySelector('#booking-filters');
    const results = container.querySelector('#booking-results');
    const pages = container.querySelector('#booking-pages');
    let bookings = [];

    async function load() {
        results.innerHTML = loadingHtml('Loading bookings');
        pages.innerHTML = '';
        const [sort, direction] = filters.sort.split(':');
        try {
            const page = await get('/bookings', { ...filters, sort, direction, per_page: 8 });
            bookings = page.data;

            if (bookings.length === 0) {
                const filtered = filters.search || filters.status;
                results.innerHTML = filtered
                    ? emptyHtml('No bookings match these filters', 'Try a different search or status.')
                    : emptyHtml(
                        isCustomer ? 'You have no bookings yet' : 'There are no bookings yet',
                        isCustomer ? 'Pick an event and book your first tickets.' : '',
                        isCustomer ? '<a class="btn btn-brand" href="#/events">Browse events</a>' : '',
                    );
                return;
            }

            results.innerHTML = `
                <div class="table-wrap"><table class="table table-hover">
                    <thead><tr>
                        <th scope="col">Reference</th>
                        ${isCustomer ? '' : '<th scope="col">Customer</th>'}
                        <th scope="col">Event</th>
                        <th scope="col" class="text-end">Tickets</th>
                        <th scope="col" class="text-end">Total</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr></thead>
                    <tbody>${bookings.map((booking) => bookingRow(booking, isCustomer)).join('')}</tbody>
                </table></div>`;

            renderPagination(pages, page, (number) => {
                filters.page = number;
                load();
            });
        } catch (error) {
            showError(results, error, load);
        }
    }

    // One click handler for all the row buttons.
    results.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const booking = bookings.find((item) => item.id === Number(button.dataset.id));
        const action = { cancel: cancelBooking, 'check-in': checkIn, delete: deleteBooking }[button.dataset.action];
        if (await action(booking)) {
            load();
        }
    });

    let typingTimer;
    form.addEventListener('input', (event) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            filters.search = form.elements.search.value.trim();
            filters.status = form.elements.status.value;
            filters.sort = form.elements.sort.value;
            filters.page = 1;
            load();
        }, event.target.name === 'search' ? 350 : 0);
    });
    form.addEventListener('submit', (event) => event.preventDefault());

    await load();
}

function bookingRow(booking, isCustomer) {
    const can = allowedActions(booking);
    return `
        <tr>
            <td><a class="ticket-ref" href="#/bookings/${booking.id}">${esc(booking.booking_reference)}</a></td>
            ${isCustomer ? '' : `<td>${esc(booking.user.name)}<br><span class="text-secondary small">${esc(booking.user.email)}</span></td>`}
            <td>${esc(booking.event.title)}<br>
                <span class="text-secondary small">${formatDate(booking.event.starts_at)}, ${formatTime(booking.event.starts_at)}, ${esc(booking.event.venue.name)}</span></td>
            <td class="text-end num">${booking.quantity}</td>
            <td class="text-end num">${money(booking.total_price)}</td>
            <td>${statusBadge(booking.status)}</td>
            <td class="actions">
                <a class="btn btn-sm btn-quiet" href="#/bookings/${booking.id}">${isCustomer ? 'View ticket' : 'View'}</a>
                ${can.checkIn ? `<button type="button" class="btn btn-sm btn-brand" data-action="check-in" data-id="${booking.id}">Check in</button>` : ''}
                ${can.cancel ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="cancel" data-id="${booking.id}">Cancel</button>` : ''}
                ${can.remove ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${booking.id}">Delete</button>` : ''}
            </td>
        </tr>`;
}
