// Moving between pages. Each page has an address after the # sign, such as #/events/3.

/** Go to another page. If we are already there, draw it again. */
export function navigate(path) {
    if (window.location.hash === `#${path}`) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
        window.location.hash = path;
    }
}
