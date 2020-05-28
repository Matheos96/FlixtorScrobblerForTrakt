const init = () => {
    document.getElementById('authPIN').onclick = getAuthPin;
    document.getElementById('auth').onclick = authorize;
    document.getElementById('de_auth').onclick = deauthorize;
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

const deauthorize = () => {
    const token = localStorage.getItem('access_token');
    chrome.runtime.sendMessage({
        action: 'revoke',
        token: token
    }, authFeedback);
    localStorage.removeItem('access_token');
    location.reload();
}

const authFeedback = (msg) => {
    const div = document.getElementById('feedback');
    if (msg.startsWith('Authenticated')) {
        //Hide menu if already authenticated
        const authMenu = document.getElementById('auth_menu');
        authMenu.style.display = 'none';
        div.setAttribute('class', 'alert alert-success');
        const deAuthBtn = document.getElementById('de_auth');
        deAuthBtn.style.display = 'inline-block';
    }
    else if (msg.includes('failed')) {
        div.setAttribute('class', 'alert alert-danger');
    }
    div.textContent = msg;
}

const checkAuthenticated = () => {
    if (localStorage.getItem('access_token') != null) {
        const unixTimeNow = Math.floor(Date.now() / 1000);
        const expires = localStorage.getItem('access_token_expires');
        
        //TODO: Check if expired, then, refresh token

        authFeedback('Authenticated');
        
    } else {
        authFeedback('Not authenticated.');
    }
}

window.onload = init;