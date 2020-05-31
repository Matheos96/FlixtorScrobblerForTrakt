//Not that secret lol
const client_id = 'a821a5a68529725044d9769db2bd1be1c1ad046447a3ff85b3ac6f6d9f809584';
const client_secret = 'eaea2b7a521a725ed95b87aa6813fb96e66d4b2f755b657566f9932e29e40937';
const redirect_uri = 'urn:ietf:wg:oauth:2.0:oob';

const authURL = 'https://api.trakt.tv/oauth/token';
const revokeURL = 'https://api.trakt.tv/oauth/revoke';

//Default POST request parameters
const defaultPostParams = {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};

//Default GET request parameters
const defaultGetParams = {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': client_id
    }
};


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let params;
    if (request.action == 'authorize') {
        params = JSON.parse(JSON.stringify(defaultPostParams));
        params.body = JSON.stringify({
            code: request.code,
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        });
        fetch(authURL, params)
            .then(result => result.json())
            .then(data => {
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('access_token_expires', data.created_at + data.expires_in);
                    localStorage.setItem('refresh_token', data.refresh_token);
                    sendResponse('Authenticated with Trakt!');
                } else {
                    sendResponse('Authentication failed. Wrong code?');
                }

            })
            .catch(() => sendResponse('Authentication failed. Wrong code?'));
    } else if (request.action == 'refresh') {
        params = JSON.parse(JSON.stringify(defaultPostParams));
        params.body = JSON.stringify({
            refresh_token: request.refresh_token,
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: redirect_uri,
            grant_type: 'refresh_token'
        });

        fetch(authURL, params)
            .then(result => result.json())
            .then(data => {
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('access_token_expires', data.created_at + data.expires_in);
                    localStorage.setItem('refresh_token', data.refresh_token);
                    sendResponse('Re-authenticated with Trakt!');
                } else {
                    sendResponse('Refreshing token failed!');
                }

            })
            .catch(err => sendResponse('Authentication failed. Wrong code?'));
    } else if (request.action == 'revoke') {
        params = JSON.parse(JSON.stringify(defaultPostParams));
        params.body = JSON.stringify({
            token: request.token,
            client_id: client_id,
            client_secret: client_secret,
        });
        fetch(revokeURL, params)
            .then(result => result.json())
            .catch(() => sendResponse('Deauthorization failed.'));
    } else if (request.action == 'get_slug') {
        params = JSON.parse(JSON.stringify(defaultGetParams));
        fetch(`https://api.trakt.tv/search/imdb/${request.imdbId}`, params)
            .then(result => result.json())
            .then(showData => {
                if (showData.length >= 1) {
                    if (showData[0].show) {
                        let slug = showData[0].show.ids.slug;
                        sendResponse(slug);
                    }
                }
            })
            .catch(playError => sendResponse(`FST Error: ${playError}`));

    } else if (request.action == 'start' || request.action == 'pause' || request.action == 'stop') {
        params = JSON.parse(JSON.stringify(defaultGetParams));
        console.log(params);
        fetch(`https://api.trakt.tv/shows/${request.slug}/seasons/${request.season}/episodes/${request.episode}`, params)
            .then(result => result.json())
            .then(episodeData => {
                if (episodeData.title) {
                    //Readjust params
                    params.method = 'POST';
                    params.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
                    params.body = JSON.stringify({
                        "episode": episodeData,
                        "progress": request.progress
                    });
                    fetch(`https://api.trakt.tv/scrobble/${request.action}`, params)
                        .then(startResult => startResult.json())
                        .then(startData => {
                            console.log(startData);
                            if (startData.action) {
                                if (startData.action == 'scrobble') {
                                    sendResponse('Scrobbled to trakt!');
                                } else if (startData.action == 'pause') {
                                    sendResponse('Paused on trakt')
                                } else {
                                    sendResponse('Playing on trakt')
                                }
                            }
                        })
                        .catch(playError => sendResponse(`FST Error: ${playError}`));
                }
            })
            .catch(err => sendResponse(`FST Error: ${err}`));
    }
    return true;
});