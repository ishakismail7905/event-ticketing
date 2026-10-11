// The starting point of the frontend.
// It decides which page to show for the address after the # sign (the "route"),
// checks that the user's role may open it, and draws the navigation bar.

import { AUTHOR } from './config.js';
import { get, post } from './api.js';
import { getToken, getUser, saveUser, clearSession, role, hasRole } from './session.js';
import { esc, toast, roleName, loadingHtml, showError } from './ui.js';
import { navigate } from './router.js';

import * as loginPage from './views/login.js';
import * as registerPage from './views/register.js';
import * as eventsPage from './views/events.js';
import * as eventPage from './views/event.js';
import * as bookingsPage from './views/bookings.js';
import * as ticketPage from './views/ticket.js';
import * as manageEventsPage from './views/manage-events.js';
import * as eventFormPage from './views/event-form.js';
import * as venuesPage from './views/venues.js';
import * as usersPage from './views/users.js';

const ALL = ['admin', 'organiser', 'staff', 'customer'];

// Each route: the address pattern, the page module, and which roles may open it.
// roles: null means everyone, including guests. 'guest-only' means logged-out users.
const routes = [
    { pattern: /^\/events$/, page: eventsPage, roles: null },
    { pattern: /^\/events\/(\d+)$/, page: eventPage, roles: null },
    { pattern: /^\/login$/, page: loginPage, roles: 'guest-only' },
    { pattern: /^\/register$/, page: registerPage, roles: 'guest-only' },
    { pattern: /^\/bookings$/, page: bookingsPage, roles: ALL },
    { pattern: /^\/bookings\/(\d+)$/, page: ticketPage, roles: ALL },
    { pattern: /^\/manage\/events$/, page: manageEventsPage, roles: ['admin', 'organiser'] },
    { pattern: /^\/manage\/events\/new$/, page: eventFormPage, roles: ['admin', 'organiser'] },
    { pattern: /^\/manage\/events\/(\d+)\/edit$/, page: eventFormPage, roles: ['admin', 'organiser'] },
    { pattern: /^\/manage\/venues$/, page: venuesPage, roles: ['admin', 'organiser'] },
    { pattern: /^\/manage\/users$/, page: usersPage, roles: ['admin'] },
];

// The links each role sees in the navigation bar.
const navLinks = [
    { href: '#/events', label: 'Events', roles: ['guest', ...ALL] },
    { href: '#/bookings', label: 'My bookings', roles: ['customer'] },
    { href: '#/bookings', label: 'Bookings', roles: ['admin', 'organiser', 'staff'] },
    { href: '#/manage/events', label: 'Manage events', roles: ['admin', 'organiser'] },
    { href: '#/manage/venues', label: 'Venues', roles: ['admin', 'organiser'] },
    { href: '#/manage/users', label: 'Users', roles: ['admin'] },
];

const view = document.getElementById('view');

function currentPath() {
    return window.location.hash.replace(/^#/, '') || '/events';
}

function renderNav() {
    const path = currentPath();
    const myRole = role();
    const user = getUser();

    document.getElementById('nav-main').innerHTML = navLinks
        .filter((link) => link.roles.includes(myRole))
        .map((link) => {
            const target = link.href.slice(1);
            const active = path === target || path.startsWith(`${target}/`);
            return `<li class="nav-item"><a class="nav-link ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''} href="${link.href}">${link.label}</a></li>`;
        })
        .join('');

    const userArea = document.getElementById('nav-user');
    if (myRole === 'guest') {
        userArea.innerHTML = `
            <a class="btn btn-sm btn-outline-light" href="#/login">Log in</a>
            <a class="btn btn-sm btn-brand" href="#/register">Create account</a>`;
        return;
    }

    userArea.innerHTML = `
        <span class="nav-who">${esc(user.name)}<small>${esc(roleName(user.role))}</small></span>
        <button type="button" class="btn btn-sm btn-outline-light" id="logout-button">Log out</button>`;
    document.getElementById('logout-button').addEventListener('click', logout);
}

async function logout() {
    try {
        await post('/auth/logout'); // tells the API to blacklist the token
    } catch (error) {
        // Even if the request fails, the user is logged out on this device.
    }
    clearSession();
    toast('Logged out.');
    navigate('/events');
}

async function renderRoute() {
    const path = currentPath();
    const match = routes.map((route) => ({ route, found: path.match(route.pattern) })).find((entry) => entry.found);

    renderNav();

    if (!match) {
        view.innerHTML = `
            <div class="empty"><strong>Page not found</strong>There is nothing at this address.
            <div class="mt-3"><a class="btn btn-brand" href="#/events">Browse events</a></div></div>`;
        return;
    }

    const { route, found } = match;

    // Role handling: send the user somewhere sensible when the page is not for them.
    if (route.roles === 'guest-only' && role() !== 'guest') {
        navigate('/events');
        return;
    }
    if (Array.isArray(route.roles) && role() === 'guest') {
        sessionStorage.setItem('eventhub.after-login', path);
        navigate('/login');
        return;
    }
    if (Array.isArray(route.roles) && !hasRole(...route.roles)) {
        view.innerHTML = `
            <div class="empty"><strong>This page is not available for your role</strong>
            You are logged in as ${esc(roleName(role()))}.
            <div class="mt-3"><a class="btn btn-brand" href="#/events">Browse events</a></div></div>`;
        return;
    }

    view.innerHTML = loadingHtml();
    try {
        await route.page.render(view, found.slice(1));
    } catch (error) {
        showError(view, error, renderRoute);
    }
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
}

// When the API says the token is no longer valid, ask the user to log in again.
window.addEventListener('session-expired', () => {
    toast('Your session has ended. Log in again to continue.', 'danger');
    navigate('/login');
});

window.addEventListener('hashchange', renderRoute);

async function start() {
    document.getElementById('footer-author').textContent = AUTHOR;

    // If a token is saved, ask the API who it belongs to. This also catches expired tokens.
    if (getToken()) {
        try {
            const reply = await get('/auth/me');
            saveUser(reply.data);
        } catch (error) {
            // api.js already cleared the session if the token was rejected.
        }
    }
    renderRoute();
}

start();
