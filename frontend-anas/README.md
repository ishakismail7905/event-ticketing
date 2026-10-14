# EventHub frontend (Muhammad Anas, AM2512021976)

My own frontend for the shared EventHub REST API. Plain HTML, CSS and JavaScript with
Bootstrap 5.3.3 from a CDN. There is no build step and no framework.

## How to run

You need three PowerShell windows.

1. **Backend** (from the repo root):
```
   cd backend
   php artisan serve
```
   The API runs at `http://127.0.0.1:8000/api`.

2. **Frontend** (from the repo root):
```
   php -S 127.0.0.1:5501 -t frontend-anas
```

3. Open `http://127.0.0.1:5501/login.html` in a browser. Do not open the HTML files by
   double-clicking them, because the pages must be served over HTTP.

**QR codes on Windows:** the backend fetches QR images from goQR.me over HTTPS. If the QR
popup shows "service is not responding" and `backend/storage/logs/laravel.log` contains
`cURL error 60`, download `https://curl.se/ca/cacert.pem` and add these lines to `php.ini`:
```
curl.cainfo = "C:\path\to\cacert.pem"
openssl.cafile = "C:\path\to\cacert.pem"
```
Then restart the backend.

## Test accounts

All seeded accounts use the password `password`.

| Role      | Email                  |
|-----------|------------------------|
| Admin     | admin@eventhub.test    |
| Organiser | daniel@eventhub.test   |
| Staff     | hafiz@eventhub.test    |
| Customer  | siti@eventhub.test     |

Guests need no account. New customers can sign up on `register.html`.

## Pages, roles and endpoints

| Page                 | Who can use it               | What it does                                             | Endpoints called |
|----------------------|------------------------------|----------------------------------------------------------|------------------|
| `login.html`         | Everyone                     | Log in and save the JWT                                  | `POST /auth/login` |
| `register.html`      | Guests                       | Create a customer account (logs in straight away)        | `POST /auth/register` |
| `index.html`         | Everyone                     | Event list with search, sort and pagination              | `GET /events` |
| `event.html?id=`     | Everyone (booking: customer) | Event details, booking form with live total              | `GET /events/{id}`, `POST /bookings` |
| `bookings.html`      | Any logged-in role           | Customer: own bookings, cancel, QR ticket. Staff and organiser: check in, cancel. Admin: also delete cancelled bookings | `GET /bookings`, `PUT /bookings/{id}`, `DELETE /bookings/{id}`, `GET /bookings/{id}/qr` |
| `manage-events.html` | Organiser (own events), admin (all) | Create, edit, publish, cancel and delete events   | `GET /events`, `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}`, `GET /venues` |
| `venues.html`        | Organiser, admin (delete: admin) | Create, edit and delete venues                        | `GET /venues`, `POST /venues`, `PUT /venues/{id}`, `DELETE /venues/{id}` |
| `users.html`         | Admin                        | Create, edit and delete users of any role                | `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}` |
| Every page           | Logged-in users              | Log out                                                  | `POST /auth/logout` |

The API decides which data each role may see (for example, `GET /bookings` returns only a
customer's own bookings). The frontend decides which buttons to show, and the server still
checks every action.

## How each requirement is handled

- **Name and student ID** are shown on every page (navbar strip, or under the card on the
  login and register pages).
- **Loading, empty and error states** on every list page.
- **Browser validation** runs before any request is sent, using the same rules as the API.
- **Server validation (422)**: each message from `errors` is shown under its own field.
- **403** shows a friendly "your role is not allowed" message. Pages also redirect users
  whose role is not allowed.
- **401**: `js/api.js` clears the session and sends the user to the login page.
- **409** business-rule messages from the API (for example "This event has already started"
  or "This venue has events") are shown as they are.
- **Success messages** after every create, update and delete.
- **"Are you sure?"** before every delete and cancel.
- **No API key in browser code.** The `X-API-Key` endpoint is not used by this frontend.
- Text from the API is escaped before it goes into HTML.

## File structure

```
frontend-anas/
  *.html          one file per page
  css/style.css   colours and small layout rules
  js/api.js       every request goes through apiRequest(method, path, body)
  js/auth.js      session storage, role guard, logout
  js/ui.js        shared helpers: alerts, field errors, formatting
  js/nav.js       role-aware navbar with name and student ID
  js/<page>.js    one script per page
```