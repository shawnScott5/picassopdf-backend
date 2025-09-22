// Test script to verify Lambda connection from Render
import LambdaService from './services/LambdaService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testLambdaConnection() {
    console.log('🧪 Testing Lambda connection...');
    console.log('AWS Region:', process.env.AWS_REGION);
    console.log('Lambda Function:', process.env.LAMBDA_PDF_FUNCTION_NAME);
    console.log('AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
    console.log('AWS Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
    
    const lambdaService = new LambdaService();
    
    try {
        // Test if Lambda function is available
        console.log('\n📡 Checking Lambda function availability...');
        const isAvailable = await lambdaService.isAvailable();
        
        if (isAvailable) {
            console.log('✅ Lambda function is available!');
            
            // Test PDF conversion
            console.log('\n📄 Testing PDF conversion...');
            const testHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test PDF from Render</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; }
                    </style>
                </head>
                <body>
                    <h1>Hello from Render + Lambda!</h1>
                    <p>This PDF was generated from Render using AWS Lambda.</p>
                    <p>Timestamp: ${new Date().toISOString()}</p>
                </body>
                </html>
            `;
            
            const pdfBuffer = await lambdaService.convertToPDF(testHtml, {
                format: 'A4',
                filename: 'test-from-render.pdf'
            });
            
            console.log('✅ PDF conversion successful!');
            console.log('📊 PDF size:', pdfBuffer.length, 'bytes');
            console.log('📊 PDF size:', (pdfBuffer.length / 1024).toFixed(2), 'KB');
            
        } else {
            console.log('❌ Lambda function is not available');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testLambdaConnection();
