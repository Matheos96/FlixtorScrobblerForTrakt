const init = () => {
    document.getElementById('authPIN').onclick = getAuthPin;
    document.getElementById('auth').onclick = authorize;
    document.getElementById('de_auth').onclick = deauthorize;
    checkAuthenticated();
}

/**
 * Opens the authentication link in a new tab
 */
const getAuthPin = () => {
    open('https://trakt.tv/oauth/authorize?response_type=code&client_id=a821a5a68529725044d9769db2bd1be1c1ad046447a3ff85b3ac6f6d9f809584&redirect_uri=urn:ietf:wg:oauth:2.0:oob');
}

/**
 * Gets the user entered value and authorizes using the code.
 */
const authorize = () => {
    let code = document.getElementById('traktID').value;

    if (code.length == 0) {
        authFeedback('Please enter the PIN!', 'warning');
    } else {
        chrome.runtime.sendMessage({
            action: 'authorize',
            code: code
        }, authFeedback);
    }
}

/**
 * Deauthorizes the user by removing the access token from localstorage and sends a revoke POST to the API.
 */
const deauthorize = () => {
    const token = localStorage.getItem('access_token');
    chrome.runtime.sendMessage({
        action: 'revoke',
        token: token
    }, authFeedback);
    localStorage.removeItem('access_token');
    location.reload();
}

/**
 * Calls the background for refreshing of token
 */
const refreshToken = () => {
    const refresh_token = localStorage.getItem('refresh_token');
    chrome.runtime.sendMessage({
        action: 'refresh',
        refresh_token: refresh_token
    }, authFeedback);
}

/**
 * Changes the status message shown in the popup
 * @param {Message to be shown} msg 
 */
const authFeedback = (msg, type = 'none') => {
    const div = document.getElementById('feedback');
    if (msg.startsWith('Authenticated')) {
        //Hide menu if already authenticated
        const authMenu = document.getElementById('auth_menu');
        authMenu.style.display = 'none';
        div.setAttribute('class', 'alert alert-success');
        const deAuthBtn = document.getElementById('de_auth');
        deAuthBtn.style.display = 'inline-block';
    }else if (type == 'warning') {
        div.setAttribute('class', 'alert alert-warning');
    } else if (msg.includes('failed')) {
        div.setAttribute('class', 'alert alert-danger');
    }
    div.textContent = msg;
}

/**
 * Check if the client already has an access token saved (already authenticated). Display status.
 * If the token exists but has expired, renew it.
 */
const checkAuthenticated = () => {
    if (localStorage.getItem('access_token') != null) {
        const unixTimeNow = Math.floor(Date.now() / 1000);
        const expires = localStorage.getItem('access_token_expires');

        //If the expiration date of the token has passed, refresh it
        if (expires <= unixTimeNow) {
            refreshToken();
        }

        authFeedback('Authenticated');

    } else {
        authFeedback('Not authenticated.');
    }
}

window.onload = init;