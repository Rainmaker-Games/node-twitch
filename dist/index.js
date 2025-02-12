"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable camelcase */
const node_fetch_1 = __importDefault(require("node-fetch"));
const events_1 = require("events");
const util_1 = require("./util");
/** Twitch API */
class TwitchApi extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.client_secret = config.client_secret;
        this.client_id = config.client_id;
        this.access_token = config.access_token;
        this.refresh_token = config.refresh_token;
        this.scopes = config.scopes;
        this.redirect_uri = config.redirect_uri;
        this.base = "https://api.twitch.tv/helix";
        this.refresh_attempts = 0;
        this.ready = false;
        this._init();
    }
    /*
    ****************
    PRIVATE METHODS
    ****************
    */
    /** Initialize the api.
     * @internal
    */
    _init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.access_token) {
                const currentUser = yield this.getCurrentUser();
                this.user = currentUser;
            }
        });
    }
    /** Throw an error
     * @internal
    */
    _error(message) {
        throw new Error(message);
    }
    /** Get an app access token
     * @internal
     */
    _getAppAccessToken() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: "client_credentials",
                scope: (_a = this.scopes) === null || _a === void 0 ? void 0 : _a.join(" ")
            };
            const endpoint = "https://id.twitch.tv/oauth2/token";
            const response = yield (0, node_fetch_1.default)(endpoint, {
                method: "POST",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json"
                }
            });
            const result = yield response.text();
            try {
                const data = JSON.parse(result);
                return data.access_token;
            }
            catch (err) {
                this._error(`Error getting app access token. Expected twitch to return JSON object but got: ${result}`);
                return undefined;
            }
        });
    }
    /** Refresh the access token
     * @internal
    */
    _refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if the current refresh token is valid.
            const valid = yield this._validate();
            if (valid)
                return;
            // Cancel execution and throw error if refresh token is not present.
            if (!this.refresh_token)
                return this._error("Refresh token is not set.");
            const refreshData = {
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: "refresh_token",
                refresh_token: encodeURIComponent(this.refresh_token)
            };
            const url = "https://id.twitch.tv/oauth2/token";
            const options = {
                method: "POST",
                body: JSON.stringify(refreshData),
                headers: {
                    "Content-Type": "application/json"
                }
            };
            const response = yield (0, node_fetch_1.default)(url, options);
            const result = yield response.json();
            const accessToken = result.access_token;
            const refreshToken = result.refresh_token;
            // Set the newly fetched access and refresh tokens.
            this.access_token = accessToken || this.access_token;
            this.refresh_token = refreshToken || this.refresh_token;
            if (this._isListeningFor("refresh"))
                this.emit("refresh", result);
            if (!accessToken)
                this.refresh_attempts++;
        });
    }
    /** Checks if an event is handled or not
     * @internal
    */
    _isListeningFor(event) {
        return this.eventNames().includes(event);
    }
    /** Check validity of refresh token
     * @internal
    */
    _validate() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "https://id.twitch.tv/oauth2/validate";
            const options = {
                headers: {
                    "Authorization": `OAuth ${this.access_token}`
                }
            };
            const response = yield (0, node_fetch_1.default)(url, options);
            const result = yield response.json();
            const message = result.message;
            const valid = response.status === 200;
            if (message === "missing authorization token")
                this._error(message);
            return valid;
        });
    }
    /** Make a get request to the twitch api
     * @internal
    */
    _get(endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.access_token) {
                const accessToken = yield this._getAppAccessToken();
                if (!accessToken)
                    throw new Error("App access token could not be fetched. Please make sure your `client_id` and `client_secret` are correct.");
                this.access_token = accessToken;
            }
            const url = this.base + endpoint;
            const options = {
                method: "GET",
                headers: {
                    "Client-ID": this.client_id,
                    "Authorization": `Bearer ${this.access_token}`
                }
            };
            const response = yield (0, node_fetch_1.default)(url, options);
            if (response.status === 401) {
                yield this._refresh();
                return this._get(endpoint);
            }
            const result = yield response.json();
            return result;
        });
    }
    /**
     * Send update request, ie. post, put, patch, delete.
     * @internal
     */
    _update(endpoint, data, method) {
        return __awaiter(this, void 0, void 0, function* () {
            if (endpoint.substring(0, 1) !== "/")
                this._error("Endpoint must start with a '/' (forward slash)");
            const url = this.base + endpoint;
            const options = {
                method: method || "post",
                body: data ? JSON.stringify(data) : "",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.access_token}`,
                    "Client-ID": this.client_id
                }
            };
            try {
                const response = yield (0, node_fetch_1.default)(url, options);
                if (response.status === 200 || response.status === 202)
                    return response.json();
                else
                    return response.text();
            }
            catch (err) {
                const status = err.status;
                if (status === 401) {
                    yield this._refresh();
                    return this._post(endpoint, options);
                }
                this._error(err);
            }
        });
    }
    /** Send a post request to the Twitch API
     * @internal
     */
    _post(endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._update(endpoint, data, "post");
        });
    }
    /** Send a delete request to the Twitch API
     * @internal
     */
    _delete(endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._update(endpoint, data, "delete");
        });
    }
    /** Send a patch request to the Twitch API
     * @internal
    */
    _patch(endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._update(endpoint, data, "patch");
        });
    }
    /** Send put request to the Twitch API
     * @internal
    */
    _put(endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._update(endpoint, data, "put");
        });
    }
    /** Check if the current instance was created with a certain scope
     * @internal
     */
    _hasScope(scope) {
        var _a;
        if (this.scopes)
            return (_a = this.scopes) === null || _a === void 0 ? void 0 : _a.includes(scope);
        return false;
    }
    /*
    **************
    PUBLIC METHODS
    **************
    */
    /***************
    Authentication.
    ***************/
    /** Generate url required to get permission from users */
    generateAuthUrl() {
        var _a;
        const base = "https://id.twitch.tv/oauth2/authorize";
        const clientId = `client_id=${this.client_id}`;
        const redirectUri = `redirect_uri=${encodeURIComponent("" + this.redirect_uri)}`;
        const responseType = "response_type=code";
        const scope = `scope=${(_a = this.scopes) === null || _a === void 0 ? void 0 : _a.join(" ")}`;
        const url = `${base}?${clientId}&${responseType}&${redirectUri}&${scope}`;
        return url;
    }
    /** Get user access from a code generated by visiting the url created by `generateAuthUrl` */
    getUserAccess(code) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = "https://id.twitch.tv/oauth2/token" +
                `?client_id=${this.client_id}` +
                `&client_secret=${this.client_secret}` +
                `&code=${code}` +
                "&grant_type=authorization_code" +
                `&redirect_uri=${this.redirect_uri}`;
            const response = yield (0, node_fetch_1.default)(endpoint, { method: "POST" });
            const result = yield response.json();
            if (result.access_token)
                this.access_token = result.access_token;
            if (result.refresh_token)
                this.refresh_token = result.refresh_token;
            this.emit("user_auth", result);
        });
    }
    /************************************
    Methods NOT requiring user permissions
    *************************************/
    /** Get games by their name or id */
    getGames(games) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(games) && typeof games !== "string" && typeof games !== "number")
                this._error("games must be either a string or number or an array of strings and/or numbers");
            let query = "?";
            query += (0, util_1.parseMixedParam)({ values: games, stringKey: "name", numericKey: "id" });
            const endpoint = "/games" + query;
            const result = yield this._get(endpoint);
            return result;
        });
    }
    /** Gets games sorted by number of current viewers on Twitch, most popular first. */
    getTopGames(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = options ? (0, util_1.parseOptions)(options) : "";
            const endpoint = `/games/top?${query}`;
            return this._get(endpoint);
        });
    }
    /** Get one or more users by their login names or twitch ids. If only one user is needed, a single string will suffice. */
    getUsers(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = "?";
            if (Array.isArray(ids)) {
                query += (0, util_1.parseMixedParam)({ values: ids, stringKey: "login", numericKey: "id" });
            }
            else {
                const key = (0, util_1.isNumber)("" + ids) ? "id" : "login";
                query += `${key}=${ids}`;
            }
            const endpoint = "/users" + query;
            return this._get(endpoint);
        });
    }
    /** Get follows to or from a channel. Must provide either from_id or to_id. */
    getFollows(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = "?";
            if (options)
                query += (0, util_1.parseOptions)(options);
            const endpoint = `/users/follows${query}`;
            return this._get(endpoint);
        });
    }
    /** Get one or more live streams */
    getStreams(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = "?";
            const endpoint = "/streams";
            if (!options)
                return this._get(endpoint);
            const { channel, channels } = options;
            if (channel) {
                const key = (0, util_1.isNumber)(channel) ? "user_id" : "user_login";
                query += `${key}=${channel}&`;
            }
            if (channels)
                query += (0, util_1.parseMixedParam)({
                    values: channels,
                    stringKey: "user_login",
                    numericKey: "user_id"
                });
            query += "&";
            query += (0, util_1.parseOptions)(options);
            const response = yield this._get(endpoint + query);
            response.data.map(util_1.addThumbnailMethod);
            return response;
        });
    }
    /** Gets the list of all stream tags defined by Twitch, optionally filtered by tag ID(s). */
    getAllStreamTags(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = options ? `?${(0, util_1.parseOptions)(options)}` : "";
            const endpoint = `/tags/streams${query}`;
            return this._get(endpoint);
        });
    }
    /** Gets the list of tags for a specified stream (channel). */
    getStreamTags(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/streams/tags${query}`;
            return this._get(endpoint);
        });
    }
    /** Fetch videos by a user id, game id, or one or more video ids. Only one of these can be specified at a time. */
    getVideos(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = "?";
            query += (0, util_1.parseOptions)(options);
            const endpoint = `/videos${query}`;
            return this._get(endpoint);
        });
    }
    getClips(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/clips${query}`;
            return this._get(endpoint);
        });
    }
    getChannelInformation(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/channels${query}`;
            return this._get(endpoint);
        });
    }
    /** Returns a list of channels (users who have streamed within the past 6 months) that match the query via channel name or description either entirely or partially. Results include both live and offline channels. Online channels will have additional metadata (e.g. started_at, tag_ids). See sample response for distinction. */
    searchChannels(options) {
        return __awaiter(this, void 0, void 0, function* () {
            options.query = encodeURIComponent(options.query);
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/search/channels${query}`;
            return this._get(endpoint);
        });
    }
    /** Returns a list of games or categories that match the query via name either entirely or partially. */
    searchCategories(options) {
        return __awaiter(this, void 0, void 0, function* () {
            options.query = encodeURIComponent(options.query);
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/search/categories${query}`;
            return this._get(endpoint);
        });
    }
    /** Get Extension Transactions allows extension back end servers to fetch a list of transactions that have occurred for their extension across all of Twitch. */
    getExtensionTransactions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/extensions/transactions${query}`;
            return this._get(endpoint);
        });
    }
    /** Retrieves the list of available Cheermotes, animated emotes to which viewers can assign Bits, to cheer in chat. Cheermotes returned are available throughout Twitch, in all Bits-enabled channels. */
    getCheermotes(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = options ? `?${(0, util_1.parseOptions)(options)}` : "";
            const endpoint = `/bits/cheermotes${query}`;
            return this._get(endpoint);
        });
    }
    getChannelEmotes(broadcasterId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `?broadcaster_id=${broadcasterId}`;
            const endpoint = `/chat/emotes${query}`;
            return this._get(endpoint);
        });
    }
    /*********************************
    Methods requiring user permissions
    **********************************/
    /** Gets the channel stream key for a user. */
    getStreamKey(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("channel:read:stream_key"))
                this._error("missing scope `channel:read:stream_key`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/streams/key${query}`;
            const result = yield this._get(endpoint);
            return result.data[0].stream_key;
        });
    }
    /** Gets the currently authenticated users profile information. */
    getCurrentUser() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = "/users";
            const result = yield this._get(endpoint);
            if (!result) {
                this._error("Failed to get current user. This could be because you haven't provided an access_token connected to a user.");
                return;
            }
            const user = result.data[0];
            return user;
        });
    }
    /** Gets a ranked list of Bits leaderboard information for an authorized broadcaster. */
    getBitsLeaderboard(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("bits:read"))
                this._error("missing scope `bits:read`");
            const query = options ? `?${(0, util_1.parseOptions)(options)}` : "";
            const endpoint = `/bits/leaderboard${query}`;
            return this._get(endpoint);
        });
    }
    /** Get all of a broadcaster’s subscriptions. */
    getSubs(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("channel:read:subscriptions"))
                this._error("missing scope `channel:read:subscriptions`");
            const query = `?${(0, util_1.parseOptions)(options)}`;
            const endpoint = `/subscriptions${query}`;
            return this._get(endpoint);
        });
    }
    /** Returns all banned and timed-out users in a channel. */
    getBannedUsers(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("moderation:read"))
                this._error("missing scope `moderation:read`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/moderation/banned${query}`;
            return this._get(endpoint);
        });
    }
    /** Adds a specified user to the followers of a specified channel. A successful request does not return any content.
     * @deprecated
    */
    createUserFollows(options) {
        return __awaiter(this, void 0, void 0, function* () {
            console.warn("`createUserFollows` is deprecated. Twitch has already removed the related endpoint, and this method will be removed from `node-twitch` in a future version.");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/users/follows${query}`;
            return this._post(endpoint);
        });
    }
    /** Deletes a specified user from the followers of a specified channel.
     * @deprecated
     */
    deleteUserFollows(options) {
        return __awaiter(this, void 0, void 0, function* () {
            console.warn("`deleteUserFollows` is deprecated. Twitch has already removed the related endpoint, and this method will be removed from `node-twitch` in a future version.");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/users/follows${query}`;
            return this._delete(endpoint);
        });
    }
    /** Gets a list of markers for either a specified user’s most recent stream or a specified VOD/video (stream), ordered by recency. A marker is an arbitrary point in a stream that the broadcaster wants to mark; e.g., to easily return to later. The only markers returned are those created by the user identified by the Bearer token.

    The response has a JSON payload with a `data` field containing an array of marker information elements and a `pagination` field containing information required to query for more follow information. */
    getStreamMarkers(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("user:read:broadcast"))
                this._error("missing scope `user:read:broadcast`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/streams/markers${query}`;
            return this._get(endpoint);
        });
    }
    /** Gets a list of all extensions (both active and inactive) for a specified user, identified by a Bearer token.

    The response has a JSON payload with a `data` field containing an array of user-information elements. */
    getUserExtensions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("user:read:broadcast"))
                this._error("missing scope `user:read:broadcast`");
            const endpoint = "/users/extensions/list";
            return this._get(endpoint);
        });
    }
    /** Gets information about active extensions installed by a specified user, identified by a user ID or Bearer token. */
    getUserActiveExtensions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("user:read:broadcast") && !this._hasScope("user:edit:broadcast"))
                this._error("Missing scope `user:read:broadcast` or `user:edit:broadcast`");
            const query = options ? "?" + (0, util_1.parseOptions)(options) : "";
            const endpoint = "/users/extensions" + query;
            return this._get(endpoint);
        });
    }
    /** Modifies channel information for users. */
    modifyChannelInformation(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("user:edit:broadcast"))
                this._error("Missing scope `user:edit:broadcast`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = "/channels" + query;
            return this._patch(endpoint);
        });
    }
    /** Updates the description of a user specified by a Bearer token. */
    updateUser(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("user:edit"))
                this._error("Missing scope `user:edit`");
            const query = options && options.description ? "?" + (0, util_1.parseOptions)(options) : "";
            const endpoint = "/users" + query;
            return this._put(endpoint);
        });
    }
    /** Creates a clip programmatically. This returns both an ID and an edit URL for the new clip.

    Note that the clips service returns a maximum of 1000 clips,

    Clip creation takes time. We recommend that you query Get Clips, with the clip ID that is returned here. If Get Clips returns a valid clip, your clip creation was successful. If, after 15 seconds, you still have not gotten back a valid clip from Get Clips, assume that the clip was not created and retry Create Clip.

    This endpoint has a global rate limit, across all callers. The limit may change over time, but the response includes informative headers: */
    createClip(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("clips:edit"))
                this._error("Missing scope `clips:edit`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = "/clips" + query;
            return this._post(endpoint);
        });
    }
    /** Returns all moderators in a channel. */
    getModerators(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("moderation:read"))
                this._error("Missing scope `moderation:read`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = "/moderation/moderators" + query;
            return this._get(endpoint);
        });
    }
    /** Gets the status of one or more provided Bits codes. This API requires that the caller is an authenticated Twitch user. The API is throttled to one request per second per authenticated user. Codes are redeemable alphanumeric strings tied only to the bits product. This third-party API allows other parties to redeem codes on behalf of users. Third-party app and extension developers can use the API to provide rewards of bits from within their games.

    All codes are single-use. Once a code has been redeemed, via either this API or the site page, then the code is no longer valid for any further use.

    This endpoint is only available for developers who have a preexisting arrangement with Twitch. We provide sets of codes to the third party as part of a contract agreement. The third-party program then calls this API to credit the Twitch user by submitting specific code(s). This means that a bits reward can be applied without users having to follow any manual steps. */
    getCodeStatus(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = "/entitlements/codes" + query;
            return this._get(endpoint);
        });
    }
    /** Applies specified tags to a specified stream, overwriting any existing tags applied to that stream. If no tags are specified, all tags previously applied to the stream are removed. Automated tags are not affected by this operation.

    Tags expire 72 hours after they are applied, unless the stream is live within that time period. If the stream is live within the 72-hour window, the 72-hour clock restarts when the stream goes offline. The expiration period is subject to change. */
    replaceStreamTags(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `?broadcaster_id=${options.broadcaster_id}`;
            const endpoint = "/streams/tags" + query;
            const data = options.tag_ids ? { tag_ids: options.tag_ids } : null;
            if (data)
                return this._put(endpoint, data);
            else
                return this._put(endpoint);
        });
    }
    /** Starts a commercial on a specified channel. */
    startCommercial(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasScope("channel:edit:commercial"))
                this._error("Missing scope `channel:edit:commercial`");
            const query = "?" + (0, util_1.parseOptions)(options);
            const endpoint = `/channels/commercial${query}`;
            return this._post(endpoint);
        });
    }
}
exports.default = TwitchApi;
