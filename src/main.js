const { app, BrowserWindow, ipcMain, net } = require("electron");
const { join } = require("path");
const { post, get, put } = require("superagent");
require("dotenv").config();

console.log(process.env);

require("electron-reload")(__dirname);

const createWindow = () => {
    var mainWindow = new BrowserWindow({
        width: 300,
        height: 145,
        resizable: false,
        transparent: true,
        frame: false,
        maximizable: false,
        useContentSize: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    mainWindow.loadFile(join(__dirname, "index.html"));

    // mainWindow.webContents.openDevTools({
    //     mode: "undocked"
    // });
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const scope =
    "user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing";
const redirectUri = "http://localhost/callback";
var authWindow;

ipcMain.on("login", (event, arg) => {
    authWindow = new BrowserWindow({
        show: false
    });

    var urlParams = {
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: scope
    };
    var urlParamsString = new URLSearchParams(urlParams).toString();
    var authUrl = `https://accounts.spotify.com/authorize?${urlParamsString}`;

    authWindow.loadURL(authUrl);
    authWindow.show();

    authWindow.webContents.on("will-redirect", function(
        event,
        url,
        isInPlace,
        isMainFrame,
        frameProcessId,
        frameRoutingId
    ) {
        var hostName = new URL(url).hostname;
        if (hostName === "localhost") handleAuthCallback(url);
    });

    const handleAuthCallback = url => {
        var query = url.split("?")[1];
        var urlParams = new URLSearchParams(query);
        var code = urlParams.get("code");
        var error = urlParams.get("error");

        if (code || error) {
            // Close the browser if code found or error
            authWindow.destroy();
        }

        requestToken(code);
    };

    const requestToken = code => {
        post("https://accounts.spotify.com/api/token")
            .type("form")
            .send({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri
            })
            .end((error, response) => {
                if (response && response.ok) {
                    event.reply("token-received", response.body);
                } else {
                    event.reply("error", error);
                }
            });
    };
});

ipcMain.on("refresh-token", (event, refresh_token) => {
    var buffer = Buffer.from(`${clientId}:${clientSecret}`);
    var authData = buffer.toString("base64");

    post("https://accounts.spotify.com/api/token")
        .set("Authorization", `Basic ${authData}`)
        .type("form")
        .send({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refresh_token
        })
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("refresh-token-received", response.body);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("fetch-user-info", (event, accessToken) => {
    get("https://api.spotify.com/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("fetch-user-info-completed", response.body);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("fetch-currently-playing-context", (event, accessToken) => {
    get("https://api.spotify.com/v1/me/player")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("fetch-currently-playing-context-completed", response.body);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("fetch-currently-playing", (event, accessToken) => {
    get("https://api.spotify.com/v1/me/player/currently-playing")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("fetch-currently-playing-completed", response.body);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("pause-playback", (event, accessToken) => {
    put("https://api.spotify.com/v1/me/player/pause")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("update-playback-state", false);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("start-playback", (event, accessToken) => {
    put("https://api.spotify.com/v1/me/player/play")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (response && response.ok) {
                event.reply("update-playback-state", true);
            } else {
                event.reply("error", error);
            }
        });
});

ipcMain.on("play-previous", (event, accessToken) => {
    post("https://api.spotify.com/v1/me/player/previous")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (error) event.reply("error", error);
        });
});

ipcMain.on("play-next", (event, accessToken) => {
    post("https://api.spotify.com/v1/me/player/next")
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (error) event.reply("error", error);
        });
});

ipcMain.on("toggle-shuffle", (event, { accessToken, doShuffle }) => {
    put(`https://api.spotify.com/v1/me/player/shuffle?state=${doShuffle}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (error) event.reply("error", error);
        });
});

ipcMain.on("cycle-repeat", (event, { accessToken, repeatState }) => {
    put(`https://api.spotify.com/v1/me/player/repeat?state=${repeatState}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .end((error, response) => {
            if (error) event.reply("error", error);
        });
});
