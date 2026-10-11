# EventHub frontend

A browser frontend for the EventHub API. It covers all four roles in one app: after logging in, each user sees the pages their role is allowed to use.

Built with HTML, CSS, JavaScript and Bootstrap 5. There is no build step.

## Run it

1. Start the backend first (see the README in the project root). It must be running at `http://127.0.0.1:8000`.
2. From the project root, serve this folder on its own port:

   ```bash
   php -S 127.0.0.1:5500 -t frontend-ishak
   ```

3. Open `http://127.0.0.1:5500` in a browser.

The login page lists a sample account for each role. Every sample account uses the password `password`.

If the backend runs at a different address, change `API_BASE` in `js/config.js`.

## Pages and the API calls they make

| Page | Who can open it | API endpoints used |
|---|---|---|
| Events | Everyone | `GET /events` |
| Event details and booking form | Everyone. Only customers can book | `GET /events/{id}`, `POST /bookings` |
| Log in | Guests | `POST /auth/login` |
| Create account | Guests | `POST /auth/register` |
| My bookings / Bookings | Any logged-in user | `GET /bookings`, `PUT /bookings/{id}`, `DELETE /bookings/{id}` |
| Ticket with QR code | Any logged-in user who may see the booking | `GET /bookings/{id}`, `GET /bookings/{id}/qr`, `PUT /bookings/{id}` |
| Manage events | Admin, organiser | `GET /events`, `PUT /events/{id}`, `DELETE /events/{id}` |
| New event / Edit event | Admin, organiser | `GET /venues`, `GET /users`, `GET /events/{id}`, `POST /events`, `PUT /events/{id}` |
| Venues | Admin, organiser | `GET /venues`, `POST /venues`, `PUT /venues/{id}`, `DELETE /venues/{id}` |
| Users | Admin | `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}` |

The app also calls `GET /auth/me` when it starts and `POST /auth/logout` when the user logs out.

## What each role can do

| Role | In this frontend |
|---|---|
| Guest | Browse, search and filter events. Register or log in |
| Customer | Book tickets, see own bookings, open a ticket with its QR code, cancel a booking |
| Staff | See every booking, search by reference or customer, check customers in, cancel bookings |
| Organiser | Create, edit, publish, cancel and delete own events. Create and edit venues. Manage bookings for own events |
| Admin | Everything above for all events and bookings, plus delete venues, delete cancelled bookings, and manage users |

## How it is organised

| File | Job |
|---|---|
| `index.html` | The page shell: navigation bar, content area, message area and one shared pop-up |
| `css/app.css` | Colours, type and the ticket design, on top of Bootstrap |
| `js/config.js` | The API address and the author name shown in the footer |
| `js/api.js` | Sends every request. Adds the JWT, reads the JSON and turns failures into one error type |
| `js/session.js` | Stores the token and user in `localStorage` |
| `js/router.js` | Moves between pages using the address after `#` |
| `js/app.js` | Matches the address to a page, checks the role and draws the navigation bar |
| `js/ui.js` | Shared helpers: safe HTML, dates and prices, messages, pop-up, pagination, form errors |
| `js/booking-actions.js` | Cancel, check in and delete a booking, used by two pages |
| `js/views/*.js` | One file per page |

## How it handles the things the API can return

- **Authentication.** After login the token is saved and sent as `Authorization: Bearer <token>` on every request. If the API answers 401 because the token expired, the app logs the user out and opens the login page.
- **Roles.** The navigation bar only shows links the role may use, and the router refuses pages meant for other roles. The API still makes the final decision, so a 403 is shown as a message.
- **Validation.** Forms check required fields, number ranges, matching passwords and date order in the browser. Field errors from the API (422) appear under the matching field.
- **Business rules.** A 409 from the API, such as a sold-out event or a schedule clash, is shown in the form or as a message.
- **Loading, empty and error states.** Every list shows a spinner while loading, a message when there is nothing to show, and an error with a "Try again" button when a request fails.
- **Third-party API.** The ticket page shows the QR code that the backend gets from goQR.me. If that service is down, the ticket still shows and offers to try again.

## Third-party files

| File | Source | Licence |
|---|---|---|
| `vendor/bootstrap.min.css`, `vendor/bootstrap.bundle.min.js` | Bootstrap 5.3.3 | MIT |
| `vendor/fonts/plus-jakarta-sans-latin-wght-normal.woff2` | Plus Jakarta Sans, via Fontsource | SIL Open Font License 1.1 |
