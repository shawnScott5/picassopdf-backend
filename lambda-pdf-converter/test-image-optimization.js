// Test script to check if image optimization is working in Lambda
const testPayload = {
    body: JSON.stringify({
        html: `
        <html>
        <head><title>Test Image Optimization</title></head>
        <body>
            <h1>Testing Image Optimization</h1>
            <img src="https://via.placeholder.com/150" alt="Test Image 1">
            <img src="https://via.placeholder.com/300" alt="Test Image 2">
            <p>This should test if images are being optimized.</p>
        </body>
        </html>
        `,
        options: {
            format: 'A4'
        }
    })
};

console.log('🧪 Testing Lambda function with image optimization...');
console.log('📝 Test payload:', JSON.stringify(testPayload, null, 2));

// This will be used to test the Lambda function
module.exports = { testPayload };
