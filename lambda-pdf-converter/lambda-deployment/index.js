const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

/**
 * AWS Lambda handler for PDF conversion
 * Uses @sparticuz/chromium with Puppeteer for optimal Lambda compatibility
 */
exports.handler = async (event) => {
    console.log('📝 Lambda PDF Converter - Processing request');
    
    let browser = null;
    
    try {
        // Parse the event body
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { 
            html = '', 
            url = '', 
            css = '', 
            javascript = '',
            options = {},
            ai_options = {},
            fileName = ''
        } = body;
        
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
        
        console.log(`🎭 Launching Chrome browser for ${isUrl ? 'URL' : 'HTML'} conversion`);
        
        // Create fresh browser instance for each request using @sparticuz/chromium
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true
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
            
            // Combine HTML with CSS and JavaScript if provided
            let fullHtml = html;
            if (css) {
                fullHtml = `<style>${css}</style>${fullHtml}`;
            }
            if (javascript) {
                fullHtml = `${fullHtml}<script>${javascript}</script>`;
            }
            
            await page.setContent(fullHtml, { 
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
            scale: options.scale || 1.0,
            ...options // Include any additional PDF options
        });
        
        console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
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