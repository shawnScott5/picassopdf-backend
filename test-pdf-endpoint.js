// Test script for PDF conversion endpoint
import axios from 'axios';

const API_KEY = 'your-api-key-here'; // Replace with your actual API key
const BASE_URL = 'http://localhost:3000';

async function testPDFEndpoint() {
    console.log('🧪 Testing PDF conversion endpoint...');
    
    try {
        // Test 1: Simple HTML to PDF
        console.log('\n📄 Test 1: Simple HTML to PDF');
        const response1 = await axios.post(`${BASE_URL}/v1/convert/pdf`, {
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test PDF</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; }
                        .highlight { background-color: yellow; }
                    </style>
                </head>
                <body>
                    <h1>Hello from Local Development!</h1>
                    <p>This PDF was generated from your local server.</p>
                    <p class="highlight">Testing CSS styling in PDF generation.</p>
                    <p>Timestamp: ${new Date().toISOString()}</p>
                </body>
                </html>
            `,
            options: {
                format: 'A4',
                filename: 'test-local.pdf'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('✅ Test 1 Successful!');
        console.log('Status:', response1.status);
        console.log('Response:', response1.data);
        
    } catch (error) {
        console.error('❌ Test 1 Failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
    
    try {
        // Test 2: URL to PDF
        console.log('\n🌐 Test 2: URL to PDF');
        const response2 = await axios.post(`${BASE_URL}/v1/convert/pdf`, {
            url: 'https://example.com',
            options: {
                format: 'A4',
                filename: 'example-url.pdf'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('✅ Test 2 Successful!');
        console.log('Status:', response2.status);
        console.log('Response:', response2.data);
        
    } catch (error) {
        console.error('❌ Test 2 Failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
testPDFEndpoint();
