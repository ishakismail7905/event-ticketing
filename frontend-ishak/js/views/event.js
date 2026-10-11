// One event, with the booking form for customers (GET /events/{id}, POST /bookings).

import { get, post } from '../api.js';
import { getUser, role } from '../session.js';
import { navigate } from '../router.js';
import { esc, formatDate, formatTime, parseDate, money, statusBadge, toast, setBusy, showFormErrors, clearFormErrors } from '../ui.js';

export async function render(container, [id]) {
    const { data: event } = await get(`/events/${id}`);

    const ended = parseDate(event.ends_at) < new Date();
    const started = parseDate(event.starts_at) < new Date();
    const myRole = role();
    const user = getUser();
    const canManage = myRole === 'admin' || (myRole === 'organiser' && user.id === event.organiser_id);

    container.innerHTML = `
        <p><a href="#/events">Back to all events</a></p>
        <div class="row g-4">
            <div class="col-lg-7">
                <p class="mb-1">${esc(event.category)} ${event.status !== 'published' ? statusBadge(event.status) : ''}</p>
                <h1>${esc(event.title)}</h1>
                <p class="lead-text">${esc(event.description || 'No description yet.')}</p>
                <dl class="ticket-facts panel">
                    <div><dt>Date</dt><dd>${formatDate(event.starts_at)}</dd></div>
                    <div><dt>Time</dt><dd class="num">${formatTime(event.starts_at)} to ${formatTime(event.ends_at)}</dd></div>
                    <div><dt>Venue</dt><dd>${esc(event.venue.name)}</dd></div>
                    <div><dt>Address</dt><dd>${esc(event.venue.address)}, ${esc(event.venue.city)}</dd></div>
                    <div><dt>Organised by</dt><dd>${esc(event.organiser.name)}</dd></div>
                    <div><dt>Tickets left</dt><dd class="num">${event.available_tickets} of ${event.total_tickets}</dd></div>
                </dl>
                ${canManage ? `<p class="mt-3"><a class="btn btn-quiet" href="#/manage/events/${event.id}/edit">Edit this event</a></p>` : ''}
            </div>
            <div class="col-lg-5"><div class="panel" id="booking-panel"></div></div>
        </div>`;

    const panel = container.querySelector('#booking-panel');
    const price = `<p class="h2 num mb-1">${money(event.ticket_price)}</p><p class="text-secondary">per ticket</p>`;

    // Decide what the booking panel says. Only a customer sees the form.
    if (event.status === 'cancelled') {
        panel.innerHTML = `${price}<div class="alert alert-secondary mb-0">This event has been cancelled, so tickets are no longer on sale.</div>`;
        return;
    }
    if (event.status === 'draft') {
        panel.innerHTML = `${price}<div class="alert alert-secondary mb-0">This event is a draft. Publish it to open bookings.</div>`;
        return;
    }
    if (ended || started) {
        panel.innerHTML = `${price}<div class="alert alert-secondary mb-0">${ended ? 'This event has ended.' : 'This event has already started.'} Bookings are closed.</div>`;
        return;
    }
    if (event.available_tickets === 0) {
        panel.innerHTML = `${price}<div class="alert alert-warning mb-0">Sold out. Check back later in case someone cancels.</div>`;
        return;
    }
    if (myRole === 'guest') {
        sessionStorage.setItem('eventhub.after-login', `/events/${event.id}`);
        panel.innerHTML = `${price}
            <a class="btn btn-brand w-100" href="#/login">Log in to book</a>
            <p class="small mt-3 mb-0">New here? <a href="#/register">Create a customer account</a></p>`;
        return;
    }
    if (myRole !== 'customer') {
        panel.innerHTML = `${price}<div class="alert alert-secondary mb-0">Only customer accounts can book tickets.</div>`;
        return;
    }

    const most = Math.min(10, event.available_tickets);
    panel.innerHTML = `
        ${price}
        <form id="booking-form" novalidate>
            <div class="alert alert-danger" role="alert" data-form-error hidden></div>
            <div class="mb-3">
                <label class="form-label" for="quantity">Number of tickets</label>
                <select class="form-select" id="quantity" name="quantity">
                    ${Array.from({ length: most }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
                <div class="form-text">Up to 10 tickets per booking.</div>
            </div>
            <p class="d-flex justify-content-between fw-bold"><span>Total</span><span class="num" id="booking-total"></span></p>
            <button class="btn btn-brand w-100" type="submit">Book tickets</button>
        </form>`;

    const form = panel.querySelector('#booking-form');
    const total = panel.querySelector('#booking-total');
    const showTotal = () => {
        total.textContent = money(Number(event.ticket_price) * Number(form.elements.quantity.value));
    };
    form.elements.quantity.addEventListener('change', showTotal);
    showTotal();

    form.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        clearFormErrors(form);
        const done = setBusy(form.querySelector('[type="submit"]'), 'Booking');
        try {
            const reply = await post('/bookings', { event_id: event.id, quantity: Number(form.elements.quantity.value) });
            toast('Booking confirmed.');
            navigate(`/bookings/${reply.data.id}`);
        } catch (error) {
            done();
            showFormErrors(form, error); // e.g. 409 "Only 2 tickets are left for this event."
        }
    });
}
