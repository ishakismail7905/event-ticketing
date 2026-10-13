
const API_URL = "http://127.0.0.1:8000/api";
const $ = selector => document.querySelector(selector);

let allEvents = [];
let activeCategory = "all";
let selectedEvent = null;
let authMode = "login";
let accessToken = null;
let currentUser = null;
let managementType = "events";
let editingRecord = null;
let managementVenues = [];
let isSubmittingBooking = false;

const container = $("#events-container");
const searchInput = $("#search-input");
const sortSelect = $("#sort-select");
const eventCount = $("#event-count");
const emptyState = $("#empty-state");
const categoryList = $("#category-list");

const eventModal = $("#event-modal");
const modalContent = $("#modal-content");
const quantityInput = $("#ticket-quantity");
const modalBookButton = $("#modal-book");

const authModal = $("#auth-modal");
const authForm = $("#auth-form");
const authMessage = $("#auth-message");
const authTitle = $("#auth-title");
const authDescription = $("#auth-description");
const authSubmit = $("#auth-submit");
const authSwitchButton = $("#auth-switch-btn");
const authSwitchText = $("#auth-switch-text");
const nameField = $("#name-field");
const confirmPasswordField = $("#confirm-password-field");
const passwordInput = $("#auth-password");
const passwordConfirmation = $("#auth-password-confirmation");

const bookingsContainer = $("#bookings-container");
const messageModal = $("#message-modal");

const managementSection = $("#management-section");
const managementTabs = $("#management-tabs");
const managementHeading = $("#management-heading");
const managementDescription = $("#management-description");
const managementListHeading = $("#management-list-heading");
const managementCreateButton = $("#management-create-btn");
const managementMessage = $("#management-message");
const managementFormContainer = $("#management-form-container");
const managementForm = $("#management-form");
const managementFormFields = $("#management-form-fields");
const managementTableContainer = $("#management-table-container");
const managementSaveButton = $("#management-save-btn");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showModal(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
}

function hideModal(modal) {
    modal.hidden = true;

    if ([eventModal, authModal, messageModal].every(item => item.hidden)) {
        document.body.classList.remove("modal-open");
    }
}

function showMessage(title, message) {
    $("#message-title").textContent = title;

    const text = $("#message-text");
    text.replaceChildren();
    text.textContent = message;

    showModal(messageModal);
}

async function apiRequest(path, options = {}) {
    const headers = {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers
    };

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    const text = await response.text();
    let result = {};

    if (text) {
        try {
            result = JSON.parse(text);
        } catch {
            result = { message: text };
        }
    }

    if (!response.ok) {
        const error = new Error(
            result.message || `Request failed (${response.status})`
        );
        error.status = response.status;
        error.data = result;
        throw error;
    }

    return result;
}

function errorMessage(error) {
    const errors = error.data?.errors;

    if (errors && typeof errors === "object") {
        return Object.values(errors).flat().join("\n");
    }

    return error.message || "Something went wrong. Please try again.";
}

function getCategory(event) {
    const category = String(event.category || "").toLowerCase();

    if (category.includes("music")) return "music";
    if (category.includes("tech") || category.includes("conference")) {
        return "technology";
    }
    if (category.includes("theatre") || category.includes("art")) {
        return "arts";
    }
    if (category.includes("food") || category.includes("festival")) {
        return "food";
    }

    return "other";
}

