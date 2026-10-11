// Create account page. Sends the form to POST /auth/register. New accounts are customers.

import { post } from '../api.js';
import { saveSession } from '../session.js';
import { navigate } from '../router.js';
import { toast, setBusy, formValues, showFormErrors, clearFormErrors, browserValidate } from '../ui.js';

export async function render(container) {
    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-7 col-lg-5">
                <h1>Create account</h1>
                <p class="lead-text">A customer account lets you book tickets and keep them in one place.</p>
                <form class="panel" id="register-form" novalidate>
                    <div class="alert alert-danger" role="alert" data-form-error hidden></div>
                    <div class="mb-3">
                        <label class="form-label" for="reg-name">Full name</label>
                        <input class="form-control" id="reg-name" name="name" maxlength="255" autocomplete="name" required>
                        <div class="invalid-feedback">Enter your name.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="reg-email">Email</label>
                        <input class="form-control" id="reg-email" name="email" type="email" autocomplete="email" required>
                        <div class="invalid-feedback">Enter a valid email address.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="reg-phone">Phone <span class="text-secondary fw-normal">(optional)</span></label>
                        <input class="form-control" id="reg-phone" name="phone" maxlength="20" autocomplete="tel">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="reg-password">Password</label>
                        <input class="form-control" id="reg-password" name="password" type="password" minlength="8" autocomplete="new-password" required>
                        <div class="form-text">At least 8 characters.</div>
                        <div class="invalid-feedback">Use at least 8 characters.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="reg-confirm">Repeat password</label>
                        <input class="form-control" id="reg-confirm" name="password_confirmation" type="password" autocomplete="new-password" required>
                        <div class="invalid-feedback">The two passwords must match.</div>
                    </div>
                    <button class="btn btn-brand w-100" type="submit">Create account</button>
                    <p class="mt-3 mb-0 small">Already registered? <a href="#/login">Log in</a></p>
                </form>
            </div>
        </div>`;

    const form = container.querySelector('#register-form');
    const password = form.elements.password;
    const confirm = form.elements.password_confirmation;

    // Client-side check that both passwords are the same, before anything is sent.
    const checkMatch = () => confirm.setCustomValidity(confirm.value === password.value ? '' : 'The two passwords must match.');
    password.addEventListener('input', checkMatch);
    confirm.addEventListener('input', checkMatch);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormErrors(form);
        checkMatch();
        if (!browserValidate(form)) {
            return;
        }

        const done = setBusy(form.querySelector('[type="submit"]'), 'Creating account');
        try {
            const reply = await post('/auth/register', formValues(form));
            saveSession(reply.data.access_token, reply.data.user);
            toast('Account created. You are logged in.');
            navigate('/events');
        } catch (error) {
            done();
            showFormErrors(form, error); // e.g. 422 "The email has already been taken."
        }
    });
}
