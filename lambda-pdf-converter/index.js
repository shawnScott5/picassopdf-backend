const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { ImageHandler } = require('./imageHandler.js');

/**
 * AWS Lambda handler for PDF conversion
 * Optimized for speed with minimal logging and comprehensive image handling
 */
exports.handler = async (event) => {
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

        // Launch Chrome browser with optimized settings and better error handling
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
            timeout: 30000
        });

        const page = await browser.newPage();

        if (isUrl) {
            await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
        } else {
            // Combine HTML with CSS and JavaScript if provided
            let fullHtml = html;
            if (css) {
                fullHtml = `<style>${css}</style>${fullHtml}`;
            }
            if (javascript) {
                fullHtml = `${fullHtml}<script>${javascript}</script>`;
            }

            // Process images for PDF compatibility - hide broken images only
            const imageHandler = new ImageHandler();
            if (url) {
                imageHandler.setBaseUrl(url);
            }
            fullHtml = await imageHandler.processImages(fullHtml);

            await page.setContent(fullHtml, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
        }

        // Generate PDF with user-provided options
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
        // Clean up browser with better error handling
        if (browser) {
            try {
                // Wait a bit before closing to ensure all operations complete
                await new Promise(resolve => setTimeout(resolve, 100));
                await browser.close();
            } catch (cleanupError) {
                // Force kill browser if normal close fails
                try {
                    await browser.kill();
                } catch (killError) {
                    // Silent cleanup
                }
            }
        }
    }
};