# EventHub API documentation

REST API for the Event Ticketing and Venue Booking System. Every request and response body is JSON.

## Overview

| Item | Value |
|---|---|
| Base URL (local) | `http://127.0.0.1:8000/api` |
| User authentication | JWT. Log in, then send `Authorization: Bearer <token>` |
| Machine authentication | `X-API-Key` header, used only by `/api/tickets/{reference}` |
| Roles | `admin`, `organiser`, `staff`, `customer` |
| Rate limits | 120 requests a minute per user (per IP for guests). Login: 5 attempts a minute per email and IP |
| Date format | `YYYY-MM-DD HH:MM:SS`, Malaysian time (Asia/Kuala_Lumpur) |

### Response format

- **One item:** `{ "message": "...", "data": { ... } }`. `message` is present on create, update and delete.
- **Lists:** paginated. `data` holds the items, next to `current_page`, `per_page`, `total`, `last_page` and page links.
- **Errors:** `{ "message": "..." }`. Validation errors add an `errors` object with one entry per field.

### Status codes

| Code | Meaning in this API |
|---|---|
| 200 | Success |
| 201 | Created |
| 401 | Not logged in, or the token or API key is missing or invalid |
| 403 | Logged in, but the role or ownership does not allow the action |
| 404 | Resource or URL not found |
| 405 | HTTP method not supported for the URL |
| 409 | The request breaks a business rule |
| 422 | Validation failed |
| 429 | Rate limit reached |
| 500 | Unexpected server error |
| 502 | The third-party QR code service failed |

### Endpoint summary

| # | Method | URL | Access | Purpose |
|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | Public | Create a customer account and receive a token. |
| 2 | POST | `/api/auth/login` | Public | Exchange an email and password for a JWT. |
| 3 | GET | `/api/auth/me` | Any logged-in user | Return the logged-in user. |
| 4 | POST | `/api/auth/refresh` | Any logged-in user | Swap the current token for a new one. The old token stops working. |
| 5 | POST | `/api/auth/logout` | Any logged-in user | Blacklist the current token. |
| 6 | GET | `/api/users` | Admin | List users with search, filtering, sorting and pagination. |
| 7 | POST | `/api/users` | Admin | Create a user with any role. |
| 8 | GET | `/api/users/{id}` | Admin | Return one user. |
| 9 | PUT | `/api/users/{id}` | Admin | Update a user. Only the fields sent are changed. |
| 10 | DELETE | `/api/users/{id}` | Admin | Delete a user. |
| 11 | GET | `/api/venues` | Public | List venues with search, filtering, sorting and pagination. |
| 12 | GET | `/api/venues/{id}` | Public | Return one venue with its number of events. |
| 13 | POST | `/api/venues` | Admin, organiser | Create a venue. |
| 14 | PUT | `/api/venues/{id}` | Admin, organiser | Update a venue. Only the fields sent are changed. |
| 15 | DELETE | `/api/venues/{id}` | Admin | Delete a venue that has no events. |
| 16 | GET | `/api/events` | Public | List events with search, filtering, sorting and pagination. |
| 17 | GET | `/api/events/{id}` | Public | Return one event with its venue and organiser. |
| 18 | POST | `/api/events` | Admin, organiser | Create an event. It starts with every ticket available. |
| 19 | PUT | `/api/events/{id}` | Admin, or the organiser who owns the event | Update, publish or cancel an event. Only the fields sent are changed. |
| 20 | DELETE | `/api/events/{id}` | Admin, or the organiser who owns the event | Delete an event that has no bookings. |
| 21 | GET | `/api/bookings` | Any logged-in user | List the bookings the caller is allowed to see. |
| 22 | POST | `/api/bookings` | Customer | Book tickets for a published event. |
| 23 | GET | `/api/bookings/{id}` | Any logged-in user who may see it | Return one booking with its event, venue and customer. |
| 24 | PUT | `/api/bookings/{id}` | Customer (own booking), staff, admin, or the event's organiser | Cancel a booking or check the customer in. |
| 25 | DELETE | `/api/bookings/{id}` | Admin | Delete a cancelled booking. |
| 26 | GET | `/api/bookings/{id}/qr` | Any logged-in user who may see the booking | Return the booking's QR code. The backend requests it from the goQR.me web API. |
| 27 | GET | `/api/tickets/{reference}` | API key (`X-API-Key` header) | Check a booking reference, for example from a scanned QR code. For external systems such as a door scanner. |

