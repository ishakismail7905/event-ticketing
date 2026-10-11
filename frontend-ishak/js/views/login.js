// Log in page. Sends the email and password to POST /auth/login and stores the token.

import { post } from '../api.js';
import { saveSession } from '../session.js';
import { navigate } from '../router.js';
import { toast, setBusy, formValues, showFormErrors, clearFormErrors, browserValidate } from '../ui.js';

// The accounts created by the backend's sample data. All use the password "password".
const SAMPLE_ACCOUNTS = [
    ['Admin', 'admin@eventhub.test'],
    ['Organiser', 'daniel@eventhub.test'],
    ['Staff', 'hafiz@eventhub.test'],
    ['Customer', 'siti@eventhub.test'],
];

export async function render(container) {
    container.innerHTML = `
        <div class="row justify-content-center g-4">
            <div class="col-md-6 col-lg-5">
                <h1>Log in</h1>
                <form class="panel mt-3" id="login-form" novalidate>
                    <div class="alert alert-danger" role="alert" data-form-error hidden></div>
                    <div class="mb-3">
                        <label class="form-label" for="login-email">Email</label>
                        <input class="form-control" id="login-email" name="email" type="email" autocomplete="username" required>
                        <div class="invalid-feedback">Enter a valid email address.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="login-password">Password</label>
                        <input class="form-control" id="login-password" name="password" type="password" autocomplete="current-password" required>
                        <div class="invalid-feedback">Enter your password.</div>
                    </div>
                    <button class="btn btn-brand w-100" type="submit">Log in</button>
                    <p class="mt-3 mb-0 small">No account yet? <a href="#/register">Create a customer account</a></p>
                </form>
            </div>
            <div class="col-md-5 col-lg-4">
                <div class="panel sample-accounts mt-md-5">
                    <h2 class="h6">Sample accounts</h2>
                    <p class="text-secondary mb-2">Choose one to fill in the form. Each role sees different pages.</p>
                    <div class="d-grid gap-2">
                        ${SAMPLE_ACCOUNTS.map(([label, email]) => `
                            <button type="button" class="btn btn-sm btn-quiet" data-email="${email}">
                                <strong>${label}</strong><br><span class="text-secondary">${email}</span>
                            </button>`).join('')}
                    </div>
                </div>
            </div>
        </div>`;

    const form = container.querySelector('#login-form');

    container.querySelectorAll('[data-email]').forEach((button) => {
        button.addEventListener('click', () => {
            form.elements.email.value = button.dataset.email;
            form.elements.password.value = 'password';
            form.elements.password.focus();
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormErrors(form);
        if (!browserValidate(form)) {
            return;
        }

        const done = setBusy(form.querySelector('[type="submit"]'), 'Logging in');
        try {
            const reply = await post('/auth/login', formValues(form));
            saveSession(reply.data.access_token, reply.data.user);
            toast(`Logged in as ${reply.data.user.name}.`);

            // Go back to the page the user was trying to open, if there was one.
            const wanted = sessionStorage.getItem('eventhub.after-login');
            sessionStorage.removeItem('eventhub.after-login');
            navigate(wanted || '/events');
        } catch (error) {
            done();
            showFormErrors(form, error); // 401 wrong password, 422 invalid input, 429 too many attempts
        }
    });
}
