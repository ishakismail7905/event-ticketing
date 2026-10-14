# EventHub frontend: Naufal

Student: AHMAD NAUFAL BIN AHMAD FUAD (Student ID: AM2512021850)
Course: SWC3633/SWC4443 Web API Development

A role-based web frontend for the shared EventHub REST API, built with plain HTML,
CSS and JavaScript plus Bootstrap 5 from a CDN. No build step.

## How to run

1. Start MySQL in XAMPP.
2. Start the backend from the repo root:
```
   cd D:\projects\event-ticketing\backend

   php artisan serve
```
3. In a second terminal, from the repo root:
```
   cd D:\projects\event-ticketing

   php -S 127.0.0.1:5501 -t frontend-naufal
```
4. Open http://127.0.0.1:5501/index.html

The API base URL is set in `js/api.js` (`http://127.0.0.1:8000/api`).

### Test accounts (password: `password`)

| Role | Email |
|---|---|
| Admin | admin@eventhub.test |
| Organiser | daniel@eventhub.test |
| Staff | hafiz@eventhub.test |
| Customer | siti@eventhub.test |

## Roles covered

After login the app reads `user.role` and shows only the pages that role may use.
Every protected page calls `requireRole([...])`; the backend enforces the same
rules and returns 403 if a forbidden request is attempted.

| Role | What they can do |
|---|---|
| Guest | Browse, search, filter and sort events; view details; register; log in |
| Customer | Book tickets, view own bookings, cancel, view QR ticket |
| Staff | View all bookings, search, check in, cancel |
| Organiser | Create, edit, publish, cancel and delete own events; create and edit venues; view bookings for own events |
| Admin | Everything above for all records, plus user CRUD, delete venues and delete cancelled bookings |

## Pages and endpoints

| Page | Roles | Endpoints |
|---|---|---|
| `index.html` | Everyone | `GET /events` (search, category, sort, pagination) |
| `event.html` | Everyone (booking: customer) | `GET /events/{id}`, `POST /bookings` |
| `login.html` | Guest | `POST /auth/login` |
| `register.html` | Guest | `POST /auth/register` |
| `bookings.html` | Customer, staff, organiser, admin | `GET /bookings`, `PUT /bookings/{id}`, `DELETE /bookings/{id}`, `GET /bookings/{id}/qr` |
| `manage-events.html` | Organiser, admin | `GET /events`, `PUT /events/{id}`, `DELETE /events/{id}` |
| `event-form.html` | Organiser, admin | `GET /venues`, `GET /events/{id}`, `POST /events`, `PUT /events/{id}` |
| `venues.html` | Organiser, admin | `GET /venues`, `POST /venues`, `PUT /venues/{id}`, `DELETE /venues/{id}` |
| `users.html` | Admin | `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}` |
| All protected pages | Logged in | `POST /auth/logout` |

## File structure

```
frontend-naufal/
  *.html           one page per feature
  css/style.css    custom theme on top of Bootstrap
  js/api.js        apiRequest(): every API call, JWT header, error handling
  js/auth.js       session storage, requireRole(), role-based navbar, logout
  js/ui.js         alerts, 422 field errors, loading buttons, formatting, pagination
  js/<page>.js     one script per page
```

## Key design decisions

- **One API helper.** `fetch()` does not throw on 4xx/5xx, so `apiRequest()` checks
  `response.ok` once and throws `{ status, message, errors }` for every page.
- **Shared pages per role.** `bookings.html` serves four roles. The API already
  scopes the data per role, and the page only changes the title and buttons.
- **Two validation layers.** Browser validation (`required`, `min`, `type="email"`,
  end after start, matching passwords) plus server 422 errors shown under the
  matching field.
- **Business-rule errors.** 409 messages (sold out, schedule clash, event has
  bookings, already checked in) are shown on screen.
- **Expired sessions.** A 401 clears the token and returns the user to login.
- **No secrets in the browser.** Only the user's JWT is stored. The `X-API-Key`
  for `/api/tickets/{reference}` is never used in the frontend.
- **Third-party API.** The QR ticket comes from the backend, which calls the
  goQR.me API. The frontend shows the returned base64 PNG in a modal.
- **Safe output.** API text is escaped (`escapeHtml`) before being placed in HTML.