`PATCH` is accepted wherever `PUT` is listed.

## 1. Authentication

### 1. Register

`POST /api/auth/register`

- **Purpose:** Create a customer account and receive a token.
- **Access:** Public
- **Notes:** New accounts are always customers. A `role` field in the body is ignored.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Up to 255 characters. |
| `email` | string | Yes | Must be unique. |
| `password` | string | Yes | At least 8 characters. |
| `password_confirmation` | string | Yes | Must match `password`. |
| `phone` | string | No | Up to 20 characters. |

**Status codes**

| Code | When |
|---|---|
| 201 | Account created |
| 422 | Validation failed |
| 429 | Too many requests |

**Sample response (201)**

```json
{
  "message": "Registration successful.",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...(shortened)",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "name": "Postman Tester",
      "email": "postman.1791654092940@eventhub.test",
      "phone": "012-555 0200",
      "role": "customer",
      "updated_at": "2026-10-11 01:41:33",
      "created_at": "2026-10-11 01:41:33",
      "id": 8
    }
  }
}
```

**Sample error (422)**

```json
{
  "message": "The name field is required. (and 3 more errors)",
  "errors": {
    "name": [
      "The name field is required."
    ],
    "email": [
      "The email field must be a valid email address."
    ],
    "password": [
      "The password field confirmation does not match.",
      "The password field must be at least 8 characters."
    ]
  }
}
```

### 2. Login

`POST /api/auth/login`

- **Purpose:** Exchange an email and password for a JWT.
- **Access:** Public
- **Notes:** The token lasts 60 minutes. Send it on protected requests as `Authorization: Bearer <token>`.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes |  |
| `password` | string | Yes |  |

**Status codes**

| Code | When |
|---|---|
| 200 | Logged in |
| 401 | Wrong email or password |
| 422 | Validation failed |
| 429 | More than 5 attempts in a minute |

**Sample response (200)**

```json
{
  "message": "Login successful.",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...(shortened)",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 5,
      "name": "Siti Aminah",
      "email": "siti@eventhub.test",
      "email_verified_at": null,
      "role": "customer",
      "phone": "012-555 0105",
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31"
    }
  }
}
```

**Sample error (401)**

```json
{
  "message": "Invalid email or password."
}
```

### 3. My profile

`GET /api/auth/me`

- **Purpose:** Return the logged-in user.
- **Access:** Any logged-in user

**Request parameters and body:** none.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Missing, invalid or expired token |

**Sample response (200)**

```json
{
  "data": {
    "id": 5,
    "name": "Siti Aminah",
    "email": "siti@eventhub.test",
    "email_verified_at": null,
    "role": "customer",
    "phone": "012-555 0105",
    "created_at": "2026-10-11 01:41:31",
    "updated_at": "2026-10-11 01:41:31"
  }
}
```

**Sample error (401)**

```json
{
  "message": "Unauthenticated. Log in and send a valid token."
}
```

### 4. Refresh token

`POST /api/auth/refresh`

- **Purpose:** Swap the current token for a new one. The old token stops working.
- **Access:** Any logged-in user

**Request parameters and body:** none.

**Status codes**

| Code | When |
|---|---|
| 200 | New token issued |
| 401 | Missing, invalid or expired token |

**Sample response (200)**

```json
{
  "message": "Token refreshed.",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...(shortened)",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 5,
      "name": "Siti Aminah",
      "email": "siti@eventhub.test",
      "email_verified_at": null,
      "role": "customer",
      "phone": "012-555 0105",
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31"
    }
  }
}
```

### 5. Logout

`POST /api/auth/logout`

- **Purpose:** Blacklist the current token.
- **Access:** Any logged-in user

**Request parameters and body:** none.

**Status codes**

| Code | When |
|---|---|
| 200 | Logged out |
| 401 | Missing, invalid or expired token |

**Sample response (200)**

```json
{
  "message": "Logged out successfully."
}
```

**Sample error (401)**

```json
{
  "message": "Unauthenticated. Log in and send a valid token."
}
```

## 2. Users

### 6. List users

`GET /api/users`

