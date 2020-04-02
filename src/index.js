const { ipcRenderer } = require("electron");

let state = {
    isLoggedIn: false,
    username: "",
    isPlaying: false,
    repeatStateIndex: 2,
    shuffleState: false
};

const repeatStates = ["track", "context", "off"];
const getNextRepeatStateIndex = () =>
    state.repeatStateIndex + 1 > repeatStates.length - 1 ? 0 : state.repeatStateIndex + 1;

const loginBtn = document.getElementById("login-btn");
const playbackBtn = document.getElementById("playback-btn");
const previousBtn = document.getElementById("previous-btn");
const nextBtn = document.getElementById("next-btn");
const shuffleBtn = document.getElementById("shuffle-btn");
const repeatBtn = document.getElementById("repeat-btn");
const artistNameEl = document.getElementById("artist-name");
const trackNameEl = document.getElementById("track-name");
const albumImgEl = document.getElementById("album-img");
const authInfoEl = document.getElementById("auth-info");

loginBtn.addEventListener("click", () => ipcRenderer.send("login"));

ipcRenderer.on("token-received", (event, authResponse) => {
    authResponse.expires_in = Date.now() + (authResponse.expires_in / 60) * 1000;
    window.localStorage.setItem("spotify", JSON.stringify(authResponse));

    updateLoginState(true);
    ipcRenderer.send("fetch-user-info", getAuthInfo().access_token);
});

ipcRenderer.on("refresh-token-received", (event, authResponse) => {
    let authInfo = getAuthInfo();
    authInfo.access_token = authResponse.access_token;
    authInfo.expires_in = Date.now() + (authResponse.expires_in / 60) * 1000;

    window.localStorage.setItem("spotify", JSON.stringify(authInfo));
    updateLoginState(true);
    ipcRenderer.send("fetch-user-info", getAuthInfo().access_token);
});

ipcRenderer.on("fetch-user-info-completed", (event, response) => {
    updateUsername(response.display_name);
});

const getAuthInfo = () => {
    const authInfo = window.localStorage.getItem("spotify");

    if (authInfo === null) {
        return null;
    }

    return JSON.parse(authInfo);
};

const fetchCurrentlyPlaying = () =>
    ipcRenderer.send("fetch-currently-playing", getAuthInfo().access_token);

const fetchCurrentlyPlayingContext = () =>
    ipcRenderer.send("fetch-currently-playing-context", getAuthInfo().access_token);

ipcRenderer.on("fetch-currently-playing-context-completed", (event, response) => {
    updatePlaybackState(response.is_playing);
    updateShuffleState(response.shuffle_state);
    updateRepeatStateIndex(repeatStates.indexOf(response.repeat_state));
});

ipcRenderer.on("fetch-currently-playing-completed", (event, response) => {
    updatePlaybackState(response.is_playing);
    const trackName = response.item.name;
    const artistName = response.item.artists[0].name;
    const albumImageUrl = response.item.album.images[0].url;
    albumImgEl.setAttribute("src", albumImageUrl);
    artistNameEl.innerText = `${artistName}`;
    trackNameEl.innerText = `${trackName}`;
});

playbackBtn.addEventListener("click", () => {
    state.isPlaying
        ? ipcRenderer.send("pause-playback", getAuthInfo().access_token)
        : ipcRenderer.send("start-playback", getAuthInfo().access_token);
});

previousBtn.addEventListener("click", () => {
    ipcRenderer.send("play-previous", getAuthInfo().access_token);
    fetchCurrentlyPlaying();
});

nextBtn.addEventListener("click", () => {
    ipcRenderer.send("play-next", getAuthInfo().access_token);
    fetchCurrentlyPlaying();
});

shuffleBtn.addEventListener("click", () => {
    updateShuffleState(!state.shuffleState);
    ipcRenderer.send("toggle-shuffle", {
        accessToken: getAuthInfo().access_token,
        doShuffle: state.shuffleState
    });
});

repeatBtn.addEventListener("click", () => {
    updateRepeatStateIndex(getNextRepeatStateIndex());
    console.log(repeatStates[state.repeatStateIndex]);
    ipcRenderer.send("cycle-repeat", {
        accessToken: getAuthInfo().access_token,
        repeatState: repeatStates[state.repeatStateIndex]
    });
});

ipcRenderer.on("update-playback-state", (event, isPlaying) => {
    updatePlaybackState(isPlaying);
    fetchCurrentlyPlaying();
});

ipcRenderer.on("error", (event, error) => console.log(error));

const updatePlaybackState = isPlaying => {
    state = { ...state, isPlaying };

    const iconEl = playbackBtn.firstElementChild;

    if (isPlaying) {
        iconEl.classList.remove("fa-play");
        iconEl.classList.add("fa-pause");
    } else {
        iconEl.classList.remove("fa-pause");
        iconEl.classList.add("fa-play");
    }
};

const updateShuffleState = doShuffle => {
    state = { ...state, shuffleState: doShuffle };

    if (doShuffle) {
        shuffleBtn.classList.add("selected");
    } else {
        shuffleBtn.classList.remove("selected");
    }
};

const updateRepeatStateIndex = repeatStateIndex =>
    (state = { ...state, repeatStateIndex: repeatStateIndex });

const updateLoginState = isLoggedIn => {
    state = {
        ...state,
        isLoggedIn: isLoggedIn
    };

    loginBtn.hidden = isLoggedIn;
    authInfoEl.hidden = !isLoggedIn;
};

const updateUsername = username => {
    state = { ...state, username };
    authInfoEl.innerText = `Signed in as ${state.username}`;
};

setTimeout(() => {
    const authInfo = getAuthInfo();

    let isLoggedIn = true;

    if (authInfo === null || Date.now() > authInfo.expires_in) {
        console.log("User is not logged in.");
        isLoggedIn = false;
    }

    updateLoginState(isLoggedIn);

    if (state.isLoggedIn) {
        ipcRenderer.send("fetch-user-info", authInfo.access_token);
        fetchCurrentlyPlayingContext();
    }
});

setInterval(() => {
    // console.log(state);
    if (state.isLoggedIn) {
        fetchCurrentlyPlaying();
        fetchCurrentlyPlayingContext();
    }
}, 2000);

setInterval(() => {
    const authInfo = getAuthInfo();

    if (authInfo == null) {
        updateLoginState(false);
        return;
    }

    if (authInfo && Date.now() >= authInfo.expires_in) {
        console.log("refreshing token!");
        ipcRenderer.send("refresh-token", authInfo.refresh_token);
    }
}, 1000);
