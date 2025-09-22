import AWS from 'aws-sdk';

/**
 * Service for communicating with AWS Lambda PDF converter
 */
class LambdaService {
    constructor() {
        // Log environment variables at startup (for debugging - don't log secrets)
        console.log('🔧 AWS Environment Check:');
        console.log('   AWS_ACCESS_KEY_ID set:', !!process.env.AWS_ACCESS_KEY_ID);
        console.log('   AWS_SECRET_ACCESS_KEY set:', !!process.env.AWS_SECRET_ACCESS_KEY);
        console.log('   AWS_REGION set:', process.env.AWS_REGION);
        console.log('   AWS_SDK_LOAD_CONFIG set:', process.env.AWS_SDK_LOAD_CONFIG);
        
        // Configure AWS SDK v2 for Render containers
        AWS.config.update({
            region: process.env.AWS_REGION || 'us-east-2',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        
        this.lambda = new AWS.Lambda();
        this.functionName = process.env.LAMBDA_PDF_FUNCTION_NAME || 'picassopdf-converter';
        
        console.log('✅ LambdaService initialized with function:', this.functionName);
    }

    /**
     * Convert HTML/URL to PDF using Lambda function
     */
    async convertToPDF(htmlOrUrl, options = {}) {
        try {
            console.log('🚀 Calling Lambda PDF converter...');
            
            const payload = {
                body: JSON.stringify({
                    html: options.isUrl ? undefined : htmlOrUrl,
                    url: options.isUrl ? htmlOrUrl : undefined,
                    css: options.css || '',
                    javascript: options.javascript || '',
                    options: options,
                    ai_options: options.ai_options || {},
                    fileName: options.fileName || options.filename || ''
                })
            };

            const params = {
                FunctionName: this.functionName,
                InvocationType: 'RequestResponse',
                Payload: JSON.stringify(payload)
            };

            const lambdaStartTime = Date.now();
            console.log('⏱️ Lambda invocation started...');
            
            // Add timeout to prevent hanging (increased for large documents)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Lambda invocation timeout after 5 minutes')), 300000);
            });
            
            const result = await Promise.race([
                this.lambda.invoke(params).promise(),
                timeoutPromise
            ]);
            
            const lambdaEndTime = Date.now();
            console.log(`⏱️ Lambda invocation completed in: ${lambdaEndTime - lambdaStartTime}ms`);
            
            if (result.FunctionError) {
                throw new Error(`Lambda function error: ${result.FunctionError}`);
            }

            const response = JSON.parse(result.Payload);
            
            if (response.statusCode === 200) {
                // Convert base64 back to buffer
                const pdfBuffer = Buffer.from(response.body, 'base64');
                console.log(`✅ Lambda PDF conversion successful: ${pdfBuffer.length} bytes`);
                return pdfBuffer;
            } else {
                const errorBody = JSON.parse(response.body);
                throw new Error(`PDF conversion failed: ${errorBody.message}`);
            }

        } catch (error) {
            console.error('❌ Lambda PDF conversion failed:', error);
            throw error;
        }
    }

    /**
     * Check if Lambda service is available
     */
    async isAvailable() {
        try {
            const checkStartTime = Date.now();
            await this.lambda.getFunction({ FunctionName: this.functionName }).promise();
            const checkEndTime = Date.now();
            console.log(`✅ Lambda availability check took: ${checkEndTime - checkStartTime}ms`);
            return true;
        } catch (error) {
            console.log('⚠️ Lambda service not available:', error.message);
            return false;
        }
    }
}

export default LambdaService;