- **Purpose:** List users with search, filtering, sorting and pagination.
- **Access:** Admin

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Matches name or email. |
| `role` | string | No | `admin`, `organiser`, `staff` or `customer`. |
| `sort` | string | No | `id`, `name`, `email`, `role` or `created_at`. Default `id`. |
| `page` | integer | No | Page number. Default 1. |
| `per_page` | integer | No | Items per page, 1 to 100. Default 10. |
| `direction` | string | No | `asc` or `desc`. |

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Not an admin |
| 422 | Invalid filter |

**Sample response (200)**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 1,
      "name": "Nur Aisyah Rahman",
      "email": "admin@eventhub.test",
      "email_verified_at": null,
      "role": "admin",
      "phone": "012-555 0101",
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31"
    }
  ],
  "first_page_url": "http://127.0.0.1:8000/api/users?page=1",
  "from": 1,
  "last_page": 2,
  "last_page_url": "http://127.0.0.1:8000/api/users?page=2",
  "links": [ "...page links..." ],
  "next_page_url": "http://127.0.0.1:8000/api/users?page=2",
  "path": "http://127.0.0.1:8000/api/users",
  "per_page": 5,
  "prev_page_url": null,
  "to": 5,
  "total": 8
}
```

**Sample error (403)**

```json
{
  "message": "Forbidden. Your role is not allowed to do this."
}
```

### 7. Create user

`POST /api/users`

- **Purpose:** Create a user with any role.
- **Access:** Admin

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes |  |
| `email` | string | Yes | Must be unique. |
| `password` | string | Yes | At least 8 characters. |
| `role` | string | Yes | `admin`, `organiser`, `staff` or `customer`. |
| `phone` | string | No |  |

**Status codes**

| Code | When |
|---|---|
| 201 | Created |
| 401 | Not logged in |
| 403 | Not an admin |
| 422 | Validation failed |

**Sample response (201)**

```json
{
  "message": "User created.",
  "data": {
    "name": "Aiman Hakim",
    "email": "aiman.1791654092940@eventhub.test",
    "phone": "012-555 0199",
    "role": "staff",
    "updated_at": "2026-10-11 01:41:37",
    "created_at": "2026-10-11 01:41:37",
    "id": 9
  }
}
```

**Sample error (422)**

```json
{
  "message": "The name field is required. (and 3 more errors)",
  "errors": {
    "name": [
      "The name field is required."
    ],
    "email": [
      "The email has already been taken."
    ],
    "password": [
      "The password field must be at least 8 characters."
    ],
    "role": [
      "The selected role is invalid."
    ]
  }
}
```

### 8. Get user

`GET /api/users/{id}`

- **Purpose:** Return one user.
- **Access:** Admin

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Not an admin |
| 404 | User not found |

**Sample response (200)**

```json
{
  "data": {
    "id": 9,
    "name": "Aiman Hakim",
    "email": "aiman.1791654092940@eventhub.test",
    "email_verified_at": null,
    "role": "staff",
    "phone": "012-555 0199",
    "created_at": "2026-10-11 01:41:37",
    "updated_at": "2026-10-11 01:41:37"
  }
}
```

**Sample error (404)**

```json
{
  "message": "Resource not found."
}
```

### 9. Update user

`PUT /api/users/{id}`

- **Purpose:** Update a user. Only the fields sent are changed.
- **Access:** Admin

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No |  |
| `email` | string | No | Must be unique. |
| `password` | string | No | At least 8 characters. |
| `role` | string | No |  |
| `phone` | string | No |  |

**Status codes**

| Code | When |
|---|---|
| 200 | Updated |
| 401 | Not logged in |
| 403 | Not an admin |
| 404 | User not found |
| 409 | An admin cannot change their own role |
| 422 | Validation failed |

**Sample response (200)**

```json
{
  "message": "User updated.",
  "data": {
    "id": 9,
    "name": "Aiman Hakim Updated",
    "email": "aiman.1791654092940@eventhub.test",
    "email_verified_at": null,
    "role": "organiser",
    "phone": "012-555 0199",
    "created_at": "2026-10-11 01:41:37",
    "updated_at": "2026-10-11 01:41:37"
  }
}
```

**Sample error (409)**

```json
{
  "message": "You cannot change your own role."
}
```

### 10. Delete user

`DELETE /api/users/{id}`

- **Purpose:** Delete a user.
- **Access:** Admin

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | Deleted |
| 401 | Not logged in |
| 403 | Not an admin |
| 404 | User not found |
| 409 | User has events or bookings, or is the admin's own account |

**Sample response (200)**

```json
{
  "message": "User deleted."
}
```

**Sample error (409)**

```json
{
  "message": "This user has events or bookings and cannot be deleted."
}
```

## 3. Venues

### 11. List venues

`GET /api/venues`

- **Purpose:** List venues with search, filtering, sorting and pagination.
- **Access:** Public

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Matches name, address or city. |
| `city` | string | No | Exact city. |
| `min_capacity` | integer | No | Smallest capacity to include. |
| `sort` | string | No | `id`, `name`, `city`, `capacity` or `created_at`. Default `name`. |
| `page` | integer | No | Page number. Default 1. |
| `per_page` | integer | No | Items per page, 1 to 100. Default 10. |
| `direction` | string | No | `asc` or `desc`. |

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 422 | Invalid filter |

**Sample response (200)**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 4,
      "name": "Dataran Tasik Open Stage",
      "address": "Presint 2",
      "city": "Putrajaya",
      "capacity": 3000,
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31"
    }
  ],
  "first_page_url": "http://127.0.0.1:8000/api/venues?page=1",
  "from": 1,
  "last_page": 1,
  "last_page_url": "http://127.0.0.1:8000/api/venues?page=1",
  "links": [ "...page links..." ],
  "next_page_url": null,
  "path": "http://127.0.0.1:8000/api/venues",
  "per_page": 10,
  "prev_page_url": null,
  "to": 2,
  "total": 2
}
```

