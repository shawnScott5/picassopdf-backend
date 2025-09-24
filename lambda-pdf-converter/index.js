const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { ImageHandler } = require('./imageHandler.js');
const fs = require('fs');
const path = require('path');

/**
 * AWS Lambda handler for PDF conversion
 * Optimized for speed with minimal logging and comprehensive image handling
 */
/**
 * Convert local file paths to base64 data URIs
 * This allows local images to work in the Lambda environment
 */
function convertLocalFilesToBase64(html) {
    // Find all img tags with file:// URLs
    const fileUrlRegex = /<img([^>]*?)src\s*=\s*["']file:\/\/([^"']+)["']([^>]*?)>/gi;
    
    let processedHtml = html;
    let match;
    
    while ((match = fileUrlRegex.exec(html)) !== null) {
        const fullMatch = match[0];
        const beforeSrc = match[1];
        const filePath = match[2];
        const afterSrc = match[3];
        
        try {
            // Convert Windows path to proper format
            const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
            const fullPath = path.resolve(normalizedPath);
            
            // Check if file exists
            if (fs.existsSync(fullPath)) {
                // Read file and convert to base64
                const fileBuffer = fs.readFileSync(fullPath);
                const base64String = fileBuffer.toString('base64');
                
                // Determine MIME type based on file extension
                const ext = path.extname(fullPath).toLowerCase();
                let mimeType = 'image/png'; // default
                
                switch (ext) {
                    case '.jpg':
                    case '.jpeg':
                        mimeType = 'image/jpeg';
                        break;
                    case '.png':
                        mimeType = 'image/png';
                        break;
                    case '.gif':
                        mimeType = 'image/gif';
                        break;
                    case '.webp':
                        mimeType = 'image/webp';
                        break;
                    case '.svg':
                        mimeType = 'image/svg+xml';
                        break;
                }
                
                // Create data URI
                const dataUri = `data:${mimeType};base64,${base64String}`;
                
                // Replace the file:// URL with data URI
                const newImgTag = `<img${beforeSrc}src="${dataUri}"${afterSrc}>`;
                processedHtml = processedHtml.replace(fullMatch, newImgTag);
                
                console.log(`✅ Converted local file to base64: ${filePath}`);
            } else {
                console.log(`❌ Local file not found: ${filePath}`);
                // Remove the img tag if file doesn't exist
                processedHtml = processedHtml.replace(fullMatch, '');
            }
        } catch (error) {
            console.log(`❌ Error converting local file ${filePath}:`, error.message);
            // Remove the img tag if conversion fails
            processedHtml = processedHtml.replace(fullMatch, '');
        }
    }
    
    return processedHtml;
}

/**
 * Remove problematic images from HTML before browser processing
 * This prevents the browser from even attempting to load them
 */
