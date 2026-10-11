// Small helpers shared by every page: safe HTML, formatting, messages,
// the pop-up window, loading and empty states, pagination and form errors.

/* global bootstrap */

/** Escape text before putting it into HTML, so user data can never run as code. */
export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
}

// ---------- Formatting ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The API sends dates as "2026-12-05 20:30:00". Turn that into a Date. */
export function parseDate(text) {
    return new Date(String(text).replace(' ', 'T'));
}

export function dateParts(text) {
    const date = parseDate(text);
    return { day: date.getDate(), month: MONTHS[date.getMonth()], year: date.getFullYear(), weekday: DAYS[date.getDay()] };
}

export function formatTime(text) {
    const date = parseDate(text);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

export function formatDate(text) {
    const p = dateParts(text);
    return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

export function formatDateTime(text) {
    return `${formatDate(text)}, ${formatTime(text)}`;
}

/** "2026-12-05 20:30:00" becomes "2026-12-05T20:30" for a datetime-local input. */
export function toInputValue(text) {
    return text ? String(text).slice(0, 16).replace(' ', 'T') : '';
}

export function money(value) {
    const amount = Number(value);
    return amount === 0 ? 'Free' : `RM ${amount.toFixed(2)}`;
}

const STATUS_WORDS = {
    draft: 'Draft', published: 'Published', cancelled: 'Cancelled', confirmed: 'Confirmed', checked_in: 'Checked in',
};

export function statusBadge(status) {
    return `<span class="status status-${esc(status)}">${esc(STATUS_WORDS[status] || status)}</span>`;
}

export function roleName(role) {
    return { admin: 'Admin', organiser: 'Organiser', staff: 'Staff', customer: 'Customer' }[role] || role;
}

// ---------- Messages ----------

/** A short message in the corner of the screen. type: 'success' or 'danger'. */
export function toast(message, type = 'success') {
    const element = document.createElement('div');
    element.className = `toast align-items-center text-bg-${type} border-0`;
    element.setAttribute('role', type === 'danger' ? 'alert' : 'status');
    element.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${esc(message)}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>`;
    document.getElementById('toasts').append(element);
    element.addEventListener('hidden.bs.toast', () => element.remove());
    new bootstrap.Toast(element, { delay: type === 'danger' ? 7000 : 4000 }).show();
}

// ---------- Pop-up window ----------

function modalParts() {
    const element = document.getElementById('app-modal');
    return {
        element,
        title: document.getElementById('app-modal-title'),
        body: document.getElementById('app-modal-body'),
        footer: document.getElementById('app-modal-footer'),
        instance: bootstrap.Modal.getOrCreateInstance(element),
    };
}

/** Open the shared pop-up with the given HTML. Returns its body and footer elements. */
export function openModal({ title, body, footer = '' }) {
    const modal = modalParts();
    modal.title.textContent = title;
    modal.body.innerHTML = body;
    modal.footer.innerHTML = footer;
    modal.footer.hidden = footer === '';
    modal.instance.show();
    return modal;
}

export function closeModal() {
    modalParts().instance.hide();
}

/** Ask "are you sure?". Resolves to true if the user confirms. */
export function confirmDialog({ title, message, confirmLabel, danger = true }) {
    return new Promise((resolve) => {
        const modal = openModal({
            title,
            body: `<p class="mb-0">${esc(message)}</p>`,
            footer: `
                <button type="button" class="btn btn-quiet" data-bs-dismiss="modal">Keep it</button>
                <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-brand'}" data-confirm>${esc(confirmLabel)}</button>`,
        });
        let confirmed = false;
        modal.footer.querySelector('[data-confirm]').addEventListener('click', () => {
            confirmed = true;
            modal.instance.hide();
        });
        modal.element.addEventListener('hidden.bs.modal', () => resolve(confirmed), { once: true });
    });
}

// ---------- Page states ----------

export function loadingHtml(text = 'Loading') {
    return `<div class="loading" role="status"><div class="spinner-border spinner-border-sm" aria-hidden="true"></div><span>${esc(text)}</span></div>`;
}

export function emptyHtml(title, hint = '', actionHtml = '') {
    return `<div class="empty"><strong>${esc(title)}</strong>${esc(hint)}${actionHtml ? `<div class="mt-3">${actionHtml}</div>` : ''}</div>`;
}

