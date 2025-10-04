const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { ImageHandler } = require('./imageHandler.js');
const fs = require('fs');
const path = require('path');

/**
 * Apply professional page breaks using pagedjs and CSS
 */
async function applyPageBreaks(page) {
    try {
        console.log('Applying professional page breaks...');
        
        // Inject pagedjs CSS and JavaScript with margin override
        await page.addStyleTag({
            url: 'https://unpkg.com/pagedjs@0.4.0/dist/paged.polyfill.css'
        });
        
        // Override pagedjs margins to remove extra whitespace
        await page.addStyleTag({
            content: `
                @page {
                    margin: 0mm !important;
                }
                
                .pagedjs_pages {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .pagedjs_page {
                    margin: 0 !important;
                    padding: 0 !important;
                }
            `
        });
        
        await page.addScriptTag({
            url: 'https://unpkg.com/pagedjs@0.4.0/dist/paged.polyfill.js'
        });
        
        // Wait for pagedjs to load
        await page.waitForFunction(() => window.Paged, { timeout: 10000 });
        
        // Apply page break processing
        const result = await page.evaluate(() => {
            try {
                // Initialize pagedjs
                const paged = new window.Paged.Previewer();
                
                // Process the document with page breaks
                return paged.preview(document.body).then((flow) => {
                    console.log('Pagedjs processed', flow.total, 'pages');
                    return {
                        totalPages: flow.total,
                        success: true
                    };
                }).catch((error) => {
                    console.error('Pagedjs error:', error);
                    return {
                        totalPages: 1,
                        success: false,
                        error: error.message
                    };
                });
            } catch (error) {
                console.error('Pagedjs initialization error:', error);
                return {
                    totalPages: 1,
                    success: false,
                    error: error.message
                };
            }
        });
        
        if (result.success) {
            console.log('Page breaks applied successfully with pagedjs');
        } else {
            console.warn('Pagedjs failed, applying CSS fallback:', result.error);
            await applyCSSPageBreaks(page);
        }
        
    } catch (error) {
        console.warn('Pagedjs page break processing failed, using CSS fallback:', error.message);
        await applyCSSPageBreaks(page);
    }
}

/**
 * URL-optimized page break handling with pagedjs
 */
