var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { writeFile } from 'node:fs/promises';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
// Adds a timestamp and HMAC-SHA1 signature
// to the payload to ensure API integrity.
function createSignedRequest(data) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const withTimestamp = Object.assign(Object.assign({}, data), { timestamp });
    // Sort the keys alphabetically.
    const sortedKeys = Object.keys(withTimestamp).sort();
    // Build URL-encoded payload string.
    const payload = sortedKeys
        .map(key => `${key}=${encodeURIComponent(withTimestamp[key])}`)
        .join('&');
    // Create HMAC-SHA1 signature using secret key.
    const hmac = crypto.createHmac('sha1', 'mys3cr3t');
    hmac.update(payload);
    const checkcode = hmac.digest('hex').toUpperCase();
    // Full payload including the signature.
    const fullPayload = `${payload}&checkcode=${checkcode}`;
    return { payload, checkcode, fullPayload, timestamp };
}
// Extracts nonce value from login page's HTML.
function getNonceValue(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    // Query the input element by name or id.
    const input = document.querySelector('input[name="nonce"]');
    return (input === null || input === void 0 ? void 0 : input.value) || '';
}
function getLoginNonce(fetchFn) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetchFn('https://challenge.sunvoy.com/login', { method: 'GET' });
        const html = yield response.text();
        return getNonceValue(html);
    });
}
function login(fetchFn, nonce) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = new URLSearchParams({ nonce, username: 'demo@example.org', password: 'test' });
        const response = yield fetchFn('https://challenge.sunvoy.com/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString(),
        });
        if (!response.ok)
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    });
}
const jar = new CookieJar();
// Wrap fetch with the cookie jar.
const fetchWithCookies = fetchCookie(fetch, jar);
function fetchUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch the login page to get the CSRF nonce.
            const nonce = yield getLoginNonce(fetchWithCookies);
            console.log(`Retrieved login nonce: ${nonce}`);
            console.log('> Logged in, now fetching users...');
            yield login(fetchWithCookies, nonce);
            const data = new URLSearchParams({
                nonce: nonce,
                username: 'demo@example.org',
                password: 'test'
            });
            // Call the internal API to get users.
            const response = yield fetchWithCookies('https://challenge.sunvoy.com/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`Could not load users (HTTP ${response.status})`);
            }
            const users = yield response.json();
            const userPayload = {
                userId: '88619348-dbd9-4334-9290-241a7f17dd31',
                openId: 'openid456',
                operateId: 'op789',
                language: 'en_US',
                apiuser: 'demo@example.org',
            };
            // Create the checkcode and timestamp.
            const { checkcode, timestamp } = createSignedRequest(userPayload);
            console.log('checkcode:', checkcode);
            console.log('timestamp:', timestamp);
            const formData = new URLSearchParams({
                apiuser: 'demo@example.org',
                language: 'en_US',
                openId: 'openid456',
                operateId: 'op789',
                timestamp: timestamp,
                userId: '88619348-dbd9-4334-9290-241a7f17dd31',
                checkcode: checkcode
            });
            // Fetch authenticated user settings.
            const settingsResponse = yield fetchWithCookies('https://api.challenge.sunvoy.com/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });
            if (!settingsResponse.ok) {
                throw new Error(`Failed to fetch settings: ${settingsResponse.status} ${settingsResponse.statusText}`);
            }
            const settings = yield settingsResponse.json();
            // Combine users and settings data.
            const combinedData = { users, settings };
            const prettyJson = JSON.stringify(combinedData, null, 2);
            yield writeFile('./data/users.json', prettyJson, 'utf-8');
            console.log('\nUsers and settings data saved to data/users.json');
        }
        catch (error) {
            console.log('\Inside catch block:\n');
            console.error(error);
        }
    });
}
fetchUsers();
