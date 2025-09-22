import AWS from 'aws-sdk';

// Configure AWS
const lambda = new AWS.Lambda({
    region: 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function testLambda() {
    try {
        console.log('🧪 Testing Lambda function directly...');
        
        const payload = {
            body: JSON.stringify({
                html: '<h1>Test PDF</h1><p>This is a test PDF generation.</p>',
                css: 'h1 { color: blue; }',
                javascript: 'console.log("PDF generated!");'
            })
        };

        const params = {
            FunctionName: 'picassopdf-converter',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        };

        console.log('📡 Invoking Lambda function...');
        const result = await lambda.invoke(params).promise();
        
        console.log('📄 Lambda Response:');
        console.log('Status Code:', result.StatusCode);
        console.log('Function Error:', result.FunctionError);
        
        if (result.FunctionError) {
            console.log('❌ Function Error:', result.FunctionError);
            console.log('Payload:', result.Payload);
        } else {
            const response = JSON.parse(result.Payload);
            console.log('✅ Success!');
            console.log('Response:', JSON.stringify(response, null, 2));
        }

    } catch (error) {
        console.error('❌ Lambda test failed:', error);
    }
}

testLambda();
