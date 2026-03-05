// Quick test script to check pending payments API
import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000';

async function testPendingPayments() {
    try {
        console.log('Testing GET /api/upi-payments/pending...\n');

        const response = await fetch(`${API_URL}/api/upi-payments/pending`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Add a test token - you'll need to replace this with a real admin token
                'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE'
            }
        });

        console.log('Status:', response.status, response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('\nResponse body:');
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPendingPayments();
