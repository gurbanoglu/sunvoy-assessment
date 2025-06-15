var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { JSDOM } from 'jsdom';
import 'dotenv/config';
const SUNVOY_API_URL = 'https://challenge.sunvoy.com';
const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);
const credentials = {
    username: process.env.API_USERNAME || '',
    password: process.env.API_PASSWORD || ''
};
if (!process.env.HMAC_SECRET) {
    throw new Error('HMAC_SECRET environment variable is not set');
}
const hmacSecret = process.env.HMAC_SECRET;
const userInfo = {
    openId: 'openid456',
    operateId: 'op789',
    language: 'en_US',
    apiuser: 'demo@example.org'
};
function fetchUsersAndSettings(userInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const nonce = yield getLoginNonce(fetchWithCookies);
        // console.log('\nnonce:', nonce);
        if (!nonce) {
            throw new Error('Failed to retrieve nonce for login');
        }
        const loginCredentials = Object.assign({ nonce }, credentials);
        // console.log('\nloginCredentials:', loginCredentials);
        // Perform a user login in order to access user data and settings.
        yield login(fetchWithCookies, loginCredentials);
        return Promise.all([
            fetchUsers(fetchWithCookies, loginCredentials),
            fetchSettings(fetchWithCookies, userInfo)
        ]);
    });
}
// Obtain the number used once (nonce) since it is
// required to ensure that each request is unique.
function getLoginNonce(fetchFn) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const response = yield fetchFn(`${SUNVOY_API_URL}/login`);
        if (!response.ok) {
            throw new Error('Failed to retrieve login page');
        }
        const htmlContent = yield response.text();
        const nonce = (_a = new JSDOM(htmlContent)
            .window
            .document
            .querySelector('input[name="nonce"]')) === null || _a === void 0 ? void 0 : _a.value;
        return nonce;
    });
}
function login(fetchFn, credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetchFn(`${SUNVOY_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(credentials).toString()
        });
        if (!response.ok) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        else {
            console.log('Login successful.');
        }
    });
}
function fetchUsers(fetchFn, credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetchFn(`${SUNVOY_API_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(new URLSearchParams(credentials)),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }
        const users = yield response.json();
        // console.log('\nusers:', users);
        return users;
    });
}
/* Retrieves the access token that is necessary in
     order to send the request that obtains the
     authenticated users. */
function fetchTokens(fetchFn) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetchFn(`${SUNVOY_API_URL}/settings/tokens`, {
            method: 'GET'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch access token:
			${response.status} ${response.statusText}`);
        }
        const htmlContent = yield response.text();
        return htmlContent;
    });
}
function extractAccessToken(htmlContent) {
    var _a;
    const accessToken = (_a = new JSDOM(htmlContent)
        .window
        .document
        .querySelector('input#access_token')) === null || _a === void 0 ? void 0 : _a.value;
    return accessToken;
}
function extractUserId(htmlContent) {
    var _a;
    const userId = (_a = new JSDOM(htmlContent)
        .window
        .document
        .querySelector('input#userId')) === null || _a === void 0 ? void 0 : _a.value;
    return userId;
}
function fetchSettings(fetchFn, userInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const htmlContent = yield fetchTokens(fetchFn);
        const accessToken = extractAccessToken(htmlContent);
        // console.log('\naccessToken:', accessToken);
        if (!accessToken) {
            throw new Error('Access token is undefined or missing');
        }
        const userId = extractUserId(htmlContent);
        // console.log('\nuserId:', userId);
        if (!userId) {
            throw new Error('User Id is undefined or missing');
        }
        // console.log(
        // 	'\ncreateSignedRequest(accessToken, userId, userInfo).fullPayload:\n' +
        // 	createSignedRequest(accessToken, userId, userInfo).fullPayload
        // );
        const response = yield fetchFn('https://api.challenge.sunvoy.com/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: createSignedRequest(accessToken, userId, userInfo).fullPayload
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
        }
        const settings = yield response.json();
        return settings;
    });
}
// Prepares and signs request payloads
// for secure API communication.
function createSignedRequest(accessToken, userId, data) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    /* Create a two-dimensional array containing the
         following data to be sent in the payload:
     - access_token
     - apiuser
     - language
     - openId
     - operateId
     - timestamp
     - userId
    */
    const payloadEntries = Object.entries(Object.assign(Object.assign({ access_token: accessToken, userId: userId }, data), { timestamp })).sort(([a], [b]) => a.localeCompare(b));
    // console.log('\npayloadEntries:', payloadEntries);
    const payload = new URLSearchParams(payloadEntries);
    const checkcode = createHmac('sha1', hmacSecret)
        .update(payload.toString())
        .digest('hex')
        .toUpperCase();
    const fullPayload = new URLSearchParams(payload);
    fullPayload.append('checkcode', checkcode);
    return {
        payload,
        checkcode,
        fullPayload: fullPayload.toString(),
        timestamp
    };
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const [users, settings] = yield fetchUsersAndSettings(userInfo);
            yield writeFile('./data/users.json', JSON.stringify({ users, settings }, null, 2), 'utf-8');
            console.log('Users and authenticated users successfully written to users.json');
        }
        catch (err) {
            console.error('An error occurred:', err);
        }
    });
}
main();
