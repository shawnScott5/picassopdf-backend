// Simple Lambda connection test
import LambdaService from './services/LambdaService.js';
import dotenv from 'dotenv';

dotenv.config();

async function simpleLambdaTest() {
    console.log('🧪 Simple Lambda connection test...');
    console.log('AWS Region:', process.env.AWS_REGION);
    console.log('Lambda Function:', process.env.LAMBDA_PDF_FUNCTION_NAME);
    console.log('AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
    console.log('AWS Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
    
    const lambdaService = new LambdaService();
    
    try {
        console.log('\n📡 Checking if Lambda function exists...');
        const isAvailable = await lambdaService.isAvailable();
        
        if (isAvailable) {
            console.log('✅ Lambda function is available!');
        } else {
            console.log('❌ Lambda function is not available');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    console.log('\n✅ Test completed');
}

simpleLambdaTest();

