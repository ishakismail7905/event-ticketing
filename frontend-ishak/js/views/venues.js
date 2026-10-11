// Venues page for organisers and admins.
// GET /venues lists them, POST and PUT save the form, and DELETE (admin only) removes one.

import { get, post, put, del } from '../api.js';
import { role } from '../session.js';
import { esc, toast, confirmDialog, openModal, closeModal, setBusy, formValues, showFormErrors, clearFormErrors, browserValidate,
    loadingHtml, emptyHtml, showError, renderPagination } from '../ui.js';

export async function render(container) {
    const isAdmin = role() === 'admin';
    const filters = { search: '', min_capacity: '', sort: 'name:asc', page: 1 };

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
                <h1>Venues</h1>
                <p class="lead-text">The places where events are held. An event cannot sell more tickets than its venue holds.</p>
            </div>
            <button type="button" class="btn btn-brand" id="new-venue">New venue</button>
        </div>

        <form class="filter-bar mb-3" id="venue-filters" role="search" aria-label="Filter venues">
            <div class="row g-2 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="v-search">Search</label>
                    <input class="form-control" id="v-search" name="search" type="search" placeholder="Name, address or city">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="v-min">Holds at least</label>
                    <input class="form-control" id="v-min" name="min_capacity" type="number" min="1" placeholder="Any size">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="v-sort">Sort by</label>
                    <select class="form-select" id="v-sort" name="sort">
                        <option value="name:asc">Name, A to Z</option>
                        <option value="city:asc">City, A to Z</option>
                        <option value="capacity:desc">Capacity, largest first</option>
                        <option value="capacity:asc">Capacity, smallest first</option>
                    </select>
                </div>
            </div>
        </form>

        <div id="venue-results" aria-live="polite"></div>
        <div class="mt-3" id="venue-pages"></div>`;

    const form = container.querySelector('#venue-filters');
    const results = container.querySelector('#venue-results');
    const pages = container.querySelector('#venue-pages');
    let venues = [];

    async function load() {
        results.innerHTML = loadingHtml('Loading venues');
        pages.innerHTML = '';
        const [sort, direction] = filters.sort.split(':');
        try {
            const page = await get('/venues', { ...filters, sort, direction, per_page: 8 });
            venues = page.data;

            if (venues.length === 0) {
                results.innerHTML = filters.search || filters.min_capacity
                    ? emptyHtml('No venues match these filters', 'Try a different search or a smaller capacity.')
                    : emptyHtml('No venues yet', 'Add the first venue so events can be created.');
                return;
            }

            results.innerHTML = `
                <div class="table-wrap"><table class="table table-hover">
                    <thead><tr>
                        <th scope="col">Venue</th><th scope="col">Address</th><th scope="col">City</th>
                        <th scope="col" class="text-end">Capacity</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr></thead>
                    <tbody>${venues.map((venue) => `
                        <tr>
                            <td class="fw-bold">${esc(venue.name)}</td>
                            <td>${esc(venue.address)}</td>
                            <td>${esc(venue.city)}</td>
                            <td class="text-end num">${venue.capacity}</td>
                            <td class="actions">
                                <button type="button" class="btn btn-sm btn-quiet" data-action="edit" data-id="${venue.id}">Edit</button>
                                ${isAdmin ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${venue.id}">Delete</button>` : ''}
                            </td>
                        </tr>`).join('')}</tbody>
                </table></div>`;

            renderPagination(pages, page, (number) => {
                filters.page = number;
                load();
            });
        } catch (error) {
            showError(results, error, load);
        }
    }

    /** Open the venue form in the pop-up. Pass a venue to edit it, or nothing to create one. */
    function openForm(venue) {
        const modal = openModal({
            title: venue ? 'Edit venue' : 'New venue',
            body: `
                <form id="venue-form" novalidate>
                    <div class="alert alert-danger" role="alert" data-form-error hidden></div>
                    <div class="mb-3">
                        <label class="form-label" for="vf-name">Name</label>
                        <input class="form-control" id="vf-name" name="name" maxlength="150" value="${esc(venue ? venue.name : '')}" required>
                        <div class="invalid-feedback">Enter the venue's name.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="vf-address">Address</label>
                        <input class="form-control" id="vf-address" name="address" maxlength="255" value="${esc(venue ? venue.address : '')}" required>
                        <div class="invalid-feedback">Enter the address.</div>
                    </div>
                    <div class="row g-3">
                        <div class="col-7">
                            <label class="form-label" for="vf-city">City</label>
                            <input class="form-control" id="vf-city" name="city" maxlength="100" value="${esc(venue ? venue.city : '')}" required>
                            <div class="invalid-feedback">Enter the city.</div>
                        </div>
                        <div class="col-5">
                            <label class="form-label" for="vf-capacity">Capacity</label>
                            <input class="form-control" id="vf-capacity" name="capacity" type="number" min="1" max="1000000" step="1" value="${venue ? venue.capacity : ''}" required>
                            <div class="invalid-feedback">Enter how many people it holds.</div>
                        </div>
                    </div>
                </form>`,
            footer: `
                <button type="button" class="btn btn-quiet" data-bs-dismiss="modal">Discard</button>
                <button type="submit" class="btn btn-brand" form="venue-form">${venue ? 'Save changes' : 'Create venue'}</button>`,
        });

        const venueForm = modal.body.querySelector('#venue-form');
        venueForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFormErrors(venueForm);
            if (!browserValidate(venueForm)) {
                return;
            }
            const data = formValues(venueForm);
            data.capacity = Number(data.capacity);

            const done = setBusy(modal.footer.querySelector('[type="submit"]'), 'Saving');
            try {
                if (venue) {
                    await put(`/venues/${venue.id}`, data);
                    toast('Venue saved.');
                } else {
                    await post('/venues', data);
                    toast('Venue created.');
                }
                closeModal();
                load();
            } catch (error) {
                done();
                showFormErrors(venueForm, error); // 422 duplicate name, 409 capacity below an event's tickets
            }
        });
    }

    async function deleteVenue(venue) {
        const yes = await confirmDialog({
            title: 'Delete this venue?',
            message: `"${venue.name}" will be removed permanently. Venues that have events cannot be deleted.`,
            confirmLabel: 'Delete venue',
        });
        if (!yes) {
            return;
        }
        try {
            await del(`/venues/${venue.id}`);
            toast('Venue deleted.');
            load();
        } catch (error) {
            toast(error.message, 'danger'); // 409 "This venue has events and cannot be deleted."
        }
    }

    container.querySelector('#new-venue').addEventListener('click', () => openForm(null));

    results.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const venue = venues.find((item) => item.id === Number(button.dataset.id));
        if (button.dataset.action === 'edit') {
            openForm(venue);
        } else {
            deleteVenue(venue);
        }
    });

    let typingTimer;
    form.addEventListener('input', (event) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            filters.search = form.elements.search.value.trim();
            filters.min_capacity = form.elements.min_capacity.value;
            filters.sort = form.elements.sort.value;
            filters.page = 1;
            load();
        }, event.target.tagName === 'SELECT' ? 0 : 350);
    });
    form.addEventListener('submit', (event) => event.preventDefault());

    await load();
}
