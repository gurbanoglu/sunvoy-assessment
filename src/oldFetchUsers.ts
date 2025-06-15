import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { writeFile } from 'node:fs/promises';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';

// Adds a timestamp and HMAC-SHA1 signature
// to the payload to ensure API integrity.
function createSignedRequest(data: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const withTimestamp: Record<string, string> = {
    ...data,
    timestamp
  };

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
function getNonceValue(htmlContent: string): string {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  // Query the input element by name or id.
  const input = document.querySelector('input[name="nonce"]') as HTMLInputElement | null;

  return input?.value || '';
}

async function getLoginNonce(fetchFn: typeof fetchWithCookies): Promise<string> {
  const response = await fetchFn('https://challenge.sunvoy.com/login', { method: 'GET' });
  const html = await response.text();
  return getNonceValue(html);
}

async function login(fetchFn: typeof fetchWithCookies, nonce: string): Promise<void> {
  const data = new URLSearchParams({ nonce, username: 'demo@example.org', password: 'test' });
  const response = await fetchFn('https://challenge.sunvoy.com/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data.toString(),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status} ${response.statusText}`);
}

const jar = new CookieJar();

// Wrap fetch with the cookie jar.
const fetchWithCookies = fetchCookie(fetch, jar);

async function fetchUsers(): Promise<void> {
  try {
    // Fetch the login page to get the CSRF nonce.
    const nonce = await getLoginNonce(fetchWithCookies);

    console.log(`Retrieved login nonce: ${nonce}`);

    console.log('> Logged in, now fetching users...');

    await login(fetchWithCookies, nonce);

    const data = new URLSearchParams({
      nonce: nonce,
      username: 'demo@example.org',
      password: 'test'
    });

    // Call the internal API to get users.
    const response = await fetchWithCookies(
      'https://challenge.sunvoy.com/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(
        `Could not load users (HTTP ${response.status})`
      );
    }

    const users = await response.json();

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
    const settingsResponse = await fetchWithCookies(
      'https://api.challenge.sunvoy.com/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!settingsResponse.ok) {
      throw new Error(
        `Failed to fetch settings: ${settingsResponse.status} ${settingsResponse.statusText}`
      );
    }

    const settings = await settingsResponse.json();

    // Combine users and settings data.
    const combinedData = { users, settings };

    const prettyJson = JSON.stringify(combinedData, null, 2);

    await writeFile('./data/users.json', prettyJson, 'utf-8');

    console.log('\nUsers and settings data saved to data/users.json');
  } catch (error) {
    console.log('\Inside catch block:\n');
    console.error(error);
  }
}

fetchUsers();