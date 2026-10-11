// Manage events page for organisers and admins.
// An organiser sees only their own events. An admin sees every event.
// Uses GET /events, PUT /events/{id} (publish, cancel) and DELETE /events/{id}.

import { get, put, del } from '../api.js';
import { getUser, role } from '../session.js';
import { esc, formatDate, formatTime, money, statusBadge, toast, confirmDialog, loadingHtml, emptyHtml, showError, renderPagination } from '../ui.js';

export async function render(container) {
    const isAdmin = role() === 'admin';
    const filters = { search: '', status: '', sort: 'starts_at:asc', page: 1 };

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
                <h1>Manage events</h1>
                <p class="lead-text">${isAdmin ? 'Every event in the system.' : 'The events you organise.'} Publish an event to open it for booking.</p>
            </div>
            <a class="btn btn-brand" href="#/manage/events/new">New event</a>
        </div>

        <form class="filter-bar mb-3" id="manage-filters" role="search" aria-label="Filter events">
            <div class="row g-2 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="m-search">Search</label>
                    <input class="form-control" id="m-search" name="search" type="search" placeholder="Title or description">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="m-status">Status</label>
                    <select class="form-select" id="m-status" name="status">
                        <option value="">All</option><option value="draft">Draft</option>
                        <option value="published">Published</option><option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="m-sort">Sort by</label>
                    <select class="form-select" id="m-sort" name="sort">
                        <option value="starts_at:asc">Date, soonest first</option>
                        <option value="starts_at:desc">Date, latest first</option>
                        <option value="title:asc">Title, A to Z</option>
                        <option value="created_at:desc">Recently created</option>
                    </select>
                </div>
            </div>
        </form>

        <div id="manage-results" aria-live="polite"></div>
        <div class="mt-3" id="manage-pages"></div>`;

    const form = container.querySelector('#manage-filters');
    const results = container.querySelector('#manage-results');
    const pages = container.querySelector('#manage-pages');
    let events = [];

    async function load() {
        results.innerHTML = loadingHtml('Loading events');
        pages.innerHTML = '';
        const [sort, direction] = filters.sort.split(':');
        try {
            const page = await get('/events', {
                ...filters, sort, direction, per_page: 8,
                organiser_id: isAdmin ? '' : getUser().id, // organisers only manage their own events
            });
            events = page.data;

            if (events.length === 0) {
                results.innerHTML = filters.search || filters.status
                    ? emptyHtml('No events match these filters', 'Try a different search or status.')
                    : emptyHtml('No events yet', 'Create your first event, then publish it.', '<a class="btn btn-brand" href="#/manage/events/new">New event</a>');
                return;
            }

            results.innerHTML = `
                <div class="table-wrap"><table class="table table-hover">
                    <thead><tr>
                        <th scope="col">Event</th>
                        <th scope="col">When and where</th>
                        ${isAdmin ? '<th scope="col">Organiser</th>' : ''}
                        <th scope="col" class="text-end">Price</th>
                        <th scope="col" class="text-end">Booked</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr></thead>
                    <tbody>${events.map((event) => eventRow(event, isAdmin)).join('')}</tbody>
                </table></div>`;

            renderPagination(pages, page, (number) => {
                filters.page = number;
                load();
            });
        } catch (error) {
            showError(results, error, load);
        }
    }

    results.addEventListener('click', async (clickEvent) => {
        const button = clickEvent.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const event = events.find((item) => item.id === Number(button.dataset.id));
        const changed = await { publish, cancel: cancelEvent, delete: deleteEvent }[button.dataset.action](event);
        if (changed) {
            load();
        }
    });

    let typingTimer;
    form.addEventListener('input', (inputEvent) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            filters.search = form.elements.search.value.trim();
            filters.status = form.elements.status.value;
            filters.sort = form.elements.sort.value;
            filters.page = 1;
            load();
        }, inputEvent.target.name === 'search' ? 350 : 0);
    });
    form.addEventListener('submit', (submitEvent) => submitEvent.preventDefault());

    await load();
}

function eventRow(event, isAdmin) {
    const booked = event.total_tickets - event.available_tickets;
    const editable = event.status !== 'cancelled';
    return `
        <tr>
            <td><a class="fw-bold" href="#/events/${event.id}">${esc(event.title)}</a><br><span class="text-secondary small">${esc(event.category)}</span></td>
            <td>${formatDate(event.starts_at)}, ${formatTime(event.starts_at)}<br><span class="text-secondary small">${esc(event.venue.name)}, ${esc(event.venue.city)}</span></td>
            ${isAdmin ? `<td>${esc(event.organiser.name)}</td>` : ''}
            <td class="text-end num">${money(event.ticket_price)}</td>
            <td class="text-end num">${booked} of ${event.total_tickets}</td>
            <td>${statusBadge(event.status)}</td>
            <td class="actions">
                ${event.status === 'draft' ? `<button type="button" class="btn btn-sm btn-brand" data-action="publish" data-id="${event.id}">Publish</button>` : ''}
                ${editable ? `<a class="btn btn-sm btn-quiet" href="#/manage/events/${event.id}/edit">Edit</a>` : ''}
                ${editable ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="cancel" data-id="${event.id}">Cancel event</button>` : ''}
                <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${event.id}">Delete</button>
            </td>
        </tr>`;
}

async function publish(event) {
    try {
        await put(`/events/${event.id}`, { status: 'published' });
        toast(`"${event.title}" is published.`);
        return true;
    } catch (error) {
        toast(error.message, 'danger');
        return false;
    }
}

async function cancelEvent(event) {
    const booked = event.total_tickets - event.available_tickets;
    const yes = await confirmDialog({
        title: 'Cancel this event?',
        message: `"${event.title}" will be cancelled${booked ? ` and its confirmed bookings will be cancelled too` : ''}. A cancelled event cannot be reopened.`,
        confirmLabel: 'Cancel event',
    });
    if (!yes) {
        return false;
    }
    try {
        await put(`/events/${event.id}`, { status: 'cancelled' });
        toast('Event cancelled.');
        return true;
    } catch (error) {
        toast(error.message, 'danger');
        return false;
    }
}

async function deleteEvent(event) {
    const yes = await confirmDialog({
        title: 'Delete this event?',
        message: `"${event.title}" will be removed permanently. Events that have bookings cannot be deleted.`,
        confirmLabel: 'Delete event',
    });
    if (!yes) {
        return false;
    }
    try {
        await del(`/events/${event.id}`);
        toast('Event deleted.');
        return true;
    } catch (error) {
        toast(error.message, 'danger'); // 409 "This event has bookings. Cancel the event instead of deleting it."
        return false;
    }
}
