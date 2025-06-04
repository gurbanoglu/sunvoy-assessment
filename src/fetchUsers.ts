import fetch from 'node-fetch';
import { writeFile } from 'node:fs/promises';

const cookieHeader = 'JSESSIONID=e0bc293f-78ee-495c-b0eb-df32576bc39f; _csrf_token=2d934060e09149a6de2cee49ce3cebe107792e5b88c56e05d3c2baa8a06da1fa';

async function fetchUsers() {
  const url = 'https://challenge.sunvoy.com/api/users';

  // Prepare the data to send in the request body
  const data = {
    email: 'demo@example.org',
    password: 'test'
  };

  try {
    // Call the internal API to get users.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Tell the server to expect JSON.
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      // Convert JS object to JSON string.
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch users: ${response.status} ${response.statusText}`
      );
    }

    // Parse JSON response
    const users = await response.json();

    // Convert users object to pretty formatted JSON string
    const prettyJson = JSON.stringify(users, null, 2);

    // Write the JSON string to data/users.json
    await writeFile('./data/users.json', prettyJson, 'utf-8');

    console.log('Users data saved to data/users.json');
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

// Invoke the function.
fetchUsers();