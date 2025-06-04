var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetch from 'node-fetch';
import { writeFile } from 'node:fs/promises';
const cookieHeader = 'JSESSIONID=e0bc293f-78ee-495c-b0eb-df32576bc39f; _csrf_token=2d934060e09149a6de2cee49ce3cebe107792e5b88c56e05d3c2baa8a06da1fa';
function fetchUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = 'https://challenge.sunvoy.com/api/users';
        // Prepare the data to send in the request body
        const data = {
            email: 'demo@example.org',
            password: 'test'
        };
        try {
            // Call the internal API to get users.
            const response = yield fetch(url, {
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
                throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
            }
            // Parse JSON response
            const users = yield response.json();
            // Convert users object to pretty formatted JSON string
            const prettyJson = JSON.stringify(users, null, 2);
            // Write the JSON string to data/users.json
            yield writeFile('./data/users.json', prettyJson, 'utf-8');
            console.log('Users data saved to data/users.json');
        }
        catch (error) {
            console.error('Error fetching users:', error);
        }
    });
}
// Invoke the function.
fetchUsers();