### 12. Get venue

`GET /api/venues/{id}`

- **Purpose:** Return one venue with its number of events.
- **Access:** Public

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 404 | Venue not found |

**Sample response (200)**

```json
{
  "data": {
    "id": 1,
    "name": "Dewan Seri Budaya",
    "address": "12 Jalan Merpati",
    "city": "Kuala Lumpur",
    "capacity": 800,
    "created_at": "2026-10-11 01:41:31",
    "updated_at": "2026-10-11 01:41:31",
    "events_count": 2
  }
}
```

### 13. Create venue

`POST /api/venues`

- **Purpose:** Create a venue.
- **Access:** Admin, organiser

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Up to 150 characters. Unique within a city. |
| `address` | string | Yes |  |
| `city` | string | Yes |  |
| `capacity` | integer | Yes | At least 1. |

**Status codes**

| Code | When |
|---|---|
| 201 | Created |
| 401 | Not logged in |
| 403 | Role not allowed |
| 422 | Validation failed, or the name already exists in that city |

**Sample response (201)**

```json
{
  "message": "Venue created.",
  "data": {
    "name": "Postman Hall 1791654092940",
    "address": "1 Jalan Ujian",
    "city": "Shah Alam",
    "capacity": 300,
    "updated_at": "2026-10-11 01:41:37",
    "created_at": "2026-10-11 01:41:37",
    "id": 6
  }
}
```

**Sample error (422)**

```json
{
  "message": "A venue with this name already exists in this city.",
  "errors": {
    "name": [
      "A venue with this name already exists in this city."
    ]
  }
}
```

### 14. Update venue

`PUT /api/venues/{id}`

- **Purpose:** Update a venue. Only the fields sent are changed.
- **Access:** Admin, organiser

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | No |  |
| `address` | string | No |  |
| `city` | string | No |  |
| `capacity` | integer | No |  |

**Status codes**

| Code | When |
|---|---|
| 200 | Updated |
| 401 | Not logged in |
| 403 | Role not allowed |
| 404 | Venue not found |
| 409 | Capacity is lower than an active event's ticket total |
| 422 | Validation failed |

**Sample response (200)**

```json
{
  "message": "Venue updated.",
  "data": {
    "id": 6,
    "name": "Postman Hall 1791654092940",
    "address": "1 Jalan Ujian",
    "city": "Shah Alam",
    "capacity": 350,
    "created_at": "2026-10-11 01:41:37",
    "updated_at": "2026-10-11 01:41:38"
  }
}
```

**Sample error (409)**

```json
{
  "message": "Capacity cannot be lower than 600, the ticket total of an event at this venue."
}
```

### 15. Delete venue

`DELETE /api/venues/{id}`

