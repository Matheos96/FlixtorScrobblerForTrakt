let currentInterval;
let currentTimeout;
let showSlug, episode, season, duration, elapsed;
let isPlaying = false;
let isScrobbled = false;


//Ran on page load
const init = () => {
    //Get all episode links
    const episodeLinks = document.querySelectorAll('[itemprop=episode]'); //get all episode links
    //Add listeners to the episode links
    addEpisodeListeners(episodeLinks);

    //If the player is already present, listen
    if (playerIsPresent()) {
        listenToPlayer();
    }
}

/**
 * Checks the HTML source code to determine whether a player is present or not.
 */
const playerIsPresent = () => {
    const player = document.getElementById('player');
    const playerClasses = player.getAttribute('class');
    return playerClasses.includes('jwplayer');
}

/**
 * Sets listeners on all the episode links. The listener will fire the listenToPlayer() function if an episode is clicked
 * @param {NodeList of episodelinks} episodes 
 */
const addEpisodeListeners = (episodes) => {
    episodes.forEach(element => {
        element.onclick = () => {
            if (isPlaying) {
                stopOrPause();
            }
            initPlayerListening();
        };
    });
}

/**
 * Initialze the listening on the player by continuously trying to find the player and when it is found, listen
 * The function calls itself every second until the player is present
 */
const initPlayerListening = () => {
    if (playerIsPresent()) {
        clearTimeout(currentTimeout); //Clear the last made timeout. Used to make sure we don't have two timeouts at once.
        listenToPlayer();
    } else {
        currentTimeout = setTimeout(initPlayerListening, 1000);
    }
}

/**
 * The interval will check the elapsed time once every second. If the elapsed time does not change for 3 seconds, the episode is considered paused.
 * If a paused episodes elapsed time changes, it will be considered playing again.
 */
const listenToPlayer = () => {
    //Clear potential other intervals
    clearInterval(currentInterval);

    //Initial state
    isPlaying = false;
    isScrobbled = false;


    //Get the element containing the original url. From this we extract the slug
    const og_urlAsArr = document.querySelector('[property="og:url"]').getAttribute('content').split('/');
    showSlug = og_urlAsArr[6];

    //Get the season and episode numbers
    season = document.querySelector('[class="outPes"]').innerHTML;
    episode = document.querySelector('[class="outPep"]').innerHTML;
    console.log(`Show slug: ${showSlug}, Season: ${season}, Episode: ${episode}`);

    let elapsedElement;
    currentInterval = setInterval(() => {
        elapsedElement = document.getElementsByClassName('jw-text-elapsed')[0];
        if (elapsedElement != null) {
            elapsed = elapsedElement.innerHTML; //Refreh elapsed with the latest value from innerHTML every "iteration"
        }
        console.log(elapsed); //DEBUG
        let playerClasses = document.getElementById('player').getAttribute('class'); //css classes of the player
        //If the classes include jw-state-paused, the player is paused
        if (playerClasses.includes('jw-state-paused')) {
            if (isPlaying) {
                console.log("paused");
                stopOrPause('pause');
            }
            isPlaying = false; //Indicate paused
        }
        //Player is playing 
        else {
            if (!isPlaying) {
                duration = durationToSeconds(document.getElementsByClassName('jw-text-duration')[0].textContent);
                isPlaying = true; //indicate playing
                //fire play api call
                chrome.runtime.sendMessage({
                    action: 'start',
                    slug: showSlug,
                    season: season,
                    episode: episode,
                    progress: 100 * durationToSeconds(elapsed) / duration
                }, backgroundFeedback);
            }
        }

    }, 1000);
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

const stopOrPause = (action = 'stop') => {
    let progress = 100 * durationToSeconds(elapsed) / duration;
    console.log(action);
    //Call stop action if progress is greater than 90% and it is not already scrobbled
    if (progress > 90 && !isScrobbled && action == 'stop') {
        console.log("Scrobbled");
        isScrobbled = true;
    }
    //Fire pause/stop api call
    chrome.runtime.sendMessage({
        action: action,
        slug: showSlug,
        season: season,
        episode: episode,
        progress: progress
    }, backgroundFeedback);
}

const backgroundFeedback = (msg) => console.log(`Background: ${msg}`);

//initialize
window.onload = init;

window.onbeforeunload = () => stopOrPause();