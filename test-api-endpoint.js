// Test script for the new /v1/convert/pdf endpoint
// This matches your Node.js example exactly

import axios from 'axios';
import fs from 'fs';

// Configuration
const API_KEY = 'your_actual_api_key_here'; // Replace with a real API key from your database
const BASE_URL = 'http://localhost:3000'; // Your server URL

// Test data matching your Node.js example
const testPayloads = [
    // Test 1: HTML with CSS and JavaScript (matches your example)
    {
        name: 'HTML with CSS and JavaScript',
        payload: {
            html: '<h1>Hello World</h1><p>This is a test PDF.</p>',
            css: 'h1 { color: blue; } p { font-size: 14px; }',
            javascript: 'console.log("PDF generated!");'
        },
        filename: 'test-html-css-js.pdf'
    },
    
    // Test 2: URL only
    {
        name: 'URL conversion',
        payload: {
            url: 'https://en.wikipedia.org/wiki/PDF'
        },
        filename: 'test-url.pdf'
    },
    
    // Test 3: Simple HTML only
    {
        name: 'Simple HTML only',
        payload: {
            html: '<h1>Simple Test</h1><p>This is a minimal test.</p>'
        },
        filename: 'test-simple-html.pdf'
    }
];

// Test function
async function testConversionEndpoint() {
    console.log('🧪 Testing /v1/convert/pdf endpoint...\n');
    
    for (const test of testPayloads) {
        console.log(`📝 Testing: ${test.name}`);
        console.log('Payload:', JSON.stringify(test.payload, null, 2));
        
        try {
            const response = await axios.post(
                `${BASE_URL}/v1/convert/pdf`,
                test.payload,
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer' // Important for binary PDF data
                }
            );
            
            // Save the PDF file
            fs.writeFileSync(test.filename, response.data);
            
            console.log(`✅ Success! PDF saved as: ${test.filename}`);
            console.log(`   File size: ${response.data.length} bytes`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Response:`, error.response.data.toString());
            }
        }
        
        console.log(''); // Empty line for readability
    }
}

// Test invalid payloads
async function testValidation() {
    console.log('🔍 Testing payload validation...\n');
    
    const invalidPayloads = [
        {
            name: 'No HTML or URL',
            payload: { css: 'body { color: red; }' }
        },
        {
            name: 'Both HTML and URL (should fail)',
            payload: { 
                html: '<h1>Test</h1>', 
                url: 'https://example.com' 
            }
        },
        {
            name: 'Empty payload',
            payload: {}
        }
    ];
    
    for (const test of invalidPayloads) {
        console.log(`📝 Testing validation: ${test.name}`);
        
        try {
            const response = await axios.post(
                `${BASE_URL}/v1/convert/pdf`,
                test.payload,
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`❌ Unexpected success - validation should have failed`);
            
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log(`✅ Correctly rejected: ${error.response.data.message}`);
            } else {
                console.log(`❌ Unexpected error: ${error.message}`);
            }
        }
        
        console.log('');
    }
}

// Test API key authentication
async function testAPIKeyAuth() {
    console.log('🔐 Testing API key authentication...\n');
    
    const authTests = [
        {
            name: 'No Authorization header',
            headers: { 'Content-Type': 'application/json' }
        },
        {
            name: 'Invalid API key format',
            headers: { 
                'Authorization': 'Bearer invalid_key',
                'Content-Type': 'application/json' 
            }
        },
        {
            name: 'Missing Bearer prefix',
            headers: { 
                'Authorization': API_KEY,
                'Content-Type': 'application/json' 
            }
        }
    ];
    
    const testPayload = { html: '<h1>Auth Test</h1>' };
    
    for (const test of authTests) {
        console.log(`📝 Testing auth: ${test.name}`);
        
        try {
            const response = await axios.post(
                `${BASE_URL}/v1/convert/pdf`,
                testPayload,
                { headers: test.headers }
            );
            
            console.log(`❌ Unexpected success - auth should have failed`);
            
        } catch (error) {
            if (error.response && [401, 403].includes(error.response.status)) {
                console.log(`✅ Correctly rejected: ${error.response.data.message}`);
            } else {
                console.log(`❌ Unexpected error: ${error.message}`);
            }
        }
        
        console.log('');
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting API endpoint tests...\n');
    console.log('⚠️  Make sure to replace API_KEY with a real key from your database!\n');
    
    if (API_KEY === 'your_actual_api_key_here') {
        console.log('❌ Please update the API_KEY variable with a real API key');
        return;
    }
    
    try {
        await testAPIKeyAuth();
        await testValidation();
        await testConversionEndpoint();
        
        console.log('🎉 All tests completed!');
        
    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
    }
}

// Run the tests
runAllTests();