/** An error box with a "Try again" button that reruns the given function. */
export function showError(container, error, retry) {
    container.innerHTML = `
        <div class="alert alert-danger d-flex flex-wrap align-items-center gap-3" role="alert">
            <span class="me-auto">${esc(error.message)}</span>
            ${retry ? '<button type="button" class="btn btn-sm btn-outline-danger" data-retry>Try again</button>' : ''}
        </div>`;
    const button = container.querySelector('[data-retry]');
    if (button) {
        button.addEventListener('click', retry);
    }
}

/** Disable a button and show a spinner while a request is running. Returns a function that undoes it. */
export function setBusy(button, busyText) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(busyText)}`;
    return () => {
        button.disabled = false;
        button.innerHTML = original;
    };
}

// ---------- Pagination ----------

/** Page buttons for a paginated API reply. Clicking one calls onPage(pageNumber). */
export function renderPagination(container, page, onPage) {
    if (!page || page.last_page <= 1) {
        container.innerHTML = page && page.total ? `<p class="text-secondary small mb-0">${page.total} in total</p>` : '';
        return;
    }
    const numbers = [];
    for (let n = 1; n <= page.last_page; n++) {
        if (n === 1 || n === page.last_page || Math.abs(n - page.current_page) <= 1) {
            numbers.push(n);
        } else if (numbers[numbers.length - 1] !== '…') {
            numbers.push('…');
        }
    }
    const item = (label, target, { active = false, disabled = false } = {}) => `
        <li class="page-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}">
            <button type="button" class="page-link" ${disabled ? 'disabled' : `data-page="${target}"`} ${active ? 'aria-current="page"' : ''}>${label}</button>
        </li>`;
    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <p class="text-secondary small mb-0">Showing ${page.from}–${page.to} of ${page.total}</p>
            <nav aria-label="Pages"><ul class="pagination pagination-sm mb-0">
                ${item('Previous', page.current_page - 1, { disabled: page.current_page === 1 })}
                ${numbers.map((n) => (n === '…' ? item('…', 0, { disabled: true }) : item(n, n, { active: n === page.current_page }))).join('')}
                ${item('Next', page.current_page + 1, { disabled: page.current_page === page.last_page })}
            </ul></nav>
        </div>`;
    container.querySelectorAll('[data-page]').forEach((button) => {
        button.addEventListener('click', () => onPage(Number(button.dataset.page)));
    });
}

// ---------- Forms ----------

/** Read a form's fields into a plain object. Empty optional fields are left out. */
export function formValues(form) {
    const values = {};
    new FormData(form).forEach((value, key) => {
        values[key] = typeof value === 'string' ? value.trim() : value;
    });
    return values;
}

export function clearFormErrors(form) {
    form.querySelectorAll('.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback[data-server]').forEach((message) => message.remove());
    form.querySelectorAll('.invalid-feedback[hidden]').forEach((message) => { message.hidden = false; });
    const box = form.querySelector('[data-form-error]');
    if (box) {
        box.hidden = true;
        box.textContent = '';
    }
}

/**
 * Show an API error on a form. Field errors (422) appear under their fields.
 * Anything else, such as a 409 business rule, appears in the form's alert box.
 */
export function showFormErrors(form, error) {
    clearFormErrors(form);
    form.classList.remove('was-validated');
    let shownOnField = false;
    for (const [name, messages] of Object.entries(error.errors || {})) {
        const field = form.querySelector(`[name="${name}"]`);
        if (!field) {
            continue;
        }
        field.classList.add('is-invalid');
        // Hide the form's own hint for this field, so only the server's message shows.
        field.parentElement.querySelectorAll('.invalid-feedback').forEach((hint) => { hint.hidden = true; });
        const message = document.createElement('div');
        message.className = 'invalid-feedback';
        message.dataset.server = '1';
        message.textContent = messages[0];
        field.insertAdjacentElement('afterend', message);
        shownOnField = true;
    }
    const box = form.querySelector('[data-form-error]');
    if (box && (!shownOnField || error.status !== 422)) {
        box.textContent = error.message;
        box.hidden = false;
    }
    const firstInvalid = form.querySelector('.is-invalid');
    if (firstInvalid) {
        firstInvalid.focus();
    }
}

/** Run the browser's own checks (required, min, type) and show Bootstrap's styling. */
export function browserValidate(form) {
    form.classList.add('was-validated');
    return form.checkValidity();
}
