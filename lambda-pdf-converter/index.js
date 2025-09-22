const { chromium } = require('playwright');

/**
 * AWS Lambda handler for PDF conversion
 * Uses Playwright with new browser instance per request
 */
exports.handler = async (event) => {
    console.log('📝 Lambda PDF Converter - Processing request');
    
    let browser = null;
    
    try {
        // Parse the event body
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { html, url, options = {} } = body;
        
        if (!html && !url) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Either html content or url is required'
                })
            };
        }
        
        const isUrl = !!url;
        const content = url || html;
        
        console.log(`🎭 Launching Playwright browser for ${isUrl ? 'URL' : 'HTML'} conversion`);
        
        // Create fresh browser instance for each request (optimized for Lambda)
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--single-process',
                '--disable-web-security',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        });
        
        const page = await browser.newPage();
        
        if (isUrl) {
            console.log('🌐 Navigating to URL:', url);
            await page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
        } else {
            console.log('📄 Setting HTML content');
            await page.setContent(html, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
        }
        
        console.log('📄 Generating PDF...');
        const pdfBuffer = await page.pdf({
            format: options.format || 'A4',
            printBackground: true,
            margin: options.margin || {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            },
            displayHeaderFooter: options.displayHeaderFooter || false,
            landscape: options.landscape || false,
            width: options.width,
            height: options.height,
            pageRanges: options.pageRanges || '',
            headerTemplate: options.headerTemplate || '<div></div>',
            footerTemplate: options.footerTemplate || '<div></div>',
            scale: options.scale || 1.0
        });
        
        console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${options.filename || 'document.pdf'}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Access-Control-Allow-Origin': '*'
            },
            body: pdfBuffer.toString('base64'),
            isBase64Encoded: true
        };
        
    } catch (error) {
        console.error('❌ PDF conversion failed:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'PDF conversion failed',
                error: error.message
            })
        };
        
    } finally {
        // Always clean up browser
        if (browser) {
            try {
                await browser.close();
                console.log('🧹 Browser cleaned up successfully');
            } catch (cleanupError) {
                console.error('⚠️ Browser cleanup failed:', cleanupError);
            }
        }
    }
};
