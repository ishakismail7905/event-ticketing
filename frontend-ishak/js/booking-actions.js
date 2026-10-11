// Actions on a booking, shared by the bookings list and the ticket page.
// Each one asks for confirmation, calls the API and reports the result.
// They return true when the booking changed, so the page knows to reload.

import { put, del } from './api.js';
import { role } from './session.js';
import { toast, confirmDialog, parseDate } from './ui.js';

/** Which buttons the current user may see for this booking. */
export function allowedActions(booking) {
    const myRole = role();
    const confirmed = booking.status === 'confirmed';
    const started = parseDate(booking.event.starts_at) < new Date();
    return {
        cancel: confirmed && (myRole !== 'customer' || !started),
        checkIn: confirmed && myRole !== 'customer',
        remove: myRole === 'admin' && booking.status === 'cancelled',
    };
}

export async function cancelBooking(booking) {
    const yes = await confirmDialog({
        title: 'Cancel this booking?',
        message: `Booking ${booking.booking_reference} for ${booking.event.title} will be cancelled and its ${booking.quantity} ticket(s) released. This cannot be undone.`,
        confirmLabel: 'Cancel booking',
    });
    if (!yes) {
        return false;
    }
    try {
        await put(`/bookings/${booking.id}`, { status: 'cancelled' });
        toast('Booking cancelled.');
        return true;
    } catch (error) {
        toast(error.message, 'danger'); // e.g. 409 "This event has already started..."
        return false;
    }
}

export async function checkIn(booking) {
    const yes = await confirmDialog({
        title: 'Check this customer in?',
        message: `${booking.user.name}, ${booking.quantity} ticket(s), booking ${booking.booking_reference}.`,
        confirmLabel: 'Check in',
        danger: false,
    });
    if (!yes) {
        return false;
    }
    try {
        await put(`/bookings/${booking.id}`, { status: 'checked_in' });
        toast('Customer checked in.');
        return true;
    } catch (error) {
        toast(error.message, 'danger'); // e.g. 409 "This booking is already checked in."
        return false;
    }
}

export async function deleteBooking(booking) {
    const yes = await confirmDialog({
        title: 'Delete this booking?',
        message: `The cancelled booking ${booking.booking_reference} will be removed permanently.`,
        confirmLabel: 'Delete booking',
    });
    if (!yes) {
        return false;
    }
    try {
        await del(`/bookings/${booking.id}`);
        toast('Booking deleted.');
        return true;
    } catch (error) {
        toast(error.message, 'danger');
        return false;
    }
}