function formatDate(value) {
    if (!value) return "Date not announced";

    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatTime(value) {
    if (!value) return "Time not announced";

    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "Time not announced";

    return date.toLocaleTimeString("en-MY", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function toDateTimeInput(value) {
    if (!value) return "";

    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";

    const pad = number => String(number).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventStatus(event) {
    if (event.status !== "published") {
        return event.status || "Unavailable";
    }

    if (!event.starts_at) return "Date TBA";

    const date = new Date(String(event.starts_at).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "Published";

    return date <= new Date() ? "Past event" : "Upcoming";
}

function eventPrice(event) {
    const price = Number(event.ticket_price ?? 0);
    return Number.isFinite(price) && price >= 0 ? price : 0;
}

function venueName(event) {
    return event.venue?.name || "Venue to be announced";
}

function artwork(category) {
    return {
        music: "♫",
        technology: "⌘",
        arts: "✳",
        food: "♨",
        other: "✦"
    }[category] || "✦";
}

function currentRole() {
    return String(currentUser?.role || "").toLowerCase();
}

function isAdmin() {
    return currentRole() === "admin";
}

function canManageEvents() {
    return ["admin", "organiser"].includes(currentRole());
}

function canManageVenues() {
    return ["admin", "organiser"].includes(currentRole());
}

/* NAVBAR AND ROLE-BASED MANAGEMENT */

function updateNavigation() {
    const actions = $("#auth-actions");
    const nav = $("#main-nav");

    if (!currentUser) {
        nav.innerHTML = `
            <a href="#events" data-nav="events">Explore Events</a>
        `;

        actions.innerHTML = `
            <button type="button" class="btn-login" id="login-btn">Log in</button>
            <button type="button" class="btn-primary" id="signup-btn">Register</button>
        `;

        managementSection.hidden = true;
        return;
    }

    const role = currentRole();
    let links = `
        <a href="#events" data-nav="events">Explore Events</a>
    `;

    if (role === "customer") {
        links += `
            <a href="#my-bookings" data-nav="bookings">My Bookings</a>
        `;
    }

    if (role === "organiser") {
        links += `
            <a href="#management-section" data-management="events">Manage Events</a>
            <a href="#management-section" data-management="venues">Manage Venues</a>
            <a href="#management-section" data-management="bookings">Event Bookings</a>
        `;
    }

    if (role === "staff") {
        links += `
            <a href="#management-section" data-management="bookings">Bookings</a>
        `;
    }

    if (role === "admin") {
        links += `
            <a href="#management-section" data-management="events">Manage Events</a>
            <a href="#management-section" data-management="venues">Manage Venues</a>
            <a href="#management-section" data-management="users">Manage Users</a>
            <a href="#management-section" data-management="bookings">All Bookings</a>
        `;
    }

    nav.innerHTML = links;

    actions.innerHTML = `
        <span class="nav-user">
            ${escapeHTML(currentUser.name)} · ${escapeHTML(role)}
        </span>
        <button type="button" class="btn-login" id="logout-btn">Log out</button>
    `;

    managementSection.hidden = role === "customer";
    renderManagementTabs();
}


function renderManagementTabs() {
    const role = currentRole();
    const tabs = [];

    if (["admin", "organiser"].includes(role)) {
        tabs.push(["events", "Events"]);
        tabs.push(["venues", "Venues"]);
    }

    if (role === "admin") {
        tabs.push(["users", "Users"]);
    }

    if (["admin", "organiser", "staff"].includes(role)) {
        tabs.push(["bookings", "Bookings"]);
    }

    managementTabs.innerHTML = tabs.map(([key, label]) => `
        <button type="button"
            class="management-tab ${managementType === key ? "active" : ""}"
            data-management-tab="${key}">
            ${label}
        </button>
    `).join("");
}


function showManagement(type) {
    if (!currentUser || currentRole() === "customer") {
        showMessage("Access denied", "Management access requires an authorised account.");
        return;
    }

    if (type === "events" && !canManageEvents()) {
        showMessage("Access denied", "Your role cannot manage events.");
        return;
    }

    if (type === "venues" && !canManageVenues()) {
        showMessage("Access denied", "Your role cannot manage venues.");
        return;
    }

    if (type === "users" && !isAdmin()) {
        showMessage("Access denied", "Only admins can manage users.");
        return;
    }

    if (!["events", "venues", "users", "bookings"].includes(type)) return;

    managementType = type;
    editingRecord = null;

    managementSection.hidden = false;
    managementFormContainer.hidden = true;
    managementMessage.textContent = "";

    renderManagementTabs();

    const titles = {
        events: ["Manage Events", "Create and update event records.", "Events"],
        venues: ["Manage Venues", "Create and update venue records.", "Venues"],
        users: ["Manage Users", "Create and manage user accounts and roles.", "Users"],
        bookings: ["Bookings", "Review bookings available to your account.", "Bookings"]
    };

    managementHeading.textContent = titles[type][0];
    managementDescription.textContent = titles[type][1];
    managementListHeading.textContent = titles[type][2];

    managementCreateButton.hidden = type === "bookings";
    managementCreateButton.textContent =
        type === "events" ? "Create event" :
        type === "venues" ? "Create venue" :
        "Create user";

    if (type === "events") loadManagementEvents();
    if (type === "venues") loadManagementVenues();
    if (type === "users") loadManagementUsers();
    if (type === "bookings") loadManagementBookings();

    managementSection.scrollIntoView({ behavior: "auto", block: "start" });
}


/* PUBLIC EVENT LIST */

async function loadEvents() {
    container.hidden = false;
    container.innerHTML = '<p class="loading-state">Loading events...</p>';

    try {
        const result = await apiRequest("/events?per_page=100");

        allEvents = Array.isArray(result)
            ? result
            : Array.isArray(result.data)
                ? result.data
                : [];

        renderEvents();
    } catch (error) {
        console.error("Failed to load events:", error);
        eventCount.textContent = "Unable to load events";
        container.innerHTML = `
            <p class="loading-state">
                Could not load events. Check whether the backend server is running.
            </p>
        `;
    }
}

function renderEvents() {
    const keyword = searchInput.value.trim().toLowerCase();

    let events = allEvents.filter(event => {
        const searchable = [
            event.title,
            event.description,
            event.category,
            venueName(event),
            event.venue?.city
        ].join(" ").toLowerCase();

        return searchable.includes(keyword) &&
            (activeCategory === "all" ||
                getCategory(event) === activeCategory);
    });

    if (sortSelect.value === "name") {
        events.sort((a, b) =>
            String(a.title || "").localeCompare(String(b.title || ""))
        );
    }

    if (sortSelect.value === "price") {
        events.sort((a, b) => eventPrice(a) - eventPrice(b));
    }

    eventCount.textContent =
        `${events.length} event${events.length === 1 ? "" : "s"}`;

    emptyState.hidden = events.length > 0;
    container.hidden = events.length === 0;

    container.innerHTML = events.map(event => {
        const category = getCategory(event);
        const price = eventPrice(event);
        const available = Number(event.available_tickets ?? 0);

        return `
            <article class="event-card">
                <div class="event-art art-${category}">
                    <span class="art-tag">${escapeHTML(event.category || "Event")}</span>
                    <span class="art-symbol">${artwork(category)}</span>
                </div>

                <div class="event-card-body">
                    <h3>${escapeHTML(event.title || "Untitled event")}</h3>

                    <p class="event-description">
                        ${escapeHTML(event.description || "No description available.")}
                    </p>

                    <div class="event-meta">
                        <span>📅 ${escapeHTML(formatDate(event.starts_at))}</span>
                        <span>🕒 ${escapeHTML(formatTime(event.starts_at))}</span>
                        <span>📍 ${escapeHTML(venueName(event))},
                            ${escapeHTML(event.venue?.city || "")}
                        </span>
                    </div>

                    <div class="event-card-footer">
                        <div class="event-price">
                            <small>${escapeHTML(eventStatus(event))} · ${available} tickets left</small>
                            <strong>${price === 0 ? "Free" : "RM " + price.toFixed(2)}</strong>
                        </div>

                        <button type="button" class="book-btn" data-event-id="${escapeHTML(event.id)}">
                            View details
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function showEventDetails(eventId) {
    selectedEvent = allEvents.find(
        event => String(event.id) === String(eventId)
    );

    if (!selectedEvent) return;

    const event = selectedEvent;
    const price = eventPrice(event);
    const status = eventStatus(event);
    const available = Number(event.available_tickets ?? 0);
    const canBook = status === "Upcoming" && available > 0;

    modalContent.innerHTML = `
        <span class="modal-category">${escapeHTML(event.category || "Event")}</span>
        <h2 id="modal-title">${escapeHTML(event.title || "Event details")}</h2>

        <p class="modal-description">
            ${escapeHTML(event.description || "No description available.")}
        </p>

        <div class="detail-list">
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">${escapeHTML(status)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${escapeHTML(formatDate(event.starts_at))}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value">${escapeHTML(formatTime(event.starts_at))} – ${escapeHTML(formatTime(event.ends_at))}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Venue</span>
                <span class="detail-value">${escapeHTML(venueName(event))}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">City</span>
                <span class="detail-value">${escapeHTML(event.venue?.city || "Not specified")}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Organiser</span>
                <span class="detail-value">${escapeHTML(event.organiser?.name || "Not specified")}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Ticket price</span>
                <span class="detail-value">${price === 0 ? "Free" : "RM " + price.toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tickets left</span>
                <span class="detail-value">${available}</span>
            </div>
        </div>
    `;

    quantityInput.value = "1";
    quantityInput.max = String(Math.max(1, Math.min(10, available)));
    quantityInput.disabled = !canBook;

    modalBookButton.disabled = !canBook;
    modalBookButton.textContent = canBook ? "Book ticket" :
        status === "Past event" ? "Event ended" :
        available <= 0 ? "Sold out" : "Booking unavailable";

    showModal(eventModal);
}

function closeEventModal() {
    hideModal(eventModal);
    selectedEvent = null;
}

/* AUTHENTICATION */

function openAuthModal(mode = "login") {
    authMode = mode;
    authForm.reset();
    authMessage.textContent = "";

    const registering = mode === "register";

    authTitle.textContent = registering ? "Create an account" : "Log in";
    authDescription.textContent = registering
        ? "Register to book and manage your tickets."
        : "Log in to manage your event bookings.";

    authSubmit.textContent = registering ? "Create account" : "Log in";
    authSwitchText.textContent = registering
        ? "Already have an account?"
        : "Don't have an account?";
    authSwitchButton.textContent = registering ? "Log in" : "Register";

    nameField.hidden = !registering;
    confirmPasswordField.hidden = !registering;

    $("#auth-name").required = registering;
    passwordConfirmation.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";

    showModal(authModal);
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const registering = authMode === "register";
    const email = $("#auth-email").value.trim();
    const password = passwordInput.value;
    const payload = { email, password };

    if (registering) {
        payload.name = $("#auth-name").value.trim();
        payload.password_confirmation = passwordConfirmation.value;

        if (password.length < 8) {
            authMessage.textContent = "Password must contain at least 8 characters.";
            return;
        }

        if (password !== passwordConfirmation.value) {
            authMessage.textContent = "Passwords do not match.";
            return;
        }
    }

    authSubmit.disabled = true;
    authSubmit.textContent = registering ? "Creating account..." : "Logging in...";
    authMessage.textContent = "";

    try {
        const result = await apiRequest(
            registering ? "/auth/register" : "/auth/login",
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        accessToken = result.data.access_token;
        currentUser = result.data.user;

        updateNavigation();
        hideModal(authModal);

        await loadBookings();

        showMessage(
            registering ? "Account created" : "Login successful",
            `Welcome${currentUser?.name ? ", " + currentUser.name : ""}!`
        );
    } catch (error) {
        authMessage.textContent = errorMessage(error);
    } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = registering ? "Create account" : "Log in";
    }
}

async function loadCurrentUser() {
    if (!accessToken) return;

    try {
        const result = await apiRequest("/auth/me");
        currentUser = result.data;
        updateNavigation();
    } catch {
        accessToken = null;
        currentUser = null;
        updateNavigation();
    }
}

async function logout() {
    try {
        if (accessToken) {
            await apiRequest("/auth/logout", { method: "POST" });
        }
    } catch (error) {
        console.warn("Logout request failed:", error);
    }

    accessToken = null;
    currentUser = null;

    updateNavigation();

    bookingsContainer.innerHTML =
        '<p class="muted-message">Log in to view your bookings.</p>';

    showMessage("Logged out", "You have been logged out.");
}

/* CUSTOMER BOOKINGS */

async function createBooking() {
    if (!selectedEvent || isSubmittingBooking) return;

    if (!currentUser || !accessToken) {
        closeEventModal();
        openAuthModal("login");
        authMessage.textContent = "Please log in with a customer account to book tickets.";
        return;
    }

    if (currentRole() !== "customer") {
        showMessage("Booking unavailable", "Only customer accounts can book tickets.");
        return;
    }

    const quantity = Number(quantityInput.value);
    const available = Number(selectedEvent.available_tickets ?? 0);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        showMessage("Invalid quantity", "Choose between 1 and 10 tickets.");
        return;
    }

    if (quantity > available) {
        showMessage("Not enough tickets", `Only ${available} tickets are available.`);
        return;
    }

    isSubmittingBooking = true;
    modalBookButton.disabled = true;
    modalBookButton.textContent = "Processing...";

    try {
        const result = await apiRequest("/bookings", {
            method: "POST",
            body: JSON.stringify({ event_id: selectedEvent.id, quantity })
        });

        const booking = result.data;
        const title = selectedEvent.title;

        closeEventModal();
        await loadEvents();
        await loadBookings();

        showMessage(
            "Booking confirmed!",
            `${result.message || "Booking successful."}\n\n` +
            `Reference: ${booking.booking_reference || "See My Bookings"}\n` +
            `Event: ${booking.event?.title || title}\n` +
            `Tickets: ${booking.quantity}\n` +
            `Total: RM ${Number(booking.total_price ?? 0).toFixed(2)}`
        );
    } catch (error) {
        if (error.status === 401) {
            accessToken = null;
            currentUser = null;
            updateNavigation();
            closeEventModal();
            openAuthModal("login");
            authMessage.textContent = "Your session expired. Please log in again.";
        } else {
            showMessage("Booking unsuccessful", errorMessage(error));
            await loadEvents();
        }
    } finally {
        isSubmittingBooking = false;

        if (selectedEvent) {
            modalBookButton.disabled = eventStatus(selectedEvent) !== "Upcoming";
            modalBookButton.textContent = "Book ticket";
        }
    }
}

function renderBookings(bookings) {
    if (!bookings.length) {
        bookingsContainer.innerHTML =
            '<p class="muted-message">No bookings found.</p>';
        return;
    }

    bookingsContainer.innerHTML = `
        <div class="booking-list">
            ${bookings.map(booking => {
                const event = booking.event || {};
                const status = String(booking.status || "unknown");

                const startsAt = event.starts_at
                    ? new Date(String(event.starts_at).replace(" ", "T"))
                    : null;

                const canCancel = currentRole() === "customer" &&
                    status === "confirmed" &&
                    startsAt && startsAt > new Date();

                return `
                    <article class="booking-item">
                        <div>
                            <h3>${escapeHTML(event.title || "Event booking")}</h3>
                            <p>Reference: ${escapeHTML(booking.booking_reference || "N/A")}</p>
                            <p>Date: ${escapeHTML(formatDate(event.starts_at))}</p>
                            <p>Tickets: ${Number(booking.quantity || 0)}
                                · Total: RM ${Number(booking.total_price || 0).toFixed(2)}
                            </p>
                            <span class="status-label status-${escapeHTML(status)}">
                                ${escapeHTML(status.replaceAll("_", " "))}
                            </span>
                        </div>

                        <div class="booking-actions">
                            ${canCancel ? `
                                <button type="button" class="btn-login"
                                    data-cancel-booking="${escapeHTML(booking.id)}">
                                    Cancel booking
                                </button>
                            ` : ""}

                            <button type="button" class="btn-login"
                                data-show-qr="${escapeHTML(booking.id)}">
                                View QR
                            </button>
                        </div>
                    </article>
                `;
            }).join("")}
        </div>
    `;
}

async function loadBookings() {
    if (!accessToken || !currentUser) {
        bookingsContainer.innerHTML =
            '<p class="muted-message">Log in to view your bookings.</p>';
        return;
    }

    bookingsContainer.innerHTML =
        '<p class="muted-message">Loading bookings...</p>';

    try {
        const result = await apiRequest("/bookings");
        const bookings = Array.isArray(result)
            ? result
            : Array.isArray(result.data)
                ? result.data
                : [];

        renderBookings(bookings);
    } catch (error) {
        bookingsContainer.innerHTML =
            `<p class="muted-message">${escapeHTML(errorMessage(error))}</p>`;
    }
}

async function cancelBooking(id) {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;

    try {
        const result = await apiRequest(`/bookings/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "cancelled" })
        });

        await loadBookings();
        await loadEvents();

        showMessage("Booking cancelled", result.message || "Your booking was cancelled.");
    } catch (error) {
        showMessage("Unable to cancel", errorMessage(error));
    }
}

async function showBookingQR(id) {
    try {
        const result = await apiRequest(`/bookings/${id}/qr`);
        const data = result.data || {};

        const source = data.image ||
            data.qr_code ||
            (data.base64 ? `data:image/png;base64,${data.base64}` : "");

        if (!source) {
            showMessage("QR code", "The API did not return a recognised QR image field.");
            return;
        }

        $("#message-title").textContent = "Booking QR code";

        const text = $("#message-text");
        text.replaceChildren();

        const image = document.createElement("img");
        image.src = source;
        image.alt = "Booking QR code";
        image.style.display = "block";
        image.style.width = "220px";
        image.style.maxWidth = "100%";
        image.style.margin = "12px auto";

        text.appendChild(image);
        showModal(messageModal);
    } catch (error) {
        showMessage("QR unavailable", errorMessage(error));
    }
}

/* MANAGEMENT: EVENTS */

async function loadManagementEvents() {
    managementTableContainer.innerHTML =
        '<p class="muted-message">Loading events...</p>';

    try {
        const result = await apiRequest("/events?per_page=100");
        const events = Array.isArray(result.data) ? result.data : [];

        if (!events.length) {
            managementTableContainer.innerHTML =
                '<p class="muted-message">No events found.</p>';
            return;
        }

        managementTableContainer.innerHTML = `
            <table class="management-table">
                <thead>
                    <tr>
                        <th>Event</th>
                        <th>Venue</th>
                        <th>Date</th>
                        <th>Tickets</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${events.map(event => `
                        <tr>
                            <td>
                                <strong>${escapeHTML(event.title)}</strong><br>
                                ${escapeHTML(event.category || "")}
                            </td>
                            <td>${escapeHTML(event.venue?.name || event.venue_id)}</td>
                            <td>${escapeHTML(formatDate(event.starts_at))}</td>
                            <td>${Number(event.available_tickets ?? 0)} / ${Number(event.total_tickets ?? 0)}</td>
                            <td>${escapeHTML(event.status)}</td>
                            <td>
                                <div class="management-row-actions">
                                    <button type="button" data-edit-event="${escapeHTML(event.id)}">Edit</button>
                                    <button type="button" class="danger" data-delete-event="${escapeHTML(event.id)}">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (error) {
        managementTableContainer.innerHTML =
            `<p class="muted-message">${escapeHTML(errorMessage(error))}</p>`;
    }
}

async function loadVenueOptions() {
    const result = await apiRequest("/venues?per_page=100");
    managementVenues = Array.isArray(result.data) ? result.data : [];
    return managementVenues;
}

async function openEventForm(eventId = null) {
    editingRecord = eventId
        ? allEvents.find(event => String(event.id) === String(eventId)) || null
        : null;

    managementMessage.textContent = "";

    try {
        await loadVenueOptions();
    } catch (error) {
        showMessage("Unable to load venues", errorMessage(error));
        return;
    }

    const event = editingRecord || {};
    const venueOptions = managementVenues.map(venue => `
        <option value="${escapeHTML(venue.id)}"
            ${String(venue.id) === String(event.venue_id) ? "selected" : ""}>
            ${escapeHTML(venue.name)} — ${escapeHTML(venue.city)}
            (capacity ${Number(venue.capacity)})
        </option>
    `).join("");

    managementFormFields.innerHTML = `
        <div class="management-field">
            <label for="event-title">Title *</label>
            <input id="event-title" name="title" maxlength="150" required
                value="${escapeHTML(event.title || "")}">
        </div>

        <div class="management-field">
            <label for="event-category">Category *</label>
            <input id="event-category" name="category" maxlength="50" required
                value="${escapeHTML(event.category || "")}">
        </div>

        <div class="management-field full-width">
            <label for="event-description">Description</label>
            <textarea id="event-description" name="description" maxlength="5000">${escapeHTML(event.description || "")}</textarea>
        </div>

        <div class="management-field full-width">
            <label for="event-venue">Venue *</label>
            <select id="event-venue" name="venue_id" required>
                <option value="">Choose a venue</option>
                ${venueOptions}
            </select>
        </div>

        <div class="management-field">
            <label for="event-start">Start date and time *</label>
            <input type="datetime-local" id="event-start" name="starts_at" required
                value="${escapeHTML(toDateTimeInput(event.starts_at))}">
        </div>

        <div class="management-field">
            <label for="event-end">End date and time *</label>
            <input type="datetime-local" id="event-end" name="ends_at" required
                value="${escapeHTML(toDateTimeInput(event.ends_at))}">
        </div>

        <div class="management-field">
            <label for="event-price">Ticket price (RM) *</label>
            <input type="number" id="event-price" name="ticket_price"
                min="0" max="999999.99" step="0.01" required
                value="${escapeHTML(event.ticket_price ?? "0.00")}">
        </div>

        <div class="management-field">
            <label for="event-total">Total tickets *</label>
            <input type="number" id="event-total" name="total_tickets"
                min="1" step="1" required
                value="${escapeHTML(event.total_tickets ?? "1")}">
        </div>

        <div class="management-field">
            <label for="event-status">Status</label>
            <select id="event-status" name="status">
                ${["draft", "published", "cancelled"].map(status => `
                    <option value="${status}"
                        ${String(event.status || "draft") === status ? "selected" : ""}>
                        ${status}
                    </option>
                `).join("")}
            </select>
        </div>

        ${isAdmin() ? `
            <div class="management-field">
                <label for="event-organiser">Organiser ID (optional)</label>
                <input type="number" id="event-organiser" name="organiser_id"
                    min="1" value="${escapeHTML(event.organiser_id || "")}">
            </div>
        ` : ""}
    `;

    managementSaveButton.textContent = eventId ? "Update event" : "Create event";
    managementFormContainer.hidden = false;
    managementFormContainer.scrollIntoView({ behavior: "auto", block: "start" });
}

async function saveEvent(event) {
    event.preventDefault();

    const form = new FormData(managementForm);
    const payload = {
        venue_id: Number(form.get("venue_id")),
        title: String(form.get("title")).trim(),
        description: String(form.get("description") || "").trim(),
        category: String(form.get("category")).trim(),
        starts_at: form.get("starts_at"),
        ends_at: form.get("ends_at"),
        ticket_price: Number(form.get("ticket_price")),
        total_tickets: Number(form.get("total_tickets")),
        status: form.get("status")
    };

    if (isAdmin() && form.get("organiser_id")) {
        payload.organiser_id = Number(form.get("organiser_id"));
    }

    managementSaveButton.disabled = true;
    managementSaveButton.textContent = "Saving...";

    try {
        const path = editingRecord
            ? `/events/${editingRecord.id}`
            : "/events";

        const result = await apiRequest(path, {
            method: editingRecord ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        managementFormContainer.hidden = true;
        editingRecord = null;
        managementMessage.textContent = result.message || "Event saved.";

        await loadEvents();
        await loadManagementEvents();

        showMessage("Success", result.message || "Event saved.");
    } catch (error) {
        managementMessage.textContent = errorMessage(error);
    } finally {
        managementSaveButton.disabled = false;
        managementSaveButton.textContent = editingRecord ? "Update event" : "Create event";
    }
}

async function deleteEvent(id) {
    if (!window.confirm("Delete this event? Events with bookings cannot be deleted.")) {
        return;
    }

    try {
        const result = await apiRequest(`/events/${id}`, { method: "DELETE" });
        await loadEvents();
        await loadManagementEvents();
        showMessage("Event deleted", result.message || "Event deleted.");
    } catch (error) {
        showMessage("Unable to delete event", errorMessage(error));
    }
}

/* MANAGEMENT: VENUES */

async function loadManagementVenues() {
    managementTableContainer.innerHTML =
        '<p class="muted-message">Loading venues...</p>';

    try {
        const result = await apiRequest("/venues?per_page=100");
        managementVenues = Array.isArray(result.data) ? result.data : [];

        if (!managementVenues.length) {
            managementTableContainer.innerHTML =
                '<p class="muted-message">No venues found.</p>';
            return;
        }

        managementTableContainer.innerHTML = `
            <table class="management-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Address</th>
                        <th>City</th>
                        <th>Capacity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${managementVenues.map(venue => `
                        <tr>
                            <td>${escapeHTML(venue.name)}</td>
                            <td>${escapeHTML(venue.address)}</td>
                            <td>${escapeHTML(venue.city)}</td>
                            <td>${Number(venue.capacity)}</td>
                            <td>
                                <div class="management-row-actions">
                                    <button type="button" data-edit-venue="${escapeHTML(venue.id)}">Edit</button>
                                    ${isAdmin() ? `
                                        <button type="button" class="danger"
                                            data-delete-venue="${escapeHTML(venue.id)}">
                                            Delete
                                        </button>
                                    ` : ""}
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (error) {
        managementTableContainer.innerHTML =
            `<p class="muted-message">${escapeHTML(errorMessage(error))}</p>`;
    }
}

async function openVenueForm(venueId = null) {
    editingRecord = venueId
        ? managementVenues.find(venue => String(venue.id) === String(venueId)) || null
        : null;

    const venue = editingRecord || {};

    managementMessage.textContent = "";

    managementFormFields.innerHTML = `
        <div class="management-field">
            <label for="venue-name">Venue name *</label>
            <input id="venue-name" name="name" maxlength="150" required
                value="${escapeHTML(venue.name || "")}">
        </div>

        <div class="management-field">
            <label for="venue-city">City *</label>
            <input id="venue-city" name="city" maxlength="100" required
                value="${escapeHTML(venue.city || "")}">
        </div>

        <div class="management-field full-width">
            <label for="venue-address">Address *</label>
            <input id="venue-address" name="address" maxlength="255" required
                value="${escapeHTML(venue.address || "")}">
        </div>

        <div class="management-field">
            <label for="venue-capacity">Capacity *</label>
            <input id="venue-capacity" name="capacity" type="number"
                min="1" max="1000000" step="1" required
                value="${escapeHTML(venue.capacity ?? "1")}">
        </div>
    `;

    managementSaveButton.textContent = venueId ? "Update venue" : "Create venue";
    managementFormContainer.hidden = false;
    managementFormContainer.scrollIntoView({ behavior: "auto", block: "start" });
}

async function saveVenue(event) {
    event.preventDefault();

    const form = new FormData(managementForm);
    const payload = {
        name: String(form.get("name")).trim(),
        address: String(form.get("address")).trim(),
        city: String(form.get("city")).trim(),
        capacity: Number(form.get("capacity"))
    };

    managementSaveButton.disabled = true;
    managementSaveButton.textContent = "Saving...";

    try {
        const path = editingRecord
            ? `/venues/${editingRecord.id}`
            : "/venues";

        const result = await apiRequest(path, {
            method: editingRecord ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        managementFormContainer.hidden = true;
        editingRecord = null;
        managementMessage.textContent = result.message || "Venue saved.";

        await loadManagementVenues();
        await loadEvents();

        showMessage("Success", result.message || "Venue saved.");
    } catch (error) {
        managementMessage.textContent = errorMessage(error);
    } finally {
        managementSaveButton.disabled = false;
        managementSaveButton.textContent = editingRecord ? "Update venue" : "Create venue";
    }
}

async function deleteVenue(id) {
    if (!isAdmin()) {
        showMessage("Access denied", "Only admins can delete venues.");
        return;
    }

    if (!window.confirm("Delete this venue? Venues with events cannot be deleted.")) {
        return;
    }

    try {
        const result = await apiRequest(`/venues/${id}`, { method: "DELETE" });
        await loadManagementVenues();
        await loadEvents();
        showMessage("Venue deleted", result.message || "Venue deleted.");
    } catch (error) {
        showMessage("Unable to delete venue", errorMessage(error));
    }
}


async function openUserForm(userId = null) {
    if (!isAdmin()) {
        showMessage("Access denied", "Only admins can manage users.");
        return;
    }

    editingRecord = null;

    let user = {};

    if (userId) {
        try {
            const response = await apiRequest(`/users/${userId}`);
            user = response.data || {};
            editingRecord = user;
        } catch (error) {
            showMessage("Unable to load user", errorMessage(error));
            return;
        }
    }

    managementMessage.textContent = "";

    managementFormFields.innerHTML = `
        <div class="management-field">
            <label for="user-name">Full name *</label>
            <input id="user-name" name="name" maxlength="255"
                required value="${escapeHTML(user.name || "")}">
        </div>

        <div class="management-field">
            <label for="user-email">Email address *</label>
            <input id="user-email" name="email" type="email"
                maxlength="255" required
                value="${escapeHTML(user.email || "")}">
        </div>

        <div class="management-field">
            <label for="user-phone">Phone</label>
            <input id="user-phone" name="phone" maxlength="20"
                value="${escapeHTML(user.phone || "")}">
        </div>

        <div class="management-field">
            <label for="user-role">Role *</label>
            <select id="user-role" name="role" required>
                ${["customer", "organiser", "staff", "admin"].map(role => `
                    <option value="${role}"
                        ${String(user.role || "customer") === role ? "selected" : ""}>
                        ${role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                `).join("")}
            </select>
        </div>

        <div class="management-field full-width">
            <label for="user-password">
                Password ${userId ? "(leave blank to keep current password)" : "*"}
            </label>
            <input id="user-password" name="password" type="password"
                minlength="8" autocomplete="new-password"
                ${userId ? "" : "required"}>
        </div>
    `;

    managementSaveButton.textContent = userId ? "Update user" : "Create user";
    managementFormContainer.hidden = false;
    managementFormContainer.scrollIntoView({
        behavior: "auto",
        block: "start"
    });
}

async function saveUser(event) {
    event.preventDefault();

    if (!isAdmin()) {
        showMessage("Access denied", "Only admins can manage users.");
        return;
    }

    const form = new FormData(managementForm);
    const payload = {
        name: String(form.get("name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim() || null,
        role: String(form.get("role") || "")
    };

    const password = String(form.get("password") || "");

    if (password) {
        if (password.length < 8) {
            managementMessage.textContent =
                "Password must contain at least 8 characters.";
            return;
        }

        payload.password = password;
    } else if (!editingRecord) {
        managementMessage.textContent =
            "Password is required when creating a user.";
        return;
    }

    const editingId = editingRecord?.id;

    managementSaveButton.disabled = true;
    managementSaveButton.textContent = "Saving...";

    try {
        const path = editingId ? `/users/${editingId}` : "/users";

        const response = await apiRequest(path, {
            method: editingId ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        managementFormContainer.hidden = true;
        editingRecord = null;
        managementMessage.textContent =
            response.message || "User saved successfully.";

        await loadManagementUsers();

        showMessage("Success", response.message || "User saved successfully.");
    } catch (error) {
        managementMessage.textContent = errorMessage(error);
    } finally {
        managementSaveButton.disabled = false;
        managementSaveButton.textContent =
            editingId ? "Update user" : "Create user";
    }
}

async function deleteUser(userId) {
    if (!isAdmin()) {
        showMessage("Access denied", "Only admins can manage users.");
        return;
    }

    if (String(userId) === String(currentUser?.id)) {
        showMessage("Cannot delete account", "You cannot delete your own account.");
        return;
    }

    if (!window.confirm("Are you sure you want to delete this user?")) {
        return;
    }

    try {
        const response = await apiRequest(`/users/${userId}`, {
            method: "DELETE"
        });

        await loadManagementUsers();

        showMessage("User deleted", response.message || "User deleted successfully.");
    } catch (error) {
        showMessage("Unable to delete user", errorMessage(error));
    }
}


/* MANAGEMENT: BOOKINGS */


/* MANAGEMENT: USERS */

async function loadManagementUsers() {
    if (!isAdmin()) {
        showMessage("Access denied", "Only admins can manage users.");
        return;
    }

    managementTableContainer.innerHTML = `
        <div class="management-user-filters">
            <input type="search" id="user-search"
                placeholder="Search name or email..."
                aria-label="Search users">

            <select id="user-role-filter" aria-label="Filter users by role">
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="organiser">Organiser</option>
                <option value="staff">Staff</option>
                <option value="customer">Customer</option>
            </select>

            <button type="button" class="btn-login" id="user-search-button">
                Search
            </button>
        </div>

        <div id="users-table-results">
            <p class="muted-message">Loading users...</p>
        </div>
    `;

    const searchInput = $("#user-search");
    const roleFilter = $("#user-role-filter");
    const searchButton = $("#user-search-button");
    const results = $("#users-table-results");

    async function fetchUsers() {
        results.innerHTML = '<p class="muted-message">Loading users...</p>';

        const params = new URLSearchParams({
            per_page: "100",
            sort: "id",
            direction: "asc"
        });

        if (searchInput.value.trim()) {
            params.set("search", searchInput.value.trim());
        }

        if (roleFilter.value) {
            params.set("role", roleFilter.value);
        }

        try {
            const response = await apiRequest(`/users?${params.toString()}`);
            const users = Array.isArray(response.data) ? response.data : [];

            if (!users.length) {
                results.innerHTML =
                    '<p class="muted-message">No users found.</p>';
                return;
            }

            results.innerHTML = `
                <table class="management-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${escapeHTML(user.id)}</td>
                                <td>${escapeHTML(user.name)}</td>
                                <td>${escapeHTML(user.email)}</td>
                                <td>${escapeHTML(user.phone || "—")}</td>
                                <td>${escapeHTML(user.role)}</td>
                                <td>
                                    <div class="management-row-actions">
                                        <button type="button"
                                            data-edit-user="${escapeHTML(user.id)}">
                                            Edit
                                        </button>

                                        <button type="button"
                                            class="danger"
                                            data-delete-user="${escapeHTML(user.id)}"
                                            ${String(user.id) === String(currentUser.id) ? "disabled title=\"You cannot delete your own account\"" : ""}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        } catch (error) {
            results.innerHTML = `
                <p class="muted-message">
                    ${escapeHTML(errorMessage(error))}
                </p>
            `;
        }
    }

    searchButton.addEventListener("click", fetchUsers);

    searchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            fetchUsers();
        }
    });

    roleFilter.addEventListener("change", fetchUsers);

    results.addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-user]");
        const deleteButton = event.target.closest("[data-delete-user]");

        if (editButton) {
            openUserForm(editButton.dataset.editUser);
        }

        if (deleteButton && !deleteButton.disabled) {
            deleteUser(deleteButton.dataset.deleteUser);
        }
    });

    await fetchUsers();
}


/* EVENT LISTENERS */

document.addEventListener("click", event => {
    const login = event.target.closest("#login-btn");
    const register = event.target.closest("#signup-btn");
    const logoutButton = event.target.closest("#logout-btn");
    const managementLink = event.target.closest("[data-management]");
    const tab = event.target.closest("[data-management-tab]");

    if (login) {
        event.preventDefault();
        openAuthModal("login");
        return;
    }

    if (register) {
        event.preventDefault();
        openAuthModal("register");
        return;
    }

    if (logoutButton) {
        event.preventDefault();
        logout();
        return;
    }

    if (managementLink) {
        event.preventDefault();
        showManagement(managementLink.dataset.management);
        return;
    }

    if (tab) {
        showManagement(tab.dataset.managementTab);
        return;
    }
});

searchInput.addEventListener("input", renderEvents);
sortSelect.addEventListener("change", renderEvents);

categoryList.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    activeCategory = button.dataset.category;

    categoryList.querySelectorAll(".category-btn").forEach(item => {
        item.classList.toggle("selected", item === button);
    });

    renderEvents();
});

container.addEventListener("click", event => {
    const button = event.target.closest("[data-event-id]");
    if (button) showEventDetails(button.dataset.eventId);
});

authForm.addEventListener("submit", handleAuthSubmit);

authSwitchButton.addEventListener("click", () => {
    openAuthModal(authMode === "login" ? "register" : "login");
});

$("#close-modal").addEventListener("click", closeEventModal);
$("#modal-back").addEventListener("click", closeEventModal);
$("#close-auth-modal").addEventListener("click", () => hideModal(authModal));
$("#close-message-modal").addEventListener("click", () => hideModal(messageModal));
$("#message-ok").addEventListener("click", () => hideModal(messageModal));

eventModal.addEventListener("click", event => {
    if (event.target === eventModal) closeEventModal();
});

authModal.addEventListener("click", event => {
    if (event.target === authModal) hideModal(authModal);
});

messageModal.addEventListener("click", event => {
    if (event.target === messageModal) hideModal(messageModal);
});

modalBookButton.addEventListener("click", createBooking);
$("#refresh-bookings-btn").addEventListener("click", loadBookings);

bookingsContainer.addEventListener("click", event => {
    const cancelButton = event.target.closest("[data-cancel-booking]");
    const qrButton = event.target.closest("[data-show-qr]");

    if (cancelButton) cancelBooking(cancelButton.dataset.cancelBooking);
    if (qrButton) showBookingQR(qrButton.dataset.showQr);
});

managementCreateButton.addEventListener("click", () => {
    if (managementType === "events") openEventForm();
    if (managementType === "venues") openVenueForm();
    if (managementType === "users") openUserForm();
});

managementForm.addEventListener("submit", event => {
    if (managementType === "events") saveEvent(event);
    if (managementType === "venues") saveVenue(event);
    if (managementType === "users") saveUser(event);
});

$("#management-cancel-btn").addEventListener("click", () => {
    managementFormContainer.hidden = true;
    editingRecord = null;
    managementMessage.textContent = "";
});

managementTableContainer.addEventListener("click", async event => {
    const editEventButton = event.target.closest("[data-edit-event]");
    const deleteEventButton = event.target.closest("[data-delete-event]");
    const editVenueButton = event.target.closest("[data-edit-venue]");
    const deleteVenueButton = event.target.closest("[data-delete-venue]");

    if (editEventButton) {
        await loadEvents();
        await openEventForm(editEventButton.dataset.editEvent);
    }

    if (deleteEventButton) {
        await deleteEvent(deleteEventButton.dataset.deleteEvent);
    }

    if (editVenueButton) {
        await loadManagementVenues();
        await openVenueForm(editVenueButton.dataset.editVenue);
    }

    if (deleteVenueButton) {
        await deleteVenue(deleteVenueButton.dataset.deleteVenue);
    }
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    if (!eventModal.hidden) closeEventModal();
    else if (!authModal.hidden) hideModal(authModal);
    else if (!messageModal.hidden) hideModal(messageModal);
});

/* START */

updateNavigation();
loadEvents();
