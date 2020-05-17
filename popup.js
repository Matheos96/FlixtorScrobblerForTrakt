const init = () => {
    document.getElementById('authPIN').onclick = getAuthPin;
    document.getElementById('auth').onclick = authorize;
    checkAuthenticated();
}

const getAuthPin = () => {
    open('https://trakt.tv/oauth/authorize?response_type=code&client_id=a821a5a68529725044d9769db2bd1be1c1ad046447a3ff85b3ac6f6d9f809584&redirect_uri=urn:ietf:wg:oauth:2.0:oob');
}

const authorize = () => {
    let code = document.getElementById('traktID').value;
    chrome.runtime.sendMessage({
        action: 'authorize',
        code: code
    }, authFeedback);
}

const authFeedback = (msg) => {
    const div = document.createElement('div');
    if (msg.startsWith('Authenticated')) {
        const authMenu = document.getElementById('auth_menu');
        authMenu.style.display = 'none';
    }
    div.textContent = msg;
    document.body.appendChild(div);
}

const checkAuthenticated = () => {
    if (localStorage.getItem('access_token') != null) {
        authFeedback('Authenticated');
        //TODO: Check if expired, then, refresh token
    } else {
        authFeedback('Not authenticated.');
    }
}

window.onload = init;