- **Purpose:** Delete a venue that has no events.
- **Access:** Admin

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | Deleted |
| 401 | Not logged in |
| 403 | Not an admin |
| 404 | Venue not found |
| 409 | Venue has events |

**Sample response (200)**

```json
{
  "message": "Venue deleted."
}
```

**Sample error (409)**

```json
{
  "message": "This venue has events and cannot be deleted."
}
```

## 4. Events

### 16. List events

`GET /api/events`

- **Purpose:** List events with search, filtering, sorting and pagination.
- **Access:** Public
- **Notes:** Guests and customers only see published events. Admins, organisers and staff see every status.

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Matches title or description. |
| `category` | string | No | Exact category. |
| `venue_id` | integer | No |  |
| `status` | string | No | `draft`, `published` or `cancelled`. Admin, organiser and staff only. |
| `organiser_id` | integer | No | Events owned by this organiser. Admin, organiser and staff only. |
| `date_from` | date | No | Events starting on or after this date. |
| `date_to` | date | No | Events starting on or before this date. |
| `available_only` | boolean | No | `1` to hide sold-out events. |
| `sort` | string | No | `id`, `title`, `starts_at`, `ticket_price` or `created_at`. Default `starts_at`. |
| `page` | integer | No | Page number. Default 1. |
| `per_page` | integer | No | Items per page, 1 to 100. Default 10. |
| `direction` | string | No | `asc` or `desc`. |

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 422 | Invalid filter |

