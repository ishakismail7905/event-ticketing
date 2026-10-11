// Users page, admin only. Full create, read, update and delete on /users.

import { get, post, put, del } from '../api.js';
import { getUser } from '../session.js';
import { esc, roleName, formatDate, toast, confirmDialog, openModal, closeModal, setBusy, formValues, showFormErrors, clearFormErrors,
    browserValidate, loadingHtml, emptyHtml, showError, renderPagination } from '../ui.js';

const ROLES = ['admin', 'organiser', 'staff', 'customer'];

export async function render(container) {
    const me = getUser();
    const filters = { search: '', role: '', sort: 'id:asc', page: 1 };

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
                <h1>Users</h1>
                <p class="lead-text">Everyone with an account. Customers register themselves. Create staff, organiser and admin accounts here.</p>
            </div>
            <button type="button" class="btn btn-brand" id="new-user">New user</button>
        </div>

        <form class="filter-bar mb-3" id="user-filters" role="search" aria-label="Filter users">
            <div class="row g-2 align-items-end">
                <div class="col-12 col-md-5">
                    <label class="form-label" for="u-search">Search</label>
                    <input class="form-control" id="u-search" name="search" type="search" placeholder="Name or email">
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="u-role">Role</label>
                    <select class="form-select" id="u-role" name="role">
                        <option value="">All</option>
                        ${ROLES.map((name) => `<option value="${name}">${roleName(name)}</option>`).join('')}
                    </select>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label" for="u-sort">Sort by</label>
                    <select class="form-select" id="u-sort" name="sort">
                        <option value="id:asc">Oldest account first</option>
                        <option value="id:desc">Newest account first</option>
                        <option value="name:asc">Name, A to Z</option>
                        <option value="role:asc">Role</option>
                    </select>
                </div>
            </div>
        </form>

        <div id="user-results" aria-live="polite"></div>
        <div class="mt-3" id="user-pages"></div>`;

    const form = container.querySelector('#user-filters');
    const results = container.querySelector('#user-results');
    const pages = container.querySelector('#user-pages');
    let users = [];

    async function load() {
        results.innerHTML = loadingHtml('Loading users');
        pages.innerHTML = '';
        const [sort, direction] = filters.sort.split(':');
        try {
            const page = await get('/users', { ...filters, sort, direction, per_page: 8 });
            users = page.data;

            if (users.length === 0) {
                results.innerHTML = emptyHtml('No users match these filters', 'Try a different search or role.');
                return;
            }

            results.innerHTML = `
                <div class="table-wrap"><table class="table table-hover">
                    <thead><tr>
                        <th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th>
                        <th scope="col">Role</th><th scope="col">Joined</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr></thead>
                    <tbody>${users.map((user) => `
                        <tr>
                            <td class="fw-bold">${esc(user.name)} ${user.id === me.id ? '<span class="role-tag">(you)</span>' : ''}</td>
                            <td>${esc(user.email)}</td>
                            <td class="num">${esc(user.phone || 'Not given')}</td>
                            <td>${esc(roleName(user.role))}</td>
                            <td>${formatDate(user.created_at)}</td>
                            <td class="actions">
                                <button type="button" class="btn btn-sm btn-quiet" data-action="edit" data-id="${user.id}">Edit</button>
                                ${user.id === me.id ? '' : `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${user.id}">Delete</button>`}
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

    /** Open the user form in the pop-up. Pass a user to edit, or nothing to create one. */
    function openForm(user) {
        const isSelf = user && user.id === me.id;
        const modal = openModal({
            title: user ? 'Edit user' : 'New user',
            body: `
                <form id="user-form" novalidate>
                    <div class="alert alert-danger" role="alert" data-form-error hidden></div>
                    <div class="mb-3">
                        <label class="form-label" for="uf-name">Full name</label>
                        <input class="form-control" id="uf-name" name="name" maxlength="255" value="${esc(user ? user.name : '')}" required>
                        <div class="invalid-feedback">Enter the user's name.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="uf-email">Email</label>
                        <input class="form-control" id="uf-email" name="email" type="email" value="${esc(user ? user.email : '')}" required>
                        <div class="invalid-feedback">Enter a valid email address.</div>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-6">
                            <label class="form-label" for="uf-role">Role</label>
                            <select class="form-select" id="uf-role" name="role" ${isSelf ? 'disabled' : ''} required>
                                ${ROLES.map((name) => `<option value="${name}" ${(user ? user.role : 'staff') === name ? 'selected' : ''}>${roleName(name)}</option>`).join('')}
                            </select>
                            ${isSelf ? '<div class="form-text">You cannot change your own role.</div>' : ''}
                        </div>
                        <div class="col-6">
                            <label class="form-label" for="uf-phone">Phone <span class="text-secondary fw-normal">(optional)</span></label>
                            <input class="form-control" id="uf-phone" name="phone" maxlength="20" value="${esc(user && user.phone ? user.phone : '')}">
                        </div>
                    </div>
                    <div class="mb-1">
                        <label class="form-label" for="uf-password">${user ? 'New password' : 'Password'}</label>
                        <input class="form-control" id="uf-password" name="password" type="password" minlength="8" autocomplete="new-password" ${user ? '' : 'required'}>
                        <div class="form-text">${user ? 'Leave empty to keep the current password.' : 'At least 8 characters.'}</div>
                        <div class="invalid-feedback">Use at least 8 characters.</div>
                    </div>
                </form>`,
            footer: `
                <button type="button" class="btn btn-quiet" data-bs-dismiss="modal">Discard</button>
                <button type="submit" class="btn btn-brand" form="user-form">${user ? 'Save changes' : 'Create user'}</button>`,
        });

        const userForm = modal.body.querySelector('#user-form');
        userForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFormErrors(userForm);
            if (!browserValidate(userForm)) {
                return;
            }
            const data = formValues(userForm);
            if (user && !data.password) {
                delete data.password; // keep the current password
            }

            const done = setBusy(modal.footer.querySelector('[type="submit"]'), 'Saving');
            try {
                if (user) {
                    await put(`/users/${user.id}`, data);
                    toast('User saved.');
                } else {
                    await post('/users', data);
                    toast('User created.');
                }
                closeModal();
                load();
            } catch (error) {
                done();
                showFormErrors(userForm, error); // e.g. 422 "The email has already been taken."
            }
        });
    }

    async function deleteUser(user) {
        const yes = await confirmDialog({
            title: 'Delete this user?',
            message: `${user.name} (${user.email}) will be removed permanently. Users who have events or bookings cannot be deleted.`,
            confirmLabel: 'Delete user',
        });
        if (!yes) {
            return;
        }
        try {
            await del(`/users/${user.id}`);
            toast('User deleted.');
            load();
        } catch (error) {
            toast(error.message, 'danger'); // 409 "This user has events or bookings and cannot be deleted."
        }
    }

    container.querySelector('#new-user').addEventListener('click', () => openForm(null));

    results.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const user = users.find((item) => item.id === Number(button.dataset.id));
        if (button.dataset.action === 'edit') {
            openForm(user);
        } else {
            deleteUser(user);
        }
    });

    let typingTimer;
    form.addEventListener('input', (event) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            filters.search = form.elements.search.value.trim();
            filters.role = form.elements.role.value;
            filters.sort = form.elements.sort.value;
            filters.page = 1;
            load();
        }, event.target.name === 'search' ? 350 : 0);
    });
    form.addEventListener('submit', (event) => event.preventDefault());

    await load();
}