async function applyURLPageBreaks(page) {
    try {
        console.log('Applying URL-optimized pagedjs processing...');
        
        // First, inject CSS to prepare the page for pagedjs
        await page.addStyleTag({
            content: `
                /* URL-specific CSS preparation for pagedjs */
                
                /* Reset common layout issues */
                body, html {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Fix common responsive layouts */
                .container, .wrapper, .main, .content, .page {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 10px !important;
                    box-sizing: border-box !important;
                }
                
                /* Fix flexbox and grid for print */
                .flex, .d-flex {
                    display: block !important;
                }
                
                .grid, .d-grid {
                    display: block !important;
                }
                
                .row {
                    display: block !important;
                    width: 100% !important;
                }
                
                .col, [class*="col-"] {
                    width: 100% !important;
                    display: block !important;
                    float: none !important;
                    margin: 0 !important;
                    padding: 5px !important;
                }
                
                /* Fix common UI framework issues */
                .navbar, .nav, .header, .footer {
                    position: static !important;
                    width: 100% !important;
                }
                
                /* Ensure content flows properly */
                .sidebar {
                    display: block !important;
                    width: 100% !important;
                    float: none !important;
                }
                
                /* Fix sticky elements */
                .sticky, .fixed, [style*="position: fixed"], [style*="position: sticky"] {
                    position: static !important;
                }
                
                /* Ensure images don't break layout */
                img {
                    max-width: 100% !important;
                    height: auto !important;
                    display: block !important;
                }
                
                /* Fix text overflow */
                p, div, span, article, section {
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                }
                
                /* Remove problematic animations */
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                }
                
                /* Hide elements that don't print well */
                .no-print, .print-hidden, .advertisement, .ad, .banner {
                    display: none !important;
                }
            `
        });
        
        // Wait for CSS to apply
        await page.waitForTimeout(1000);
        
        // Now inject pagedjs with URL-specific overrides
        await page.addStyleTag({
            url: 'https://unpkg.com/pagedjs@0.4.0/dist/paged.polyfill.css'
        });
        
        // Override pagedjs defaults for URL content
        await page.addStyleTag({
            content: `
                /* URL-specific pagedjs overrides */
                @page {
                    margin: 0mm !important;
                    size: A4 !important;
                }
                
                .pagedjs_pages {
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                }
                
                .pagedjs_page {
                    margin: 0 !important;
                    padding: 10mm !important;
                    box-shadow: none !important;
                    border: none !important;
                }
                
                .pagedjs_page_content {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Ensure content fits properly */
                .pagedjs_page .container,
                .pagedjs_page .wrapper,
                .pagedjs_page .main {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Fix text flow */
                .pagedjs_page p,
                .pagedjs_page div,
                .pagedjs_page article,
                .pagedjs_page section {
                    break-inside: avoid-page !important;
                    orphans: 2 !important;
                    widows: 2 !important;
                }
                
                /* Better heading breaks */
                .pagedjs_page h1,
                .pagedjs_page h2,
                .pagedjs_page h3 {
                    break-after: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: avoid !important;
                    page-break-inside: avoid !important;
                }
            `
        });
        
        await page.addScriptTag({
            url: 'https://unpkg.com/pagedjs@0.4.0/dist/paged.polyfill.js'
        });
        
        // Wait for pagedjs to load
        await page.waitForFunction(() => window.Paged, { timeout: 10000 });
        
        // Apply URL-specific pagedjs processing
        const result = await page.evaluate(() => {
            try {
                console.log('Initializing pagedjs for URL content...');
                
                // Initialize pagedjs with URL-specific options
                const paged = new window.Paged.Previewer({
                    before: () => {
                        console.log('Starting URL page processing...');
                        // Remove any remaining problematic elements
                        const problematicElements = document.querySelectorAll('.no-print, .print-hidden, .advertisement, .ad');
                        problematicElements.forEach(el => el.remove());
                        
                        // Ensure proper text flow
                        const textElements = document.querySelectorAll('p, div, span');
                        textElements.forEach(el => {
                            el.style.wordWrap = 'break-word';
                            el.style.overflowWrap = 'break-word';
                        });
                    },
                    after: () => {
                        console.log('URL page processing completed');
                    }
                });
                
                // Process the document with enhanced error handling
                return paged.preview(document.body).then((flow) => {
                    console.log('Pagedjs processed', flow.total, 'pages for URL');
                    return {
                        totalPages: flow.total,
                        success: true
                    };
                }).catch((error) => {
                    console.error('Pagedjs URL processing error:', error);
                    return {
                        totalPages: 1,
                        success: false,
                        error: error.message
                    };
                });
            } catch (error) {
                console.error('Pagedjs URL initialization error:', error);
                return {
                    totalPages: 1,
                    success: false,
                    error: error.message
                };
            }
        });
        
        if (result.success) {
            console.log('URL-optimized pagedjs processing completed successfully');
        } else {
            console.warn('Pagedjs failed for URL, falling back to CSS page breaks:', result.error);
            await applyCSSPageBreaks(page);
        }
        
    } catch (error) {
        console.warn('URL pagedjs processing failed, using CSS fallback:', error.message);
        await applyCSSPageBreaks(page);
    }
}

/**
 * Fallback CSS-based page break handling
 */