**Sample response (200)**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 3,
      "venue_id": 3,
      "organiser_id": 3,
      "title": "Teater Bangsawan Puteri Saadong",
      "description": "Teater Bangsawan Puteri Saadong at a venue near you. Sample event for testing.",
      "category": "Theatre",
      "starts_at": "2026-12-05 20:30:00",
      "ends_at": "2026-12-05 22:30:00",
      "ticket_price": "45.00",
      "total_tickets": 250,
      "available_tickets": 245,
      "status": "published",
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31",
      "venue": {
        "id": 3,
        "name": "Pentas Teater Kecil",
        "city": "George Town"
      },
      "organiser": {
        "id": 3,
        "name": "Priya Nair"
      }
    }
  ],
  "first_page_url": "http://127.0.0.1:8000/api/events?page=1",
  "from": 1,
  "last_page": 1,
  "last_page_url": "http://127.0.0.1:8000/api/events?page=1",
  "links": [ "...page links..." ],
  "next_page_url": null,
  "path": "http://127.0.0.1:8000/api/events",
  "per_page": 5,
  "prev_page_url": null,
  "to": 3,
  "total": 3
}
```

**Sample error (422)**

```json
{
  "message": "The date from field must be a valid date. (and 1 more error)",
  "errors": {
    "date_from": [
      "The date from field must be a valid date."
    ],
    "sort": [
      "The selected sort is invalid."
    ]
  }
}
```

### 17. Get event

`GET /api/events/{id}`

- **Purpose:** Return one event with its venue and organiser.
- **Access:** Public

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 404 | Event not found, or not published and the caller is a guest or customer |

**Sample response (200)**

```json
{
  "data": {
    "id": 2,
    "venue_id": 2,
    "organiser_id": 2,
    "title": "Tech Career Fair 2026",
    "description": "Tech Career Fair 2026 at a venue near you. Sample event for testing.",
    "category": "Conference",
    "starts_at": "2026-11-21 09:00:00",
    "ends_at": "2026-11-21 17:00:00",
    "ticket_price": "0.00",
    "total_tickets": 1500,
    "available_tickets": 1499,
    "status": "published",
    "created_at": "2026-10-11 01:41:31",
    "updated_at": "2026-10-11 01:41:31",
    "venue": {
      "id": 2,
      "name": "Laman Kota Convention Hall",
      "address": "3 Persiaran Tasik",
      "city": "Shah Alam",
      "capacity": 1500,
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31"
    },
    "organiser": {
      "id": 2,
      "name": "Daniel Lim"
    }
  }
}
```

**Sample error (404)**

```json
{
  "message": "Resource not found."
}
```

### 18. Create event

`POST /api/events`

- **Purpose:** Create an event. It starts with every ticket available.
- **Access:** Admin, organiser

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `venue_id` | integer | Yes | An existing venue. |
| `title` | string | Yes | Up to 150 characters. |
| `description` | string | No |  |
| `category` | string | Yes | Up to 50 characters. |
| `starts_at` | datetime | Yes | In the future, for example `2027-06-15 20:00:00`. |
| `ends_at` | datetime | Yes | After `starts_at`. |
| `ticket_price` | number | Yes | 0 or more. |
| `total_tickets` | integer | Yes | At least 1 and no more than the venue capacity. |
| `status` | string | No | `draft` (default) or `published`. |
| `organiser_id` | integer | No | Admin only: the organiser who owns the event. |

**Status codes**

| Code | When |
|---|---|
| 201 | Created |
| 401 | Not logged in |
| 403 | Role not allowed |
| 409 | Another active event overlaps at that venue |
| 422 | Validation failed, or more tickets than the venue holds |

**Sample response (201)**

```json
{
  "message": "Event created.",
  "data": {
    "venue_id": 6,
    "title": "Postman Launch Night",
    "description": "Created by the Postman collection.",
    "category": "Music",
    "starts_at": "2027-06-15 20:00:00",
    "ends_at": "2027-06-15 23:00:00",
    "ticket_price": "25.50",
    "total_tickets": 5,
    "organiser_id": 2,
    "available_tickets": 5,
    "status": "draft",
    "updated_at": "2026-10-11 01:41:38",
    "created_at": "2026-10-11 01:41:38",
    "id": 7,
    "venue": {
      "id": 6,
      "name": "Postman Hall 1791654092940",
      "city": "Shah Alam"
    },
    "organiser": {
      "id": 2,
      "name": "Daniel Lim"
    }
  }
}
```

**Sample error (409)**

```json
{
  "message": "The venue is already booked for \"Postman Launch Night\" at that time."
}
```

### 19. Update event

`PUT /api/events/{id}`

- **Purpose:** Update, publish or cancel an event. Only the fields sent are changed.
- **Access:** Admin, or the organiser who owns the event
- **Notes:** Setting `status` to `cancelled` also cancels the event's confirmed bookings and returns every ticket. A cancelled event cannot be changed again.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `venue_id, title, description, category, starts_at, ends_at, ticket_price, total_tickets` |  | No | Same rules as Create event. |
| `status` | string | No | `draft`, `published` or `cancelled`. |

**Status codes**

| Code | When |
|---|---|
| 200 | Updated |
| 401 | Not logged in |
| 403 | Not the owner |
| 404 | Event not found |
| 409 | Event is cancelled, schedule clash, or total below tickets already booked |
| 422 | Validation failed |

**Sample response (200)**

```json
{
  "message": "Event updated.",
  "data": {
    "id": 7,
    "venue_id": 6,
    "organiser_id": 2,
    "title": "Postman Launch Night",
    "description": "Created by the Postman collection.",
    "category": "Music",
    "starts_at": "2027-06-15 20:00:00",
    "ends_at": "2027-06-15 23:00:00",
    "ticket_price": "25.50",
    "total_tickets": 5,
    "available_tickets": 5,
    "status": "published",
    "created_at": "2026-10-11 01:41:38",
    "updated_at": "2026-10-11 01:41:39",
    "venue": {
      "id": 6,
      "name": "Postman Hall 1791654092940",
      "city": "Shah Alam"
    },
    "organiser": {
      "id": 2,
      "name": "Daniel Lim"
    }
  }
}
```

**Sample error (403)**

```json
{
  "message": "Forbidden. You can only manage your own events."
}
```

### 20. Delete event

`DELETE /api/events/{id}`

- **Purpose:** Delete an event that has no bookings.
- **Access:** Admin, or the organiser who owns the event

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | Deleted |
| 401 | Not logged in |
| 403 | Not the owner |
| 404 | Event not found |
| 409 | Event has bookings |

**Sample response (200)**

```json
{
  "message": "Event deleted."
}
```

**Sample error (409)**

```json
{
  "message": "This event has bookings. Cancel the event instead of deleting it."
}
```

## 5. Bookings

### 21. List bookings

`GET /api/bookings`

- **Purpose:** List the bookings the caller is allowed to see.
- **Access:** Any logged-in user
- **Notes:** A customer sees their own bookings. An organiser sees bookings for their own events. Admins and staff see all bookings.

**Query parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `search` | string | No | Matches booking reference, customer name or email, or event title. |
| `status` | string | No | `confirmed`, `cancelled` or `checked_in`. |
| `event_id` | integer | No |  |
| `sort` | string | No | `id`, `created_at`, `quantity`, `total_price` or `status`. Default `id`, newest first. |
| `page` | integer | No | Page number. Default 1. |
| `per_page` | integer | No | Items per page, 1 to 100. Default 10. |
| `direction` | string | No | `asc` or `desc`. |

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 422 | Invalid filter |

**Sample response (200)**

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 7,
      "user_id": 5,
      "event_id": 4,
      "booking_reference": "BK-W3F6DN9J",
      "quantity": 5,
      "total_price": "150.00",
      "status": "confirmed",
      "created_at": "2026-10-11 01:41:31",
      "updated_at": "2026-10-11 01:41:31",
      "event": {
        "id": 4,
        "venue_id": 4,
        "title": "Putrajaya Food and Music Festival",
        "starts_at": "2026-12-19 16:00:00",
        "ends_at": "2026-12-19 23:00:00",
        "ticket_price": "30.00",
        "status": "published",
        "venue": {
          "id": 4,
          "name": "Dataran Tasik Open Stage",
          "city": "Putrajaya"
        }
      },
      "user": {
        "id": 5,
        "name": "Siti Aminah",
        "email": "siti@eventhub.test"
      }
    }
  ],
  "first_page_url": "http://127.0.0.1:8000/api/bookings?page=1",
  "from": 1,
  "last_page": 2,
  "last_page_url": "http://127.0.0.1:8000/api/bookings?page=2",
  "links": [ "...page links..." ],
  "next_page_url": "http://127.0.0.1:8000/api/bookings?page=2",
  "path": "http://127.0.0.1:8000/api/bookings",
  "per_page": 5,
  "prev_page_url": null,
  "to": 5,
  "total": 6
}
```

