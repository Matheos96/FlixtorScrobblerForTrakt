const state = {
    "isPlaying": false,
    "isScrobbled": false,
    "imdbId": "undefined",
    "season": -1,
    "episode": -1,
    "elapsed": "00:00",
    "duration": -1,
}

let currentTimeout;
let playerLookCount;

//Observers global in order to disconnect them elsewhere
let elapsedObserver;
let episodeObserver;
let playerWrapperObserver;
const obsConfig = {
    attributes: false,
    childList: true,
    subtree: true
};

const init = (lookForPlayer = true) => {
    //Get all episode links
    const episodeLinks = document.querySelectorAll('[itemprop=episode]'); //get all episode links
    //Add listeners to the episode links
    addEpisodeListeners(episodeLinks);

    if (lookForPlayer) {
        //Setup player listening right away in case a player is present at the landing page
        playerLookCount = 0;
        instantPlayerListening();
    }
}

/**
 * Tries 6 times to setup player listeners. If fails. No player present probably.
 */
const instantPlayerListening = () => {
    if (playerLookCount == 5) {
        return;
    }
    if (playerIsAvailable()) {
        setup();
    } else {
        playerLookCount++;
        currentTimeout = setTimeout(instantPlayerListening, 1000);
    }
}

/**
 * Sets listeners on all the episode links. The listener will fire the listenToPlayer() function if an episode is clicked
 * @param {NodeList of episodelinks} episodes 
 */
const addEpisodeListeners = (episodes) => {
    episodes.forEach(element => {
        element.onclick = () => {
            if (state.isPlaying || state.elapsed != '00:00') {
                stopListener();
            }
            setup();
        };
    });
    console.log("FST: Episode listeners added.");
}

/**
 * Checks the HTML source code to determine whether a player is present and ready or not
 */
const playerIsReady = () => {
    if (playerIsAvailable()) {
        //Player is present
        let playerstate = document.getElementsByClassName('playerstate')[0].innerText;
        return playerstate.includes('Paused') || playerstate.includes('Playing');
    }
}

/**
 * Checks if there is a player available
 */
const playerIsAvailable = () => {
    const player = document.getElementById('player');
    const playerClasses = player.getAttribute('class');
    return playerClasses.includes('jwplayer');
}

/**
 * Initialze the listening on the player by continuously trying to find the player and when it is found, setup listeners.
 * The function calls itself every second until the player is present
 */
const setup = () => {
    if (playerIsReady()) {
        clearTimeout(currentTimeout); //Clear the last made timeout. Used to make sure we don't have two timeouts at once.

        //Add an event listener to the play/pause div
        let playPauseDiv = document.getElementsByClassName('jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-playback')[0];
        playPauseDiv.addEventListener('click', playPauseClick);

        //Same event handler if the player is clicked
        let player = document.getElementsByClassName('jw-video jw-reset')[0];
        player.addEventListener('click', playPauseClick);

        //Same eventhandler if spacebar is pressed
        document.body.onkeydown = (e) => {
            if (e.keyCode == 32) {
                playPauseListener()
            }
        };

        //Change the elapsed property in the state every time it changes
        const elapsedElement = document.getElementsByClassName('jw-text-elapsed')[0];
        //Observe the elapsed div and update state on changes. Dont update if == '00:00' as for some reason that is what will be shown just before window closing
        elapsedObserver = new MutationObserver(() => state.elapsed = elapsedElement.textContent != '00:00' ? elapsedElement.textContent : state.elapsed);
        elapsedObserver.observe(elapsedElement, obsConfig);

        //Observe the episode element and rerun setup if it changes (often autoplaying next episode)
        const episodeElement = document.querySelector('[class="outPep"]');
        episodeObserver = new MutationObserver(() => {
            stopListener();
            init();

        });
        episodeObserver.observe(episodeElement, obsConfig);

        //Listen to attribute changes in player wrapper while player is ready. If it gets a class of hide, we believe the last available episode has been played
        //and the player is hidden. Then stop playback on trakt and rerun init but force not to look for player.
        const playerWrapper = document.getElementById('playerwrapper');
        playerWrapperObserver = new MutationObserver((mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (mutation.target.getAttribute('class').includes('hide')) {
                    stopListener();
                    init(false);
                    return;
                }
            }
        });
        playerWrapperObserver.observe(playerWrapper, {
            attributes: true,
            childList: false,
            subtree: false
        });

        //Gather data about playing episode
        state.duration = durationToSeconds(document.getElementsByClassName('jw-text-duration')[0].textContent);
        const imdbLink = document.querySelector('[title="Open IMDb"]').getAttribute('href').split('/');
        state.imdbId = imdbLink[imdbLink.length - 1];
        state.season = document.querySelector('[class="outPes"]').innerHTML;
        state.episode = episodeElement.innerHTML;

        //Reset initial state
        state.isScrobbled = false;
        state.elapsed = '00:00';

        console.log("FST: Listeners set up and data gathered.");

        //Start scrobbling and force action to play
        playPauseListener(true);
    } else {
        currentTimeout = setTimeout(setup, 1000);
    }
}

/**
 * Simply calls playPauseListener. Used for click events to ignore the event parameter.
 */
const playPauseClick = () => playPauseListener();

/**
 * Called whenever the player is paused or played
 * @param {boolean, true forces action to 'start'} forcePlay 
 */
const playPauseListener = (forcePlay = false) => {
    let playPauseDiv = document.getElementsByClassName('jw-icon jw-icon-inline jw-button-color jw-reset jw-icon-playback')[0];
    let playPause = playPauseDiv.getAttribute('aria-label').toLowerCase();

    if (playPause == 'play' || playPause == 'pause' || forcePlay) {
        let action = playPause == 'play' || forcePlay ? 'start' : 'pause';
        state.isPlaying = playPause == 'play' || forcePlay;

        callTraktApi(action);
    }

}

/**
 * Called when the back button is clicked or when the window/tab is closed.
 * Also called manually whenever another episode is clicked from an episode link.
 */
const stopListener = () => {
    if (state.imdbId != 'undefined' && state.episode != -1 && state.season != -1) {
        let progress = 100 * durationToSeconds(state.elapsed) / state.duration;
        //Require progress of more than 90% to call stop action to scrobble the episode
        let action = progress > 90 && !state.isScrobbled ? 'stop' : 'pause';
        state.isScrobbled = state.isScrobbled || progress > 90;

        callTraktApi(action);
        if (playerIsReady()) {
            elapsedObserver.disconnect();
            episodeObserver.disconnect();
            playerWrapperObserver.disconnect();
        }
    }
}

/**
 * Converts the given duration string to seconds
 * @param {A string containing the duration in digital form (HH:mm:ss)} durationString 
 */
const durationToSeconds = (durationString) => {
    let durationArr = durationString.split(":");
    let seconds = 0;
    let times = durationArr.length - 1;
    durationArr.forEach(element => {
        seconds += parseInt(element) * Math.pow(60, times);
        times--;
    });
    return seconds;
}

/**
 * Calls the trakt api with the variables present in the state and the given action
 * @param {The action to use when calling the API} action 
 */
const callTraktApi = (action) => {
    chrome.runtime.sendMessage({
        action: action,
        slug: state.imdbId,
        season: state.season,
        episode: state.episode,
        progress: 100 * durationToSeconds(state.elapsed) / state.duration
    }, backgroundFeedback);
}

const backgroundFeedback = (msg) => console.log(`FST-background: ${msg}`);



//initialize
window.onload = init;

//When the user moves along from the window
window.onbeforeunload = () => {
    stopListener();
}