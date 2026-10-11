// Remembers who is logged in. The token and user are kept in localStorage,
// so a page refresh does not log the user out.

const TOKEN_KEY = 'eventhub.token';
const USER_KEY = 'eventhub.user';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (badJson) {
        return null;
    }
}

export function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

/** The logged-in user's role, or 'guest'. */
export function role() {
    const user = getUser();
    return getToken() && user ? user.role : 'guest';
}

/** True if the current role is one of the roles given. */
export function hasRole(...roles) {
    return roles.includes(role());
}
