// Test Lambda function directly
import AWS from 'aws-sdk';

const lambda = new AWS.Lambda({
    region: 'us-east-2'
});

async function testLambdaDirect() {
    console.log('🧪 Testing Lambda function directly...');
    
    const payload = {
        body: JSON.stringify({
            html: '<h1>Hello from Direct Test!</h1><p>Testing Lambda directly.</p>',
            options: {
                format: 'A4',
                filename: 'test-direct.pdf'
            }
        })
    };

    const params = {
        FunctionName: 'picassopdf-converter',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
    };

    try {
        console.log('📡 Invoking Lambda function...');
        const result = await lambda.invoke(params).promise();
        
        console.log('✅ Lambda invocation successful!');
        console.log('Status Code:', result.StatusCode);
        
        if (result.FunctionError) {
            console.log('❌ Function Error:', result.FunctionError);
            console.log('Payload:', result.Payload);
        } else {
            const response = JSON.parse(result.Payload);
            console.log('Response:', response);
        }
        
    } catch (error) {
        console.error('❌ Lambda invocation failed:', error);
    }
}

testLambdaDirect();