async function applyCSSPageBreaks(page) {
    try {
        console.log('Applying CSS-based page breaks...');
        
        // Professional page break CSS
        const pageBreakCSS = `
            /* === PROFESSIONAL PAGE BREAK RULES === */
            
            /* Print-specific optimizations */
            @media print {
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                
                /* Page setup */
                @page {
                    size: A4;
                    margin: 0mm;
                }
            }
            
            /* Prevent ugly page breaks for headings */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-after: avoid !important;
                break-inside: avoid !important;
                orphans: 3 !important;
                widows: 3 !important;
            }
            
            /* Smart paragraph breaks */
            p {
                orphans: 2 !important;
                widows: 2 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Keep list items together */
            li {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                orphans: 2 !important;
                widows: 2 !important;
            }
            
            /* Prevent lists from breaking badly */
            ul, ol {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Table handling - professional approach */
            table {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                border-collapse: collapse !important;
            }
            
            /* Keep table rows together */
            tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Repeat table headers on each page */
            thead {
                display: table-header-group !important;
            }
            
            /* Keep table footers at bottom */
            tfoot {
                display: table-footer-group !important;
            }
            
            /* Image and media handling */
            img, figure, svg {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                max-width: 100% !important;
                height: auto !important;
            }
            
            /* Keep captions with images */
            figure, .figure {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            figcaption, .caption {
                page-break-before: avoid !important;
                break-before: avoid !important;
            }
            
            /* Block elements that should stay together */
            blockquote, pre, code {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                orphans: 3 !important;
                widows: 3 !important;
            }
            
            /* Div containers - smart breaking */
            .section, .card, .panel, .box, .container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Form elements */
            form, fieldset {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Navigation and UI elements */
            nav, .nav, .navigation {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Flex and grid layouts */
            .flex-container, .grid-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Force page breaks where needed */
            .page-break-before {
                page-break-before: always !important;
                break-before: page !important;
            }
            
            .page-break-after {
                page-break-after: always !important;
                break-after: page !important;
            }
            
            .no-page-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Avoid breaking after short paragraphs */
            p:has(+ h1), p:has(+ h2), p:has(+ h3), p:has(+ h4), p:has(+ h5), p:has(+ h6) {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
            
            /* Large content handling */
            .large-content {
                page-break-before: auto !important;
                break-before: auto !important;
            }
        `;
        
        await page.addStyleTag({ content: pageBreakCSS });
        
        // Apply content analysis and optimization
        await page.evaluate(() => {
            // Smart content grouping function
            function groupRelatedContent() {
                const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, table, img, figure, blockquote, pre, ul, ol');
                
                elements.forEach((element, index) => {
                    // Keep headings with next paragraph
                    if (element.matches('h1, h2, h3, h4, h5, h6')) {
                        const nextElement = element.nextElementSibling;
                        if (nextElement && nextElement.matches('p, ul, ol, table, img, figure')) {
                            // Create a wrapper to keep them together
                            const wrapper = document.createElement('div');
                            wrapper.className = 'heading-group no-page-break';
                            wrapper.style.cssText = 'page-break-inside: avoid !important; break-inside: avoid !important;';
                            
                            element.parentNode.insertBefore(wrapper, element);
                            wrapper.appendChild(element);
                            wrapper.appendChild(nextElement);
                        }
                    }
                    
                    // Keep short paragraphs with next content
                    if (element.matches('p') && element.textContent.length < 100) {
                        const nextElement = element.nextElementSibling;
                        if (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
                            element.style.cssText += 'page-break-after: avoid !important; break-after: avoid !important;';
                        }
                    }
                    
                    // Enhance table handling
                    if (element.matches('table')) {
                        // Ensure table has proper structure
                        const thead = element.querySelector('thead');
                        const tbody = element.querySelector('tbody');
                        
                        if (!thead && element.querySelector('tr')) {
                            // Convert first row to header if no thead exists
                            const firstRow = element.querySelector('tr');
                            if (firstRow && firstRow.querySelectorAll('th').length > 0) {
                                const newThead = document.createElement('thead');
                                newThead.appendChild(firstRow);
                                element.insertBefore(newThead, element.firstChild);
                            }
                        }
                        
                        // Add table wrapper for better control
                        if (!element.closest('.table-wrapper')) {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'table-wrapper no-page-break';
                            wrapper.style.cssText = 'page-break-inside: avoid !important; break-inside: avoid !important; overflow-x: auto;';
                            element.parentNode.insertBefore(wrapper, element);
                            wrapper.appendChild(element);
                        }
                    }
                    
                    // Handle images and figures
                    if (element.matches('img, figure')) {
                        // Ensure images have proper sizing
                        if (element.matches('img')) {
                            element.style.cssText += 'max-width: 100% !important; height: auto !important; page-break-inside: avoid !important;';
                        }
                        
                        // Keep images with captions
                        const caption = element.querySelector('figcaption') || element.nextElementSibling;
                        if (caption && caption.matches('figcaption, .caption')) {
                            const wrapper = element.closest('figure') || element;
                            wrapper.style.cssText += 'page-break-inside: avoid !important; break-inside: avoid !important;';
                        }
                    }
                    
                    // Handle lists intelligently
                    if (element.matches('ul, ol')) {
                        const items = element.querySelectorAll('li');
                        if (items.length <= 5) {
                            // Keep short lists together
                            element.style.cssText += 'page-break-inside: avoid !important; break-inside: avoid !important;';
                        } else {
                            // For long lists, ensure each item doesn't break
                            items.forEach(item => {
                                item.style.cssText += 'page-break-inside: avoid !important; break-inside: avoid !important;';
                            });
                        }
                    }
                    
                    // Handle code blocks and quotes
                    if (element.matches('pre, blockquote')) {
                        element.style.cssText += 'page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3 !important; widows: 3 !important;';
                    }
                });
            }
            
            // Execute content grouping
            groupRelatedContent();
            
            // Add page break hints based on content length
            const pageHeight = 297; // A4 height in mm
            const contentHeight = document.body.scrollHeight;
            const pages = Math.ceil(contentHeight / (pageHeight * 3.78)); // Approximate conversion
            
            if (pages > 1) {
                // Add strategic page break opportunities
                const sections = document.querySelectorAll('h1, h2, .section, .chapter');
                sections.forEach((section, index) => {
                    if (index > 0 && index % 2 === 0) {
                        section.style.cssText += 'page-break-before: auto !important;';
                    }
                });
            }
        });
        
        console.log('CSS page breaks applied successfully');
        
    } catch (error) {
        console.warn('CSS page break processing failed:', error.message);
    }
}

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

        // Set up proper viewport and user agent for better web page rendering
        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false
        });

        // Set a realistic user agent to avoid mobile/print CSS
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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
            
            // Wait for page to be fully rendered - only as long as needed
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    // If already complete, resolve immediately
                    if (document.readyState === 'complete') {
                        resolve();
                        return;
                    }
                    
                    // Otherwise wait for load event
                    window.addEventListener('load', resolve, { once: true });
                    
                    // Fallback timeout to prevent infinite waiting
                    setTimeout(resolve, 5000);
                });
            });
            
            // Wait for any remaining network activity to settle
            try {
                await page.waitForFunction(() => {
                    return document.readyState === 'complete' && 
                           performance.getEntriesByType('navigation')[0]?.loadEventEnd > 0;
                }, { timeout: 3000 });
            } catch (e) {
                // If page doesn't fully load within 3 seconds, continue anyway
                console.log('Page load timeout, proceeding with PDF generation');
            }
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

        // Apply CSS to preserve original webpage styling
        await page.addStyleTag({
            content: `
                /* Preserve original webpage styling */
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
                
                /* Prevent print-specific CSS from overriding web styling */
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                }
                
                /* Ensure proper layout preservation */
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    max-width: none !important;
                }
                
                /* Fix common layout issues for URL conversions */
                .container, .wrapper, .main, .content {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Preserve navigation and sidebar elements */
                nav, .navigation, .sidebar, .menu {
                    display: block !important;
                }
                
                /* Fix flexbox and grid layouts for PDF */
                .flex, .d-flex, .grid, .d-grid {
                    display: block !important;
                }
                
                .row, .col, [class*="col-"] {
                    width: 100% !important;
                    display: block !important;
                    float: none !important;
                }
                
                /* Fix common responsive issues */
                @media (max-width: 768px) {
                    * {
                        width: auto !important;
                        max-width: 100% !important;
                    }
                }
                
                /* Preserve original colors and backgrounds */
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
            `
        });

        // Apply professional page breaks with URL-specific handling
        if (isUrl) {
            console.log('Applying URL-optimized pagedjs processing');
            await applyURLPageBreaks(page);
        } else {
            await applyPageBreaks(page);
        }

        // Generate PDF with user-provided options and enhanced web page preservation
        const pdfBuffer = await page.pdf({
            format: options.format || 'A4',
            printBackground: true,
            preferCSSPageSize: false, // Use format size instead of CSS page size
            margin: options.margin || {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            },
            displayHeaderFooter: options.displayHeaderFooter || false,
            landscape: options.landscape || false,
            width: options.width,
            height: options.height,
            pageRanges: options.pageRanges || '',
            headerTemplate: options.headerTemplate || '<div></div>',
            footerTemplate: options.footerTemplate || '<div></div>',
            scale: options.scale || 1.0,
            omitBackground: false, // Preserve background colors and images
            tagged: true, // Enable PDF accessibility features
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
        console.error('❌ PDF conversion error:', error.message);
        console.error('Error stack:', error.stack);
        
        // Categorize errors for better client-side handling
        let errorCode = 'CONVERSION_FAILED';
        let statusCode = 500;
        let message = 'PDF conversion failed';
        let suggestion = 'Please try again or contact support if the issue persists';
        
        const errorMsg = error.message || '';
        
        // Timeout errors
        if (error.name === 'TimeoutError' || errorMsg.includes('timeout')) {
            errorCode = 'TIMEOUT';
            statusCode = 408;
            message = 'PDF generation timed out';
            suggestion = 'Try simplifying your content or reducing the number of images';
        }
        // Navigation/URL errors
        else if (errorMsg.includes('Navigation timeout') || errorMsg.includes('navigationtimeout')) {
            errorCode = 'URL_TIMEOUT';
            statusCode = 504;
            message = 'URL navigation timed out - the external website is too slow or unresponsive';
            suggestion = 'Check that the URL is accessible and responds quickly';
        }
        else if (errorMsg.includes('net::ERR_NAME_NOT_RESOLVED') || errorMsg.includes('NAME_NOT_RESOLVED')) {
            errorCode = 'DNS_ERROR';
            statusCode = 400;
            message = 'URL could not be resolved - domain name does not exist';
            suggestion = 'Verify that the URL is correct and the domain exists';
        }
        else if (errorMsg.includes('ERR_CONNECTION_REFUSED') || errorMsg.includes('CONNECTION_REFUSED')) {
            errorCode = 'CONNECTION_REFUSED';
            statusCode = 400;
            message = 'Connection to the URL was refused';
            suggestion = 'Ensure the website is online and accessible';
        }
        else if (errorMsg.includes('ERR_SSL') || errorMsg.includes('SSL') || errorMsg.includes('certificate')) {
            errorCode = 'SSL_ERROR';
            statusCode = 400;
            message = 'SSL certificate error for the provided URL';
            suggestion = 'Check that the website has a valid SSL certificate';
        }
        else if (errorMsg.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
            errorCode = 'CONNECTION_FAILED';
            statusCode = 502;
            message = 'Failed to establish connection to the URL';
            suggestion = 'The website may be behind a firewall or blocking our requests';
        }
        // Memory errors
        else if (errorMsg.includes('heap out of memory') || errorMsg.includes('memory')) {
            errorCode = 'OUT_OF_MEMORY';
            statusCode = 507;
            message = 'Content too complex - ran out of memory during rendering';
            suggestion = 'Reduce the size or complexity of your HTML content';
        }
        // Browser/Protocol errors
        else if (errorMsg.includes('Protocol error') || errorMsg.includes('Target closed')) {
            errorCode = 'BROWSER_CRASH';
            statusCode = 500;
            message = 'Browser crashed during PDF rendering';
            suggestion = 'Try simplifying your HTML or removing complex JavaScript';
        }
        // Session/Page errors
        else if (errorMsg.includes('Session closed') || errorMsg.includes('Execution context was destroyed')) {
            errorCode = 'SESSION_ERROR';
            statusCode = 500;
            message = 'Browser session was terminated unexpectedly';
            suggestion = 'This is usually temporary - please try again';
        }
        // Invalid content errors
        else if (errorMsg.includes('Invalid') || errorMsg.includes('Parse error')) {
            errorCode = 'INVALID_CONTENT';
            statusCode = 400;
            message = 'Invalid HTML or content provided';
            suggestion = 'Validate your HTML syntax and try again';
        }
        
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: errorCode,
                    message: message,
                    suggestion: suggestion,
                    timestamp: new Date().toISOString()
                },
                // Include original error message only in development
                ...(process.env.NODE_ENV === 'development' && { 
                    debug: {
                        originalError: error.message,
                        errorType: error.name
                    }
                })
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