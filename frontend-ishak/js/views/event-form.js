// Create or edit an event (POST /events, PUT /events/{id}).
// The same form is used for both. The address decides which one it is.

import { get, post, put } from '../api.js';
import { role } from '../session.js';
import { navigate } from '../router.js';
import { esc, toInputValue, toast, setBusy, formValues, showFormErrors, clearFormErrors, browserValidate, emptyHtml } from '../ui.js';

export async function render(container, [id]) {
    const isEdit = Boolean(id);
    const isAdmin = role() === 'admin';

    // Load everything the form needs at the same time.
    const [venuesPage, eventReply, organisersPage] = await Promise.all([
        get('/venues', { per_page: 100, sort: 'name' }),
        isEdit ? get(`/events/${id}`) : null,
        isAdmin && !isEdit ? get('/users', { role: 'organiser', per_page: 100, sort: 'name' }) : null,
    ]);
    const venues = venuesPage.data;
    const event = eventReply ? eventReply.data : null;

    if (event && event.status === 'cancelled') {
        container.innerHTML = emptyHtml('This event is cancelled', 'A cancelled event cannot be changed.', '<a class="btn btn-brand" href="#/manage/events">Back to manage events</a>');
        return;
    }
    if (venues.length === 0) {
        container.innerHTML = emptyHtml('Add a venue first', 'An event needs a venue to take place in.', '<a class="btn btn-brand" href="#/manage/venues">Go to venues</a>');
        return;
    }

    const value = (field, fallback = '') => esc(event ? event[field] ?? fallback : fallback);

    container.innerHTML = `
        <p><a href="#/manage/events">Back to manage events</a></p>
        <h1>${isEdit ? 'Edit event' : 'New event'}</h1>
        <form class="panel" id="event-form" novalidate style="max-width: 46rem">
            <div class="alert alert-danger" role="alert" data-form-error hidden></div>
            <div class="row g-3">
                <div class="col-12">
                    <label class="form-label" for="e-title">Title</label>
                    <input class="form-control" id="e-title" name="title" maxlength="150" value="${value('title')}" required>
                    <div class="invalid-feedback">Give the event a title.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label" for="e-category">Category</label>
                    <input class="form-control" id="e-category" name="category" maxlength="50" list="category-ideas" value="${value('category')}" required>
                    <datalist id="category-ideas">
                        <option>Music</option><option>Conference</option><option>Theatre</option>
                        <option>Festival</option><option>Workshop</option><option>Comedy</option><option>Sports</option>
                    </datalist>
                    <div class="invalid-feedback">Choose or type a category.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label" for="e-venue">Venue</label>
                    <select class="form-select" id="e-venue" name="venue_id" required>
                        <option value="">Choose a venue</option>
                        ${venues.map((venue) => `
                            <option value="${venue.id}" data-capacity="${venue.capacity}" ${event && event.venue_id === venue.id ? 'selected' : ''}>
                                ${esc(venue.name)}, ${esc(venue.city)} (holds ${venue.capacity})
                            </option>`).join('')}
                    </select>
                    <div class="invalid-feedback">Choose a venue.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label" for="e-starts">Starts</label>
                    <input class="form-control" id="e-starts" name="starts_at" type="datetime-local" value="${toInputValue(event && event.starts_at)}" required>
                    <div class="invalid-feedback">Choose a start date and time.</div>
                </div>
                <div class="col-md-6">
                    <label class="form-label" for="e-ends">Ends</label>
                    <input class="form-control" id="e-ends" name="ends_at" type="datetime-local" value="${toInputValue(event && event.ends_at)}" required>
                    <div class="invalid-feedback">The end must be after the start.</div>
                </div>
                <div class="col-md-4">
                    <label class="form-label" for="e-price">Ticket price (RM)</label>
                    <input class="form-control" id="e-price" name="ticket_price" type="number" min="0" max="999999.99" step="0.01" value="${value('ticket_price', '0.00')}" required>
                    <div class="form-text">Use 0 for a free event.</div>
                    <div class="invalid-feedback">Enter a price of 0 or more.</div>
                </div>
                <div class="col-md-4">
                    <label class="form-label" for="e-total">Total tickets</label>
                    <input class="form-control" id="e-total" name="total_tickets" type="number" min="1" step="1" value="${value('total_tickets')}" required>
                    <div class="form-text" id="capacity-hint"></div>
                    <div class="invalid-feedback">Enter a number from 1 up to the venue's capacity.</div>
                </div>
                <div class="col-md-4">
                    <label class="form-label" for="e-status">Status</label>
                    <select class="form-select" id="e-status" name="status">
                        <option value="draft" ${event && event.status === 'draft' ? 'selected' : ''}>Draft (hidden from customers)</option>
                        <option value="published" ${event && event.status === 'published' ? 'selected' : ''}>Published (open for booking)</option>
                    </select>
                </div>
                ${organisersPage ? `
                <div class="col-md-6">
                    <label class="form-label" for="e-organiser">Organiser</label>
                    <select class="form-select" id="e-organiser" name="organiser_id">
                        <option value="">Me</option>
                        ${organisersPage.data.map((user) => `<option value="${user.id}">${esc(user.name)}</option>`).join('')}
                    </select>
                    <div class="form-text">As an admin you can create an event for an organiser.</div>
                </div>` : ''}
                <div class="col-12">
                    <label class="form-label" for="e-description">Description <span class="text-secondary fw-normal">(optional)</span></label>
                    <textarea class="form-control" id="e-description" name="description" rows="4" maxlength="5000">${value('description')}</textarea>
                </div>
            </div>
            <div class="d-flex gap-2 mt-4">
                <button class="btn btn-brand" type="submit">${isEdit ? 'Save changes' : 'Create event'}</button>
                <a class="btn btn-quiet" href="#/manage/events">Discard</a>
            </div>
        </form>`;

    const form = container.querySelector('#event-form');
    const fields = form.elements;

    // Client-side rule: tickets cannot be more than the chosen venue holds.
    function updateCapacity() {
        const option = fields.venue_id.selectedOptions[0];
        const capacity = option && option.dataset.capacity;
        if (capacity) {
            fields.total_tickets.max = capacity;
            form.querySelector('#capacity-hint').textContent = `This venue holds ${capacity}.`;
        } else {
            fields.total_tickets.removeAttribute('max');
            form.querySelector('#capacity-hint').textContent = '';
        }
    }
    fields.venue_id.addEventListener('change', updateCapacity);
    updateCapacity();

    // Client-side rule: the end must be after the start.
    function checkDates() {
        const bad = fields.starts_at.value && fields.ends_at.value && fields.ends_at.value <= fields.starts_at.value;
        fields.ends_at.setCustomValidity(bad ? 'The end must be after the start.' : '');
    }
    fields.starts_at.addEventListener('input', checkDates);
    fields.ends_at.addEventListener('input', checkDates);

    form.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        clearFormErrors(form);
        checkDates();
        if (!browserValidate(form)) {
            return;
        }

        const data = formValues(form);
        data.venue_id = Number(data.venue_id);
        data.ticket_price = Number(data.ticket_price);
        data.total_tickets = Number(data.total_tickets);
        if (data.organiser_id) {
            data.organiser_id = Number(data.organiser_id);
        } else {
            delete data.organiser_id;
        }

        const done = setBusy(form.querySelector('[type="submit"]'), 'Saving');
        try {
            if (isEdit) {
                await put(`/events/${id}`, data);
                toast('Event saved.');
            } else {
                await post('/events', data);
                toast('Event created.');
            }
            navigate('/manage/events');
        } catch (error) {
            done();
            // 422 shows under the field. 409 (schedule clash, tickets already booked) shows at the top.
            showFormErrors(form, error);
        }
    });
}
