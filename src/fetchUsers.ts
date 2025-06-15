import { writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { JSDOM } from 'jsdom';
import 'dotenv/config';

const SUNVOY_API_URL = 'https://challenge.sunvoy.com';

type FetchFn = typeof fetchWithCookies;

type Credentials = { 
  username: string,
  password: string;
};

type UserInfo = {
  openId: string,
  operateId: string,
  language: string,
  apiuser: string;
};

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Settings {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const jar = new CookieJar();
const fetchWithCookies = fetchCookie(fetch, jar);

const credentials: Credentials = {
  username: process.env.API_USERNAME || '',
  password: process.env.API_PASSWORD || ''
};

if (!process.env.HMAC_SECRET) {
  throw new Error('HMAC_SECRET environment variable is not set');
}

const hmacSecret: string = process.env.HMAC_SECRET;

const userInfo: UserInfo = {
	openId: 'openid456',
	operateId: 'op789',
	language: 'en_US',
	apiuser: 'demo@example.org'
};

async function fetchUsersAndSettings(userInfo: UserInfo) {
  const nonce = await getLoginNonce(fetchWithCookies);

	// console.log('\nnonce:', nonce);

  if (!nonce) {
    throw new Error('Failed to retrieve nonce for login');
  }

  const loginCredentials = { nonce, ...credentials };

	// console.log('\nloginCredentials:', loginCredentials);

  // Perform a user login in order to access user data and settings.
  await login(fetchWithCookies, loginCredentials);

  return Promise.all([
    fetchUsers(fetchWithCookies, loginCredentials),
    fetchSettings(fetchWithCookies, userInfo)
  ]);
}

// Obtain the number used once (nonce) since it is
// required to ensure that each request is unique.
async function getLoginNonce(fetchFn: FetchFn) {
  const response = await fetchFn(`${SUNVOY_API_URL}/login`);

  if (!response.ok) {
    throw new Error('Failed to retrieve login page');
  }

  const htmlContent = await response.text();

  const nonce = new JSDOM(htmlContent)
    .window
    .document
    .querySelector<HTMLInputElement>('input[name="nonce"]')
    ?.value;

  return nonce;
}

async function login(
	fetchFn: FetchFn,
	credentials: Credentials & { nonce: string; }
) {
  const response = await fetchFn(`${SUNVOY_API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(credentials).toString()
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }else{
    console.log('Login successful.');
  }
}

async function fetchUsers(
	fetchFn: FetchFn,
	credentials: Credentials & { nonce: string; }
) {
  const response = await fetchFn(`${SUNVOY_API_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(new URLSearchParams(credentials)),
  });

  if (!response.ok) {
    throw new Error(
			`Failed to fetch users: ${response.status} ${response.statusText}`
		);
  }

  const users = await response.json() as User[];

	// console.log('\nusers:', users);

  return users;
}

/* Retrieves the access token that is necessary in
	 order to send the request that obtains the
	 authenticated users. */
async function fetchTokens(fetchFn: FetchFn) {
	const response = await fetchFn(
		`${SUNVOY_API_URL}/settings/tokens`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(
			`Failed to fetch access token:
			${response.status} ${response.statusText}`
		);
  }

	const htmlContent = await response.text();

  return htmlContent;
}

function extractAccessToken(htmlContent: string): string | undefined {
  const accessToken = new JSDOM(htmlContent)
    .window
    .document
    .querySelector<HTMLInputElement>('input#access_token')
    ?.value;

  return accessToken;
}

function extractUserId(htmlContent: string): string | undefined {
  const userId = new JSDOM(htmlContent)
    .window
    .document
    .querySelector<HTMLInputElement>('input#userId')
    ?.value;

  return userId;
}

async function fetchSettings(
	fetchFn: FetchFn,
	userInfo: UserInfo
) {
	const htmlContent = await fetchTokens(fetchFn);

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

	const response = await fetchFn(
		'https://api.challenge.sunvoy.com/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: createSignedRequest(accessToken, userId, userInfo).fullPayload
  });

  if (!response.ok) {
    throw new Error(
			`Failed to fetch settings: ${response.status} ${response.statusText}`
		);
  }

  const settings = await response.json() as Settings;

  return settings;
}

// Prepares and signs request payloads
// for secure API communication.
function createSignedRequest(
	accessToken: string,
  userId: string,
	data: Record<string, string>
) {
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
	const payloadEntries = Object.entries(
    {
      access_token: accessToken,
      userId: userId,
      ...data,
      timestamp
    }
  ).sort(([a], [b]) => a.localeCompare(b));

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

async function main() {
  try {
    const [users, settings] = await fetchUsersAndSettings(userInfo);

		await writeFile(
			'./data/users.json',
			JSON.stringify({ users, settings }, null, 2),
			'utf-8'
		);

    console.log(
			'Users and authenticated users successfully written to users.json'
		);
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();