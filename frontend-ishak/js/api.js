// Every request to the backend goes through this file.
// It adds the JWT, turns the reply into JSON and turns every failure into one kind of error.

import { API_BASE } from './config.js';
import { getToken, clearSession } from './session.js';

/** An API failure: the HTTP status, a readable message and any field errors. */
export class ApiError extends Error {
    constructor(status, message, errors = {}) {
        super(message);
        this.status = status;
        this.errors = errors; // e.g. { email: ['The email has already been taken.'] }
    }
}

/**
 * Send a request to the API.
 * @param {string} method  GET, POST, PUT or DELETE
 * @param {string} path    e.g. '/events' or '/bookings/3'
 * @param {object} [options]
 * @param {object} [options.query]  values added to the URL as ?key=value
 * @param {object} [options.body]   sent as JSON
 */
export async function api(method, path, { query, body } = {}) {
    const url = new URL(API_BASE + path);

    for (const [key, value] of Object.entries(query || {})) {
        if (value !== '' && value !== null && value !== undefined && value !== false) {
            url.searchParams.set(key, value === true ? '1' : value);
        }
    }

    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (networkError) {
        // fetch only throws when the server could not be reached at all.
        throw new ApiError(0, 'Cannot reach the server. Check that the backend is running, then try again.');
    }

    let data = null;
    try {
        data = await response.json();
    } catch (notJson) {
        data = null;
    }

    if (response.ok) {
        return data;
    }

    // 401 while logged in means the token expired or was logged out elsewhere.
    if (response.status === 401 && token) {
        clearSession();
        window.dispatchEvent(new CustomEvent('session-expired'));
    }

    const fallback = {
        401: 'Please log in to continue.',
        403: 'You are not allowed to do this.',
        404: 'This item could not be found.',
        429: 'Too many requests. Wait a minute and try again.',
    }[response.status] || 'Something went wrong on the server. Please try again.';

    throw new ApiError(response.status, (data && data.message) || fallback, (data && data.errors) || {});
}

export const get = (path, query) => api('GET', path, { query });
export const post = (path, body) => api('POST', path, { body });
export const put = (path, body) => api('PUT', path, { body });
export const del = (path) => api('DELETE', path);
