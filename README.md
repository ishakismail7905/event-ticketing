# EventHub: Event Ticketing and Venue Booking REST API

Final project for SWC3633/SWC4443 Web API Development, Universiti Poly-Tech Malaysia.

EventHub is a RESTful web API for managing venues, events, ticket availability and customer bookings. Organisers publish events at venues, customers book and cancel tickets, and staff check customers in. One shared backend serves a separate frontend for each group member.

## Team

| Name | Student ID |
|---|---|
| ISHAK BIN ISMAIL | AM2512021928 |
| MUHAMMAD SHIHABUDDIN AL-FIKRI BIN ANUAR | AM2512021974 | 
| AHMAD NAUFAL BIN AHMAD FUAD | AM2512021850 |
| MUHAMMAD ANAS BIN HADDRI | AM2512021976 |

## Links

- Project report: _to be added as `docs/report.pdf`_
- Demonstration video: https://youtu.be/_c6sfGLXplU
- API documentation: [docs/API.md](docs/API.md)
- Entity relationship diagram: [database/erd.md](database/erd.md)

## Repository contents

| Path | Contents |
|---|---|
| `backend/` | Shared Laravel 13 REST API |
| `database/` | ERD, DDL script (`01_ddl.sql`) and DML script (`02_dml.sql`) |
| `docs/` | API documentation |
| `postman/` | Exported Postman collection: 96 requests with success and error cases |

## Features

| Area | Implementation |
|---|---|
| Resources | `/users`, `/venues`, `/events`, `/bookings`, plus `/auth` and `/tickets` |
| Authentication | JSON Web Tokens (`php-open-source-saver/jwt-auth`) |
| Role-based access | `admin`, `organiser`, `staff`, `customer`, enforced by route middleware |
| API key protection | `X-API-Key` header on the ticket verification endpoint |
| Validation | Every request is validated. Errors return 422 with a message per field |
| Error handling | One central handler returns the same JSON shape for every error |
| Third-party API | goQR.me web API generates the QR code for each booking |
| Rate limiting | 120 requests a minute per user, and 5 login attempts a minute |
| Logging | Middleware writes each API request to `storage/logs/api.log` |
| List endpoints | Pagination, search, filtering and sorting |

## Requirements

- PHP 8.4 or newer, with the `pdo_mysql`, `mbstring`, `xml`, `curl`, `openssl` and `sodium` extensions
- Composer 2
- MySQL 8 or MariaDB 10.4 or newer
- Git

XAMPP's bundled PHP (8.2) is too old for this project. XAMPP's database can still be used together with a newer PHP.

## Backend setup

Run these commands in a terminal. On Windows, use `copy` where it says `cp`.

**1. Get the code and install the packages.**

```bash
git clone https://github.com/ishakismail7905/event-ticketing.git
cd event-ticketing/backend
composer install
```

**2. Create the settings file and its keys.**

```bash
cp .env.example .env
php artisan key:generate
php artisan jwt:secret --force
```

Then open `backend/.env` in an editor and:

- type any long random text after `EVENTHUB_API_KEY=`
- change `DB_USERNAME` and `DB_PASSWORD` if your database login differs from `root` with no password

**3. Create the database.** In your database client (for example phpMyAdmin or the `mysql` command), run:

```sql
CREATE DATABASE eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**4. Create the tables and sample data, then start the server.**

```bash
php artisan migrate:fresh --seed
php artisan serve
```

The API is now at `http://127.0.0.1:8000/api`. Opening `http://127.0.0.1:8000/api/events` in a browser should show a list of events.

`php artisan migrate:fresh --seed` can be run again at any time to reset the database to the sample data.

## Sample accounts

Every sample account uses the password `password`.

| Role | Email |
|---|---|
| Admin | `admin@eventhub.test` |
| Organiser | `daniel@eventhub.test`, `priya@eventhub.test` |
| Staff | `hafiz@eventhub.test` |
| Customer | `siti@eventhub.test`, `jason@eventhub.test`, `kavitha@eventhub.test` |

## Running the API tests

With the server running and the sample data freshly reset, run the Postman collection from the project root. Replace `YOUR_KEY` with the `EVENTHUB_API_KEY` value from `backend/.env`.

```bash
npx --yes newman run postman/EventHub.postman_collection.json --env-var api_key=YOUR_KEY
```

The run should finish with 134 assertions and 0 failures. The same collection can be imported into the Postman app. Wait a minute between full runs, because login is rate limited.

## Database scripts

The scripts in `database/` rebuild the four core tables without Laravel:

```bash
mysql -u root -e "CREATE DATABASE eventhub_check CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root eventhub_check < database/01_ddl.sql
mysql -u root eventhub_check < database/02_dml.sql
```

## Frontends

Each group member builds a separate frontend that uses this API. Each one will be added in its own folder, with its run instructions listed here.
