import AWS from 'aws-sdk';

/**
 * Service for communicating with AWS Lambda PDF converter
 */
class LambdaService {
    constructor() {
        this.lambda = new AWS.Lambda({
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        
        this.functionName = process.env.LAMBDA_PDF_FUNCTION_NAME || 'picassopdf-converter';
    }

    /**
     * Convert HTML/URL to PDF using Lambda function
     */
    async convertToPDF(htmlOrUrl, options = {}) {
        try {
            console.log('🚀 Calling Lambda PDF converter...');
            
            const payload = {
                html: options.isUrl ? undefined : htmlOrUrl,
                url: options.isUrl ? htmlOrUrl : undefined,
                options: {
                    format: options.format || 'A4',
                    margin: options.margin || {
                        top: '20px',
                        right: '20px',
                        bottom: '20px',
                        left: '20px'
                    },
                    landscape: options.landscape || false,
                    filename: options.filename || 'document.pdf',
                    displayHeaderFooter: options.displayHeaderFooter || false,
                    headerTemplate: options.headerTemplate || '<div></div>',
                    footerTemplate: options.footerTemplate || '<div></div>',
                    scale: options.scale || 1.0,
                    pageRanges: options.pageRanges || '',
                    width: options.width,
                    height: options.height
                }
            };

            const params = {
                FunctionName: this.functionName,
                InvocationType: 'RequestResponse',
                Payload: JSON.stringify(payload)
            };

            const result = await this.lambda.invoke(params).promise();
            
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
            await this.lambda.getFunction({ FunctionName: this.functionName }).promise();
            return true;
        } catch (error) {
            console.log('⚠️ Lambda service not available:', error.message);
            return false;
        }
    }
}

export default LambdaService;