**Sample error (401)**

```json
{
  "message": "Unauthenticated. Log in and send a valid token."
}
```

### 22. Create booking

`POST /api/bookings`

- **Purpose:** Book tickets for a published event.
- **Access:** Customer
- **Notes:** The server sets `total_price` (quantity x ticket price) and creates the booking reference.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | integer | Yes | An existing event. |
| `quantity` | integer | Yes | 1 to 10. |

**Status codes**

| Code | When |
|---|---|
| 201 | Booking confirmed |
| 401 | Not logged in |
| 403 | Not a customer |
| 409 | Event not open, already started, or not enough tickets |
| 422 | Validation failed |

**Sample response (201)**

```json
{
  "message": "Booking confirmed.",
  "data": {
    "event_id": 7,
    "quantity": 2,
    "user_id": 5,
    "booking_reference": "BK-XNPZSRA7",
    "total_price": "51.00",
    "status": "confirmed",
    "updated_at": "2026-10-11 01:41:39",
    "created_at": "2026-10-11 01:41:39",
    "id": 9,
    "event": {
      "id": 7,
      "venue_id": 6,
      "title": "Postman Launch Night",
      "starts_at": "2027-06-15 20:00:00",
      "ends_at": "2027-06-15 23:00:00",
      "ticket_price": "25.50",
      "status": "published",
      "venue": {
        "id": 6,
        "name": "Postman Hall 1791654092940",
        "city": "Shah Alam"
      }
    },
    "user": {
      "id": 5,
      "name": "Siti Aminah",
      "email": "siti@eventhub.test"
    }
  }
}
```

**Sample error (409)**

```json
{
  "message": "Only 3 tickets are left for this event."
}
```

### 23. Get booking

`GET /api/bookings/{id}`

- **Purpose:** Return one booking with its event, venue and customer.
- **Access:** Any logged-in user who may see it

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Not allowed to see this booking |
| 404 | Booking not found |

**Sample response (200)**

```json
{
  "data": {
    "id": 9,
    "user_id": 5,
    "event_id": 7,
    "booking_reference": "BK-XNPZSRA7",
    "quantity": 2,
    "total_price": "51.00",
    "status": "confirmed",
    "created_at": "2026-10-11 01:41:39",
    "updated_at": "2026-10-11 01:41:39",
    "event": {
      "id": 7,
      "venue_id": 6,
      "title": "Postman Launch Night",
      "starts_at": "2027-06-15 20:00:00",
      "ends_at": "2027-06-15 23:00:00",
      "ticket_price": "25.50",
      "status": "published",
      "venue": {
        "id": 6,
        "name": "Postman Hall 1791654092940",
        "city": "Shah Alam"
      }
    },
    "user": {
      "id": 5,
      "name": "Siti Aminah",
      "email": "siti@eventhub.test"
    }
  }
}
```