function removeProblematicImages(html) {
    const problematicServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
    
    // Replace problematic img tags with hidden divs
    let processedHtml = html;
    
    problematicServices.forEach(service => {
        // Replace img tags with problematic src attributes - use more aggressive hiding
        const imgRegex = new RegExp(`<img([^>]*?)src\\s*=\\s*["'][^"']*${service.replace('.', '\\.')}[^"']*["']([^>]*?)>`, 'gi');
        processedHtml = processedHtml.replace(imgRegex, '<div style="display:none !important; visibility:hidden !important; width:0 !important; height:0 !important; overflow:hidden !important;" data-removed-image="true"></div>');
        
        // Also handle srcset attributes in source tags
        const sourceRegex = new RegExp(`<source([^>]*?)srcset\\s*=\\s*["'][^"']*${service.replace('.', '\\.')}[^"']*["']([^>]*?)>`, 'gi');
        processedHtml = processedHtml.replace(sourceRegex, '<div style="display:none !important;" data-removed-source="true"></div>');
        
        // Handle picture elements that contain problematic images
        const pictureRegex = new RegExp(`<picture[^>]*>([\\s\\S]*?)<\\/picture>`, 'gi');
        processedHtml = processedHtml.replace(pictureRegex, (match, content) => {
            const hasProblematicService = problematicServices.some(service => 
                content.includes(service)
            );
            if (hasProblematicService) {
                return '<div style="display:none !important;" data-removed-picture="true"></div>';
            }
            return match;
        });
    });
    
    return processedHtml;
}

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

        // Set up aggressive image blocking and error handling
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const url = request.url();
            
            // Block ALL images from known problematic services immediately
            if (resourceType === 'image') {
                const invalidServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
                const hasInvalidService = invalidServices.some(service => url.includes(service));
                
                if (hasInvalidService) {
                    console.log(`🚫 BLOCKING problematic image: ${url}`);
                    request.abort('failed');
                    return;
                }
            }
            
            // Also block any request that looks like a problematic image service
            const invalidServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
            const hasInvalidService = invalidServices.some(service => url.includes(service));
            
            if (hasInvalidService) {
                console.log(`🚫 BLOCKING problematic request: ${url}`);
                request.abort('failed');
                return;
            }
            
            request.continue();
        });

        // Set image loading timeout
        await page.evaluateOnNewDocument(() => {
            // Override image loading to fail fast
            const originalImage = window.Image;
            window.Image = function() {
                const img = new originalImage();
                const originalSrc = Object.getOwnPropertyDescriptor(originalImage.prototype, 'src');
                
                Object.defineProperty(img, 'src', {
                    get: originalSrc.get,
                    set: function(value) {
                        // Check for problematic image URLs
                        const invalidServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
                        const hasInvalidService = invalidServices.some(service => value.includes(service));
                        
                        if (hasInvalidService) {
                            console.log(`Blocking problematic image in browser: ${value}`);
                            // Trigger error immediately
                            setTimeout(() => {
                                if (img.onerror) img.onerror();
                            }, 100);
                            return;
                        }
                        
                        originalSrc.set.call(this, value);
                    }
                });
                
                return img;
            };
        });

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

            // Pre-process HTML to convert local files to base64 and remove problematic images
            fullHtml = convertLocalFilesToBase64(fullHtml);
            fullHtml = removeProblematicImages(fullHtml);
            
            // Process images for PDF compatibility - hide broken images only
            const imageHandler = new ImageHandler();
            if (url) {
                imageHandler.setBaseUrl(url);
            }
            fullHtml = await imageHandler.processImages(fullHtml);

            await page.setContent(fullHtml, {
                waitUntil: 'domcontentloaded', // Changed from networkidle0 to domcontentloaded for faster loading
                timeout: 15000 // Reduced timeout
            });

            // Quick check for any remaining problematic images and hide them
            await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                images.forEach(img => {
                    const src = img.src;
                    const problematicServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
                    const hasInvalidService = problematicServices.some(service => src.includes(service));
                    
                    // Check for invalid relative paths (more specific)
                    const isInvalidRelativePath = src.startsWith('file://') && 
                                                 (src.includes('/images/') || src.includes('sample.jpg') || src.includes('placeholder'));
                    
                    // Only hide images that are clearly broken AND from problematic sources
                    const isBrokenImage = img.naturalWidth === 0 && img.naturalHeight === 0 && 
                                         (src.includes('via.placeholder.com') || src.includes('placeholder.com') || src.includes('dummyimage.com'));
                    
                    // Check if image failed to load (error state)
                    const isFailedImage = img.complete && img.naturalWidth === 0;
                    
                    // Only hide images that are definitely problematic
                    if (hasInvalidService || isInvalidRelativePath || (isBrokenImage && isFailedImage)) {
                        console.log(`🚫 Hiding problematic/broken image in browser: ${src}`);
                        console.log(`   - hasInvalidService: ${hasInvalidService}`);
                        console.log(`   - isInvalidRelativePath: ${isInvalidRelativePath}`);
                        console.log(`   - isBrokenImage: ${isBrokenImage}`);
                        console.log(`   - isFailedImage: ${isFailedImage}`);
                        
                        img.style.display = 'none !important';
                        img.style.visibility = 'hidden !important';
                        img.style.width = '0 !important';
                        img.style.height = '0 !important';
                        img.style.opacity = '0 !important';
                        
                        // Only hide the immediate parent container, not entire sections
                        const parent = img.parentElement;
                        if (parent && parent.tagName !== 'SECTION' && (hasInvalidService || isInvalidRelativePath)) {
                            // Only hide if it's a small container (like div, figure, etc.)
                            if (['DIV', 'FIGURE', 'P', 'SPAN'].includes(parent.tagName)) {
                                console.log(`🚫 Hiding parent container: ${parent.tagName}`);
                                parent.style.display = 'none !important';
                            }
                        }
                    } else {
                        // Log valid images to help debug
                        console.log(`✅ Valid image found: ${src}`);
                        console.log(`   - naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}`);
                        console.log(`   - complete: ${img.complete}`);
                    }
                });
                
                // Also hide any picture elements that might still be visible
                const pictures = document.querySelectorAll('picture');
                pictures.forEach(picture => {
                    const content = picture.innerHTML;
                    const hasProblematicService = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'].some(service => 
                        content.includes(service)
                    );
                    if (hasProblematicService) {
                        console.log(`🚫 Hiding problematic picture element in browser`);
                        picture.style.display = 'none !important';
                        picture.style.visibility = 'hidden !important';
                    }
                });
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