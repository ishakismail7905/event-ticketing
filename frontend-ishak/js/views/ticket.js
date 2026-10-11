// One booking shown as a ticket, with its QR code.
// GET /bookings/{id} loads the booking. GET /bookings/{id}/qr asks the backend for the
// QR image, which the backend gets from the goQR.me web API (the third-party API).

import { get } from '../api.js';
import { role } from '../session.js';
import { navigate } from '../router.js';
import { esc, formatDate, formatTime, money, statusBadge } from '../ui.js';
import { allowedActions, cancelBooking, checkIn, deleteBooking } from '../booking-actions.js';

export async function render(container, [id]) {
    const { data: booking } = await get(`/bookings/${id}`);
    const can = allowedActions(booking);
    const isVoid = booking.status === 'cancelled';
    const isCustomer = role() === 'customer';

    container.innerHTML = `
        <p><a href="#/bookings">Back to ${isCustomer ? 'my bookings' : 'bookings'}</a></p>
        <h1 class="visually-hidden">Ticket ${esc(booking.booking_reference)}</h1>

        <div class="row justify-content-center">
            <div class="col-xl-9">
                <div class="ticket-wrap">
                <article class="ticket ${isVoid ? 'is-void' : ''}">
                    <div class="ticket-main">
                        <p class="mb-2">${statusBadge(booking.status)}</p>
                        <p class="ticket-event">${esc(booking.event.title)}</p>
                        <p class="text-secondary mb-0">${esc(booking.event.venue.name)}, ${esc(booking.event.venue.city)}</p>
                        <dl class="ticket-facts">
                            <div><dt>Date</dt><dd>${formatDate(booking.event.starts_at)}</dd></div>
                            <div><dt>Doors</dt><dd class="num">${formatTime(booking.event.starts_at)}</dd></div>
                            <div><dt>Tickets</dt><dd class="num">${booking.quantity}</dd></div>
                            <div><dt>Total</dt><dd class="num">${money(booking.total_price)}</dd></div>
                            <div><dt>Booked by</dt><dd>${esc(booking.user.name)}</dd></div>
                            <div><dt>Booked on</dt><dd>${formatDate(booking.created_at)}</dd></div>
                        </dl>
                    </div>
                    <div class="ticket-stub">
                        <div class="ticket-qr" id="ticket-qr">
                            <div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading QR code</span></div>
                        </div>
                        <div class="ticket-ref num">${esc(booking.booking_reference)}</div>
                        <div class="small text-secondary" id="ticket-qr-note"></div>
                    </div>
                </article>
                </div>

                <div class="d-flex flex-wrap gap-2 mt-4">
                    ${can.checkIn ? '<button type="button" class="btn btn-brand" data-action="check-in">Check in</button>' : ''}
                    ${can.cancel ? '<button type="button" class="btn btn-outline-danger" data-action="cancel">Cancel booking</button>' : ''}
                    ${can.remove ? '<button type="button" class="btn btn-outline-danger" data-action="delete">Delete booking</button>' : ''}
                    <a class="btn btn-quiet" href="#/events/${booking.event.id}">View event</a>
                </div>
                ${isVoid ? '<p class="text-secondary mt-3 mb-0">This booking was cancelled, so the ticket is no longer valid.</p>' : ''}
            </div>
        </div>`;

    container.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (button.dataset.action === 'delete') {
                if (await deleteBooking(booking)) {
                    navigate('/bookings');
                }
                return;
            }
            const action = button.dataset.action === 'cancel' ? cancelBooking : checkIn;
            if (await action(booking)) {
                render(container, [id]); // draw the ticket again with its new status
            }
        });
    });

    loadQrCode(booking, container.querySelector('#ticket-qr'), container.querySelector('#ticket-qr-note'));
}

/** Load the QR image separately, so the ticket appears even if the QR service is slow or down. */
async function loadQrCode(booking, box, note) {
    try {
        const { data } = await get(`/bookings/${booking.id}/qr`);
        // data.qr_code is a PNG as a "data:image/png;base64,..." address, so it works directly as an image source.
        box.innerHTML = `<img src="${data.qr_code}" alt="QR code for booking ${esc(booking.booking_reference)}">`;
        note.textContent = 'Show this code at the door';
    } catch (error) {
        // 502 means the QR service did not answer. The reference number still identifies the ticket.
        box.innerHTML = '<span>QR code unavailable</span>';
        note.innerHTML = '<button type="button" class="btn btn-sm btn-quiet">Try again</button>';
        note.querySelector('button').addEventListener('click', () => {
            box.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading QR code</span></div>';
            note.textContent = '';
            loadQrCode(booking, box, note);
        });
    }
}