**Sample error (403)**

```json
{
  "message": "Forbidden. You cannot access this booking."
}
```

### 24. Update booking

`PUT /api/bookings/{id}`

- **Purpose:** Cancel a booking or check the customer in.
- **Access:** Customer (own booking), staff, admin, or the event's organiser
- **Notes:** A customer may only cancel, and only before the event starts. Cancelling returns the tickets to the event.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | Yes | `cancelled` or `checked_in`. |

**Status codes**

| Code | When |
|---|---|
| 200 | Updated |
| 401 | Not logged in |
| 403 | Not allowed, or a customer trying to check in |
| 404 | Booking not found |
| 409 | Booking already cancelled or checked in, or the event has started |
| 422 | Invalid status |

**Sample response (200)**

```json
{
  "message": "Customer checked in.",
  "data": {
    "id": 10,
    "user_id": 6,
    "event_id": 7,
    "booking_reference": "BK-ZUEM0RUY",
    "quantity": 1,
    "total_price": "25.50",
    "status": "checked_in",
    "created_at": "2026-10-11 01:41:39",
    "updated_at": "2026-10-11 01:41:40",
    "event": {
      "id": 7,
      "venue_id": 6,
      "title": "Postman Launch Night",
      "starts_at": "2027-06-15 20:00:00",
      "ends_at": "2027-06-15 23:00:00",
      "ticket_price": "25.50",
      "status": "published",
      "venue": {
        "id": 6,
        "name": "Postman Hall 1791654092940",
        "city": "Shah Alam"
      }
    },
    "user": {
      "id": 6,
      "name": "Jason Tan",
      "email": "jason@eventhub.test"
    }
  }
}
```

**Sample error (409)**

```json
{
  "message": "This booking is already cancelled."
}
```

### 25. Delete booking

`DELETE /api/bookings/{id}`

- **Purpose:** Delete a cancelled booking.
- **Access:** Admin

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | Deleted |
| 401 | Not logged in |
| 403 | Not an admin |
| 404 | Booking not found |
| 409 | Booking is not cancelled |

**Sample response (200)**

```json
{
  "message": "Booking deleted."
}
```

**Sample error (409)**

```json
{
  "message": "Only cancelled bookings can be deleted. Cancel the booking first."
}
```

### 26. Get booking QR code

`GET /api/bookings/{id}/qr`

- **Purpose:** Return the booking's QR code. The backend requests it from the goQR.me web API.
- **Access:** Any logged-in user who may see the booking
- **Notes:** `qr_code` is a PNG as a base64 data URI, ready for an `<img>` tag. It encodes the booking reference. The image is cached for one day; `from_cache` shows whether the external API was called.

**Request parameters and body:** none besides the `{id}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Not allowed to see this booking |
| 404 | Booking not found |
| 502 | The QR code service did not respond |

**Sample response (200)**

```json
{
  "data": {
    "booking_id": 9,
    "booking_reference": "BK-XNPZSRA7",
    "status": "confirmed",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...(shortened)",
    "provider": "goQR.me (api.qrserver.com)",
    "from_cache": false
  }
}
```

## 6. Tickets

### 27. Verify ticket

`GET /api/tickets/{reference}`

- **Purpose:** Check a booking reference, for example from a scanned QR code. For external systems such as a door scanner.
- **Access:** API key (`X-API-Key` header)

**Request parameters and body:** none besides the `{reference}` in the URL.

**Status codes**

| Code | When |
|---|---|
| 200 | Ticket found. `valid` is true only for a confirmed booking |
| 401 | Missing or wrong API key |
| 404 | No booking has this reference |

**Sample response (200)**

```json
{
  "data": {
    "valid": true,
    "booking_reference": "BK-B9V3LK7E",
    "status": "confirmed",
    "quantity": 1,
    "holder": "Siti Aminah",
    "event": "Tech Career Fair 2026",
    "venue": "Laman Kota Convention Hall",
    "starts_at": "2026-11-21 09:00:00"
  }
}
```

**Sample error (401)**

```json
{
  "message": "Invalid or missing API key."
}
```
