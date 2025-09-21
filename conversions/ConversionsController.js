import ConversionsSchema from './ConversionsSchema.js';
import LogsSchema from './LogsSchema.js';
import UserSchema from '../users/UserSchema.js';
import PDFPostProcessingService from '../services/PDFPostProcessingService.js';
import { chromium } from 'playwright';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises, existsSync } from 'fs';
// import AWS from 'aws-sdk'; // Disabled for deployment
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import os from 'os';
import QueueService from '../services/QueueService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConversionsController {
    constructor() {
        this.browser = null; // Single Playwright browser for everything
        this.pdfStoragePath = path.join(__dirname, '..', '..', 'pdfs');
        this.pdfPostProcessingService = new PDFPostProcessingService();
        this.pdfCache = new Map(); // Simple in-memory cache
        this.maxCacheSize = 100; // Maximum number of cached PDFs
        this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
        this.queueService = null; // Will be initialized conditionally
        this.ensurePDFDirectory();
        this.initializeR2();
        // Initialize Playwright browser for full HTML/CSS/JS rendering
        this.initQueue();
    }

    async ensurePDFDirectory() {
        try {
            await fsPromises.mkdir(this.pdfStoragePath, { recursive: true });
            console.log('PDF storage directory ensured:', this.pdfStoragePath);
        } catch (error) {
            console.error('Error creating PDF directory:', error);
        }
    }

    async initBrowser() {
        // Check if browser exists and is still alive
        if (this.browser) {
            try {
                // Test if browser is still connected
                const pages = await this.browser.pages();
                return this.browser;
            } catch (error) {
                console.log('🔄 Browser was closed, creating new one...');
                this.browser = null;
            }
        }

        // Create new browser instance
        try {
            // Use system-installed Chromium on Render/Docker
            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--single-process',
                    '--no-zygote',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--memory-pressure-off',
                    '--max_old_space_size=4096'
                ]
            };

            // On Render/Docker, use system Chromium
            if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
                launchOptions.executablePath = '/usr/bin/chromium';
                console.log('🐳 Using system-installed Chromium (Docker/Render)');
            }

            this.browser = await chromium.launch(launchOptions);
            console.log('✅ Playwright browser ready - optimized for Render deployment');
            return this.browser;
        } catch (error) {
            console.error('Playwright browser failed:', error);
            this.browser = null;
            throw error;
        }
    }

    initializeR2() {
        try {
            console.log('R2 initialization disabled for deployment');
                this.r2Enabled = false;
                return;
        } catch (error) {
            console.error('Error initializing R2:', error);
            this.r2Enabled = false;
        }
    }

    async uploadToR2(pdfBuffer, fileName) {
        try {
            if (!this.r2Enabled) {
                throw new Error('R2 not enabled or not properly configured');
            }

            console.log('=== R2 UPLOAD DEBUG ===');
            console.log('R2 Bucket:', this.r2BucketName);
            console.log('File Name:', fileName);
            console.log('Buffer Size:', pdfBuffer.length);
            console.log('S3 Endpoint:', this.s3.config.endpoint);

            const uploadParams = {
                Bucket: this.r2BucketName,
                Key: `pdfs/${fileName}`,
                Body: pdfBuffer,
                ContentType: 'application/pdf',
                // Remove ACL for R2 compatibility - R2 doesn't support ACL
                Metadata: {
                    'uploaded-by': 'primepdf-api',
                    'upload-timestamp': new Date().toISOString()
                }
            };

            console.log('Upload Params:', {
                Bucket: uploadParams.Bucket,
                Key: uploadParams.Key,
                ContentType: uploadParams.ContentType,
                BodySize: uploadParams.Body.length
            });

            const result = await this.s3.upload(uploadParams).promise();
            console.log('PDF uploaded to R2 successfully:', result.Location);
            
            // Generate a signed URL that's valid for 7 days
            const signedUrl = this.s3.getSignedUrl('getObject', {
                Bucket: this.r2BucketName,
                Key: result.Key,
                Expires: 7 * 24 * 60 * 60 // 7 days in seconds
            });
            
            console.log('Generated signed URL:', signedUrl);
            console.log('=== END R2 UPLOAD DEBUG ===');
            
            return {
                success: true,
                url: signedUrl, // Use signed URL instead of private URL
                key: result.Key,
                bucket: this.r2BucketName
            };
        } catch (error) {
            console.error('=== R2 UPLOAD ERROR ===');
            console.error('Error uploading to R2:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error statusCode:', error.statusCode);
            
            // Check if it's a signature error and provide helpful information
            if (error.code === 'SignatureDoesNotMatch') {
                console.error('SIGNATURE ERROR DETECTED:');
                console.error('This usually means:');
                console.error('1. Wrong R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY');
                console.error('2. Wrong R2_ACCOUNT_ID');
                console.error('3. Clock skew (check system time)');
                console.error('4. AWS SDK version compatibility issue');
                console.error('Current AWS SDK version: 2.1574.0');
            }
            
            console.error('=== END R2 UPLOAD ERROR ===');
            throw error;
        }
    }

    async downloadFromR2(fileKey) {
        try {
            if (!this.r2Enabled) {
                throw new Error('R2 not enabled or not properly configured');
            }

            const downloadParams = {
                Bucket: this.r2BucketName,
                Key: fileKey,
            };

            const result = await this.s3.getObject(downloadParams).promise();
            return result.Body;
        } catch (error) {
            console.error('Error downloading from R2:', error);
            throw error;
        }
    }

    // Generate a signed URL for an existing R2 file
    generateSignedUrl(fileKey, expiresInDays = 7) {
        try {
            if (!this.r2Enabled) {
                throw new Error('R2 not enabled or not properly configured');
            }

            const signedUrl = this.s3.getSignedUrl('getObject', {
                Bucket: this.r2BucketName,
                Key: fileKey,
                Expires: expiresInDays * 24 * 60 * 60 // Convert days to seconds
            });

            return signedUrl;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw error;
        }
    }

    // Test R2 connection
    async testR2Connection() {
        try {
            if (!this.r2Enabled) {
                throw new Error('R2 not enabled or not properly configured');
            }

            console.log('Testing R2 connection...');
            
            // Try to list objects in the bucket
            const params = {
                Bucket: this.r2BucketName,
                MaxKeys: 1
            };

            const result = await this.s3.listObjectsV2(params).promise();
            console.log('R2 connection test successful');
            console.log('Bucket contains', result.KeyCount, 'objects');
            return true;
        } catch (error) {
            console.error('R2 connection test failed:', error);
            return false;
        }
    }




    async initQueue() {
        try {
            // Only initialize queue if Redis is available
            if (process.env.REDIS_HOST || process.env.ENABLE_QUEUE === 'true') {
                this.queueService = new QueueService();
                console.log('📋 Queue service initialized');
            } else {
                console.log('📋 Queue service disabled (no Redis configuration)');
            }
        } catch (error) {
            console.error('Failed to initialize queue service:', error);
            this.queueService = null;
        }
    }


    /**
     * Generate cache key for PDF content
     */
    generateCacheKey(htmlContent, options = {}) {
        const content = JSON.stringify({ htmlContent, options });
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Get PDF from cache
     */
    getCachedPDF(cacheKey) {
        const cached = this.pdfCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            console.log('📄 Cache hit for PDF:', cacheKey.substring(0, 8) + '...');
            return cached.data;
        }
        
        if (cached) {
            // Remove expired cache entry
            this.pdfCache.delete(cacheKey);
        }
        
        return null;
    }

    /**
     * Cache PDF data
     */
    cachePDF(cacheKey, pdfBuffer) {
        // Implement LRU eviction if cache is full
        if (this.pdfCache.size >= this.maxCacheSize) {
            const firstKey = this.pdfCache.keys().next().value;
            this.pdfCache.delete(firstKey);
        }
        
        this.pdfCache.set(cacheKey, {
            data: pdfBuffer,
            timestamp: Date.now()
        });
        
        console.log('💾 Cached PDF:', cacheKey.substring(0, 8) + '...', 
                   `(${this.pdfCache.size}/${this.maxCacheSize})`);
    }

    /**
     * PDF generation using Playwright (handles concurrency internally)
     */
    async generatePDF(htmlContent, options = {}) {
        // Check cache first (skip for URLs to avoid stale content)
        if (!options.isUrl) {
            const cacheKey = this.generateCacheKey(htmlContent, options);
            const cachedPDF = this.getCachedPDF(cacheKey);
            if (cachedPDF) {
                console.log('✅ Serving PDF from cache:', cacheKey.substring(0, 8) + '...');
                return cachedPDF;
            }
            console.log('💾 Cached PDF:', cacheKey.substring(0, 8) + '...', 
                       `(${this.pdfCache.size}/${this.maxCacheSize})`);
        }

        // Use Playwright for full HTML/CSS/JS rendering
        console.log('📝 Generating PDF using Playwright...');
        
        let browser = null;
        let context = null;
        let page = null;
            
        try {
            // Create a completely fresh browser instance for each request
            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--single-process',
                    '--no-zygote',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--memory-pressure-off',
                    '--max_old_space_size=4096'
                ]
            };

            // Force system Chromium in Docker/Render environment
            if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
                // Check multiple possible Chromium paths
                const paths = ["/usr/bin/chromium", "/usr/bin/chromium-browser"];
                const execPath = paths.find(p => existsSync(p));
                
                if (execPath) {
                    launchOptions.executablePath = execPath;
                    console.log('🐳 Using system Chromium at:', execPath);
                } else {
                    console.log('⚠️ No system Chromium found, using Playwright bundled browser');
                }
            }

            browser = await chromium.launch(launchOptions);
            
            // Create a new context and page for complete isolation
            context = await browser.newContext();
            page = await context.newPage();
            
            if (options.isUrl) {
                // URL request - navigate directly
                console.log('🌐 URL request detected - navigating to URL');
                await page.goto(htmlContent, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
            } else {
                // HTML content - set content directly
                console.log('📄 HTML content detected - setting content');
            await page.setContent(htmlContent, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
            }
            
            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: options.format || 'A4',
                printBackground: true,
                margin: options.margin || {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });
            
            console.log(`📄 PDF generated: ${pdfBuffer.length} bytes`);
            return pdfBuffer;

        } catch (error) {
            console.error('Error in generatePDF:', error);
            throw error;
        } finally {
            // Always clean up - close page, context, and browser
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    console.log('Page already closed');
                }
            }
            if (context) {
                try {
                    await context.close();
                } catch (e) {
                    console.log('Context already closed');
                }
            }
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.log('Browser already closed');
                }
            }
        }
    }


    /**
     * Check HTML for broken layouts using Gemini Flash API
     * Simplified version without browser rendering
     */
    async checkHTMLWithGemini(htmlContent) {
        try {
            const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
            if (!geminiApiKey) {
                console.warn('GOOGLE_GEMINI_API_KEY not found in environment variables');
                return htmlContent; // Return original HTML if no API key
            }

            // First, check if the HTML has structural issues (broken tags, etc.)
            const hasStructuralIssues = this.detectStructuralIssues(htmlContent);
            
            if (hasStructuralIssues) {
                console.log('Step 1: Detected structural issues, asking Gemini to fix broken HTML...');
                
                const fixPrompt = `Please fix this broken HTML code by correcting any structural issues such as:
1. Unclosed HTML tags
2. Missing closing tags
3. Malformed table structures
4. Incorrect nesting
5. Missing DOCTYPE or basic HTML structure

Broken HTML to fix:
${htmlContent}

IMPORTANT: Respond with ONLY the corrected HTML code. Do not include any markdown formatting, code blocks, or explanations. Just return the clean, valid HTML.`;

                const fixResponse = await axios.post(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: fixPrompt
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-goog-api-key': geminiApiKey
                        },
                        timeout: 30000
                    }
                );

                const fixedHtml = fixResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (fixedHtml && fixedHtml.trim() !== 'NO_CHANGES_NEEDED') {
                    console.log('Gemini fixed broken HTML structure');
                    console.log('Raw Gemini response:', fixedHtml);
                    
                    // Extract HTML from markdown code blocks if present
                    let cleanedHtml = fixedHtml.trim();
                    
                    // Remove markdown code block markers
                    if (cleanedHtml.startsWith('```html') || cleanedHtml.startsWith('```')) {
                        cleanedHtml = cleanedHtml.replace(/^```(?:html)?\s*/, '').replace(/\s*```$/, '');
                    }
                    
                    // Remove any remaining markdown formatting
                    cleanedHtml = cleanedHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
                    
                    console.log('Cleaned HTML:', cleanedHtml);
                    return cleanedHtml;
                }
            }

            // Step 2: Analyze HTML structure (no browser rendering needed)
            console.log('Step 2: Analyzing HTML structure...');
            
            // Step 3: Analyze the HTML with Gemini for layout issues
            console.log('Step 3: Analyzing HTML with Gemini...');
            
            const prompt = `Please analyze this HTML code for potential broken layouts, missing CSS, or structural issues that could cause rendering problems in PDF generation. 

Focus on:
1. Layout issues that might not render properly in PDF
2. Missing or broken CSS that could cause layout problems
3. Elements with problematic positioning (absolute, fixed)
4. Overflow issues that might cause content to be cut off
5. Missing viewport meta tags
6. CSS that might not be PDF-friendly

Rendered HTML to analyze:
${renderedData.html}

Computed styles summary:
${JSON.stringify(renderedData.computedStyles, null, 2)}

Has potential errors: ${renderedData.hasErrors}

IMPORTANT: If changes are needed, respond with ONLY the corrected HTML code. Do not include any markdown formatting, code blocks, or explanations. If no changes are needed, respond with exactly "NO_CHANGES_NEEDED".`;

            const response = await axios.post(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
                {
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': geminiApiKey
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            const geminiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log('GEMINI RESPONSE:', geminiResponse)
            if (!geminiResponse) {
                console.warn('No response from Gemini API............');
                return htmlContent;
            }

            if (geminiResponse.trim() === 'NO_CHANGES_NEEDED') {
                console.log('Gemini analysis: No changes needed for rendered HTML!!!!!!');
                return htmlContent;
            }

            console.log('Gemini analysis: Rendered HTML has been corrected!!!!!!!!');
            console.log('Raw Gemini response:', geminiResponse);
            
            // Extract HTML from markdown code blocks if present
            let cleanedHtml = geminiResponse.trim();
            
            // Remove markdown code block markers
            if (cleanedHtml.startsWith('```html') || cleanedHtml.startsWith('```')) {
                cleanedHtml = cleanedHtml.replace(/^```(?:html)?\s*/, '').replace(/\s*```$/, '');
            }
            
            // Remove any remaining markdown formatting
            cleanedHtml = cleanedHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            console.log('Cleaned HTML from Gemini:', cleanedHtml);
            return cleanedHtml;

        } catch (error) {
            console.error('Gemini API error:', error.message);
            // Return original HTML if Gemini fails
            return htmlContent;
        }
    }

    // Helper method to detect structural HTML issues
    detectStructuralIssues(html) {
        // Check for common structural issues
        const issues = [];
        
        // Check for unclosed tags (basic check)
        const openTags = html.match(/<[^/][^>]*>/g) || [];
        const closeTags = html.match(/<\/[^>]*>/g) || [];
        
        // Check for common broken patterns
        if (html.includes('<p>') && !html.includes('</p>')) issues.push('unclosed p tags');
        if (html.includes('<div>') && !html.includes('</div>')) issues.push('unclosed div tags');
        if (html.includes('<span>') && !html.includes('</span>')) issues.push('unclosed span tags');
        if (html.includes('<table>') && !html.includes('</table>')) issues.push('unclosed table tags');
        if (html.includes('<tr>') && !html.includes('</tr>')) issues.push('unclosed tr tags');
        if (html.includes('<td>') && !html.includes('</td>')) issues.push('unclosed td tags');
        
        // Check for malformed table structure
        if (html.includes('<table>') && !html.includes('<tbody>') && !html.includes('<thead>')) {
            issues.push('malformed table structure');
        }
        
        // Check for missing DOCTYPE
        if (!html.includes('<!DOCTYPE')) {
            issues.push('missing DOCTYPE');
        }
        
        console.log('Detected structural issues:', issues);
        return issues.length > 0;
    }

    async convertHTMLToPDF(data) {
        try {
            console.log('Converting HTML to PDF');
            
            const { htmlContent, css, javascript, htmlUrl, fileName, options = {}, aiOptions = {} } = data;
            
            if (!htmlContent && !htmlUrl) {
                throw new Error('Either htmlContent or htmlUrl must be provided');
            }

            let htmlToConvert = htmlContent;
            
            // If URL is provided, fetch the HTML content
            if (htmlUrl && !htmlContent) {
                try {
                    const response = await axios.get(htmlUrl, {
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    htmlToConvert = response.data;
                } catch (fetchError) {
                    throw new Error(`Failed to fetch HTML from URL: ${fetchError.message}`);
                }
            }

            // Check for layout repair using Gemini if aiOptions.layoutRepair is true
            if (aiOptions.layoutRepair === true) {
                console.log('=== AI REPAIR DEBUG ===');
                console.log('Original HTML before AI repair:', htmlToConvert);
                console.log('Running Gemini layout repair analysis...');
                htmlToConvert = await this.checkHTMLWithGemini(htmlToConvert);
                console.log('HTML after AI repair:', htmlToConvert);
                console.log('=== END AI REPAIR DEBUG ===');
            }

            // Ensure htmlToConvert is not undefined or null after all processing
            if (!htmlToConvert) {
                throw new Error('No HTML content available to convert');
            }

            // Combine separate CSS and JavaScript into HTML if provided
            if (css) {
                // Insert CSS before </head> tag, or at the end if no </head> found
                if (htmlToConvert.includes('</head>')) {
                    htmlToConvert = htmlToConvert.replace('</head>', `<style>${css}</style></head>`);
                } else {
                    // If no </head> tag, add CSS at the beginning after <html> or <body>
                    if (htmlToConvert.includes('<body>')) {
                        htmlToConvert = htmlToConvert.replace('<body>', `<body><style>${css}</style>`);
                    } else if (htmlToConvert.includes('<html>')) {
                        htmlToConvert = htmlToConvert.replace('<html>', `<html><head><style>${css}</style></head>`);
                    } else {
                        // Fallback: prepend CSS
                        htmlToConvert = `<style>${css}</style>${htmlToConvert}`;
                    }
                }
                console.log('CSS content combined into HTML');
            }

            if (javascript) {
                // Insert JavaScript before </body> tag, or at the end if no </body> found
                if (htmlToConvert.includes('</body>')) {
                    htmlToConvert = htmlToConvert.replace('</body>', `<script>${javascript}</script></body>`);
                } else {
                    // If no </body> tag, add JavaScript at the end
                    htmlToConvert = `${htmlToConvert}<script>${javascript}</script>`;
                }
                console.log('JavaScript content combined into HTML');
            }

            // Use the existing renderHTMLToPDF method
            const pdfBuffer = await this.renderHTMLToPDF(htmlToConvert, '', options);
            
            return pdfBuffer;
            
        } catch (error) {
            console.error('HTML PDF conversion error:', error);
            throw error;
        }
    }

    // Get professional page break options for users
    getPageBreakOptions() {
        return {
            // CSS classes users can add to their HTML for control
            classes: {
                'page-break-before': 'Force a page break before this element',
                'page-break-after': 'Force a page break after this element', 
                'no-page-break': 'Keep this element together on one page',
                'heading-group': 'Keep heading with following content',
                'table-wrapper': 'Smart table page break handling',
                'large-content': 'Handle large content intelligently'
            },
            // Options users can pass in API calls
            apiOptions: {
                format: 'A4, A3, A5, Letter, Legal, Tabloid',
                landscape: 'true/false - Landscape orientation',
                displayHeaderFooter: 'true/false - Show page numbers',
                headerTemplate: 'Custom HTML for header',
                footerTemplate: 'Custom HTML for footer',
                margin: 'Custom margins {top, right, bottom, left}',
                scale: '0.1 to 2 - Scale content',
                pageRanges: 'e.g., "1-3,5" - Specific page ranges'
            },
            // Best practices
            bestPractices: [
                'Use semantic HTML (h1-h6, table, figure, etc.)',
                'Add thead/tbody to tables for proper header repetition',
                'Keep related content in wrapper divs',
                'Use figcaption with images',
                'Avoid very long paragraphs (split at logical points)',
                'Test with various content lengths'
            ]
        };
    }

    // Web scraping functionality to extract HTML, CSS, and JS from a website
    async scrapeWebsite(url) {
        try {
            console.log(`Starting web scraping for URL: ${url}`);
            
            // Validate URL
            const urlPattern = /^https?:\/\/.+/i;
            if (!urlPattern.test(url)) {
                throw new Error('Invalid URL format. URL must start with http:// or https://');
            }

            // Use simple fetch for URL scraping (no browser needed)
            const response = await axios.get(url, { timeout: 15000 });
            const htmlContent = response.data;
            
            // Simple HTML content extraction (no browser needed)
            
            const resources = {
                css: [],
                js: [],
                html: htmlContent
            };
            
            // Parse HTML with Cheerio for additional processing
            const $ = cheerio.load(htmlContent);
            
            // Extract inline CSS
            const inlineCss = [];
            $('style').each((i, elem) => {
                inlineCss.push($(elem).html());
            });
            
            // Extract inline JavaScript
            const inlineJs = [];
            $('script').each((i, elem) => {
                const scriptContent = $(elem).html();
                if (scriptContent && !$(elem).attr('src')) {
                    inlineJs.push(scriptContent);
                }
            });
            
            // Clean up the HTML by removing script tags and external references
            $('script').remove();
            $('noscript').remove();
            
            // Convert relative URLs to absolute URLs
            const baseUrl = new URL(url).origin;
            
            // Fix image sources
            $('img').each((i, elem) => {
                const src = $(elem).attr('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                    const absoluteUrl = new URL(src, url).href;
                    $(elem).attr('src', absoluteUrl);
                }
            });
            
            // Fix link hrefs
            $('a').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                    const absoluteUrl = new URL(href, url).href;
                    $(elem).attr('href', absoluteUrl);
                }
            });
            
            // Combine all CSS
            const allCss = inlineCss.join('\n\n');
            
            // Combine all JavaScript
            const allJs = inlineJs.join('\n\n');
            
            const cleanHtml = $.html();
            
            console.log(`Web scraping completed successfully for ${url}`);
            console.log(`Extracted HTML: ${cleanHtml.length} characters`);
            console.log(`Extracted CSS: ${allCss.length} characters`);
            console.log(`Extracted JS: ${allJs.length} characters`);
            
            return {
                html: cleanHtml,
                css: allCss,
                javascript: allJs,
                sourceUrl: url,
                scrapedAt: new Date()
            };
            
        } catch (error) {
            console.error('Web scraping failed:', error);
            throw new Error(`Failed to scrape website: ${error.message}`);
        }
    }

    // Intelligent content analysis for smart page breaks
    async analyzeAndOptimizeContent(html, page) {
        try {
            // Inject content analysis script
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
            
            console.log('Content analysis and optimization completed');
            
            // Log page break optimization stats
            const stats = await page.evaluate(() => {
                return {
                    headingGroups: document.querySelectorAll('.heading-group').length,
                    tableWrappers: document.querySelectorAll('.table-wrapper').length,
                    noBreakElements: document.querySelectorAll('.no-page-break').length,
                    tablesWithHeaders: document.querySelectorAll('table thead').length,
                    totalElements: document.querySelectorAll('*').length
                };
            });
            
            console.log('Page break optimization stats:', stats);
            
        } catch (error) {
            console.warn('Content analysis failed, proceeding with standard rendering:', error.message);
        }
    }

    // Professional page break CSS to prevent ugly breaks
    getProfessionalPageBreakCSS() {
        return `
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
                    margin: 10mm 0mm;
                }
            }
            
            /* Prevent ugly page breaks for headings */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-after: avoid !important;
                break-inside: avoid !important;
                /* Keep heading with next 2-3 lines */
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
    }

    async renderHTMLToPDF(html, css, options = {}) {
        try {
            // Use Playwright for PDF generation with full HTML/CSS/JS rendering
            const pdfBuffer = await this.generatePDF(html, options);
            return pdfBuffer;
        } catch (error) {
            console.error('HTML to PDF rendering error:', error);
            throw error;
        }
    }

    // Get page break options API endpoint
    async getPageBreakOptionsAPI(req, res, next) {
        try {
            const options = this.getPageBreakOptions();
            
            res.status(200).json({
                success: true,
                message: 'Page break options retrieved successfully',
                data: options,
                examples: {
                    basicUsage: {
                        html: '<div class="no-page-break"><h2>Title</h2><p>Content that stays together</p></div>',
                        description: 'Keep title and content together'
                    },
                    tableExample: {
                        html: '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>',
                        description: 'Table with repeating headers'
                    },
                    pageBreakControl: {
                        html: '<div class="page-break-before"><h1>New Section</h1></div>',
                        description: 'Force new page before section'
                    }
                }
            });
            
        } catch (error) {
            console.error('Get page break options error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get page break options',
                error: error.message
            });
        }
    }

    // Convert HTML to PDF API endpoint
    async convertHTMLToPDFAPI(req, res, next) {
        const startTime = Date.now();
        let conversionRecord = null;
        let logRecord = null;

        try {
            const { html, css, javascript, htmlUrl, url, fileName, options = {}, aiOptions = {} } = req.body;
            const saveToVault = options.saveToVault || false;
            
            console.log('=== CONVERSION REQUEST DEBUG ===');
            console.log('HTML provided:', !!html);
            console.log('CSS provided:', !!css);
            console.log('JavaScript provided:', !!javascript);
            console.log('URL provided:', !!url);
            console.log('HtmlUrl provided:', !!htmlUrl);
            console.log('Save to Vault:', saveToVault);
            console.log('=== END CONVERSION REQUEST DEBUG ===');
            
            // Extract company and user info from request
            const companyId = req.user?.companyId || req.companyId;
            const userId = req.userId || req.user?.id;
            
            if (!companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID is required for PDF conversion'
                });
            }
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required for PDF conversion'
                });
            }
            
            // Validation logic: html OR url (but not both)
            const hasHtml = !!(html || htmlUrl);
            const hasUrl = !!url;
            
            if (!hasHtml && !hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Either "html" OR "url" must be provided'
                });
            }
            
            if (hasHtml && hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide either "html" OR "url", not both. Choose one input method.'
                });
            }

            let finalHtml, finalCss, finalJs, sourceInfo;
            
            // If url is provided, scrape the website
            if (hasUrl) {
                console.log('URL provided, starting web scraping...');
                try {
                    const scrapedData = await this.scrapeWebsite(url);
                    finalHtml = scrapedData.html;
                    finalCss = scrapedData.css;
                    finalJs = scrapedData.javascript;
                    sourceInfo = {
                        type: 'scraped',
                        url: url,
                        scrapedAt: scrapedData.scrapedAt
                    };
                    console.log('Web scraping completed successfully');
                } catch (error) {
                    console.error('Web scraping failed:', error);
                    return res.status(400).json({
                        success: false,
                        message: `Failed to scrape website: ${error.message}`
                    });
                }
            } else {
                // Use provided HTML, CSS, JS
                finalHtml = html || htmlUrl;
                finalCss = css || '';
                finalJs = javascript || '';
                sourceInfo = {
                    type: 'provided',
                    hasHtmlUrl: !!htmlUrl
                };
                console.log('Using provided HTML content');
            }
            
            // Calculate input size
            const inputSizeBytes = (finalHtml ? Buffer.byteLength(finalHtml, 'utf8') : 0) + 
                                 (finalCss ? Buffer.byteLength(finalCss, 'utf8') : 0) + 
                                 (finalJs ? Buffer.byteLength(finalJs, 'utf8') : 0);
            
            // Generate unique request ID
            const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Create log record for tracking
            logRecord = new LogsSchema({
                companyId,
                userId,
                requestId,
                inputType: hasUrl ? 'url' : (htmlUrl ? 'htmlUrl' : 'html'),
                inputSizeBytes,
                status: 'processing',
                apiEndpoint: '/api/conversions/convert-html-to-pdf',
                generationTimeMs: 0, // Will be updated after completion
                creditUsed: 1, // Default credit usage
                saveToVault: saveToVault,
                userAgent: req.get('User-Agent'),
                ipAddress: req.ip || req.connection.remoteAddress,
                conversionOptions: { 
                    saveToVault: saveToVault,
                    sourceInfo: sourceInfo
                }
            });
            await logRecord.save();

            // Create conversion record only if saveToVault is true
            let conversionRecord = null;
            const recordFileName = fileName || `${hasUrl ? 'url' : 'html'}-conversion-${Date.now()}`;
            
            if (saveToVault) {
                conversionRecord = new ConversionsSchema({
                    companyId: companyId,
                    userId: userId,
                    dataType: 'html',
                    fileName: recordFileName,
                    sourceType: hasUrl ? 'upload' : 'raw',
                    status: 'processing',
                    htmlContent: finalHtml,
                    cssContent: finalCss || undefined,
                    jsContent: finalJs || undefined,
                    linkUrl: hasUrl ? url : undefined
                });
                await conversionRecord.save();
            }

            // Convert HTML to PDF
            const pdfBuffer = await this.convertHTMLToPDF({
                htmlContent: finalHtml,
                css: finalCss,
                javascript: finalJs,
                htmlUrl: hasLink ? null : htmlUrl, // Don't pass htmlUrl if we're using scraped content
                fileName: recordFileName,
                options,
                aiOptions,
                sourceInfo
            });

            if (!pdfBuffer) {
                throw new Error('Failed to generate PDF');
            }

            // Save PDF to R2 if saveToVault is true, otherwise don't save anywhere
            const pdfFileName = saveToVault ? `${conversionRecord._id}_${recordFileName}.pdf` : `${recordFileName}.pdf`;
            let storageInfo = {};

            console.log('=== STORAGE DECISION DEBUG ===');
            console.log('Save to Vault:', saveToVault);
            console.log('R2 Enabled:', this.r2Enabled);

            if (saveToVault) {
                if (this.r2Enabled) {
                    // Save to Cloudflare R2
                    console.log('Saving PDF to Cloudflare R2...');
                    const r2Result = await this.uploadToR2(pdfBuffer, pdfFileName);
                    storageInfo = {
                        storageType: 'r2',
                        r2Url: r2Result.url,
                        r2Key: r2Result.key,
                        r2Bucket: r2Result.bucket
                    };
                    console.log('PDF saved to R2:', r2Result.url);
                    console.log('Storage Info set to:', storageInfo);
                } else {
                    // R2 is not enabled but saveToVault is true - fail the conversion
                    throw new Error('Cloudflare R2 storage is not configured. Cannot save to vault.');
                }
            } else {
                // saveToVault is false - don't save anywhere, just return the PDF
                console.log('Save to Vault is false - PDF not saved to storage');
                storageInfo = {
                    storageType: 'none',
                    message: 'PDF not saved to storage'
                };
            }
            console.log('=== END STORAGE DECISION DEBUG ===');

            // Get PDF page count for credits calculation
            let pageCount = 1; // Default to 1 page if we can't determine
            try {
                const pdfMetadata = await this.pdfPostProcessingService.getPDFMetadata(pdfBuffer);
                pageCount = pdfMetadata.pageCount || 1;
                console.log(`PDF has ${pageCount} pages`);
            } catch (error) {
                console.warn('Could not determine PDF page count, defaulting to 1:', error);
            }

            // Update record with success only if conversion record exists
            if (conversionRecord) {
                conversionRecord.status = 'completed';
                conversionRecord.fileSize = pdfBuffer.length;
                conversionRecord.processingTime = Date.now() - startTime;
                conversionRecord.completedAt = new Date();
                conversionRecord.filePath = pdfFileName;
                conversionRecord.storageInfo = storageInfo; // Store R2 info in the record
                conversionRecord.creditsUsed = pageCount; // Set credits based on page count
                
                console.log('=== MONGODB UPDATE DEBUG ===');
                console.log('Updating conversion record with storage info:', storageInfo);
                console.log('Conversion record ID:', conversionRecord._id);
                
                await conversionRecord.save();
                
                console.log('Conversion record saved successfully');
                console.log('Final storage info in record:', conversionRecord.storageInfo);
                console.log('=== END MONGODB UPDATE DEBUG ===');
            } else {
                console.log('No conversion record to update (saveToVault: false)');
            }

            // Update log record with success
            const generationTime = Date.now() - startTime;
            logRecord.status = 'success';
            logRecord.outputSizeBytes = pdfBuffer.length;
            logRecord.generationTimeMs = generationTime;
            logRecord.creditUsed = pageCount; // Update with actual page count
            logRecord.storageRef = saveToVault && conversionRecord ? conversionRecord._id.toString() : null;
            await logRecord.save();

            // Update user credits based on page count
            await this.updateUserCredits(userId, pageCount);

            // Get file size in MB
            const fileSizeMB = this.getFileSizeInMB(pdfBuffer.length);

            res.json({
                success: true,
                message: 'HTML converted to PDF successfully',
                data: {
                    id: conversionRecord ? conversionRecord._id : null,
                    fileName: recordFileName,
                    fileSize: pdfBuffer.length,
                    fileSizeMB: fileSizeMB,
                    fileSizeFormatted: conversionsController.formatFileSize(pdfBuffer.length),
                    processingTime: Date.now() - startTime,
                    downloadUrl: storageInfo.storageType === 'r2' ? storageInfo.r2Url : null, // R2 URL if saved to vault
                    sourceUrl: htmlUrl || 'html-content',
                    status: 'completed',
                    storageInfo: storageInfo, // Include storage information
                    savedToVault: saveToVault
                }
            });

        } catch (error) {
            console.error('HTML to PDF API Error:', error);
            
            // Update record with error if it exists
            if (conversionRecord) {
                try {
                    conversionRecord.status = 'failed';
                    conversionRecord.errorMessage = error.message;
                    conversionRecord.processingTime = Date.now() - startTime;
                    await conversionRecord.save();
                } catch (saveError) {
                    console.error('Error updating conversion record:', saveError);
                }
            }

            // Update log record with error if it exists
            if (logRecord) {
                try {
                    const generationTime = Date.now() - startTime;
                    logRecord.status = 'failed';
                    logRecord.errorMessage = error.message;
                    logRecord.generationTimeMs = generationTime;
                    await logRecord.save();
                } catch (saveError) {
                    console.error('Error updating log record:', saveError);
                }
            }

            res.status(500).json({
                success: false,
                message: 'HTML to PDF conversion failed',
                error: error.message
            });
        }
    }

    // Async PDF generation using queue (returns job ID)
    async convertHTMLToPDFAsync(req, res, next) {
        const startTime = Date.now();
        let conversionRecord = null;
        let logRecord = null;

        try {
            if (!this.queueService) {
                return res.status(503).json({
                    success: false,
                    message: 'Queue service not available. Use synchronous endpoint instead.',
                    endpoint: '/api/v1/convert/pdf'
                });
            }

            // Extract and validate payload
            const { html, css, javascript, url, options = {}, ai_options = {} } = req.body;
            
            // Validation: exactly one of 'html' OR 'url' must be provided
            const hasHtml = !!html;
            const hasUrl = !!url;
            
            if (!hasHtml && !hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Either "html" or "url" field is required'
                });
            }
            
            if (hasHtml && hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Provide either "html" OR "url", not both'
                });
            }

            // Get user and company info from API key
            const companyId = req.apiKey.companyId;
            const userId = req.apiKey.userId;
            
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid API key: missing user or company information'
                });
            }

            // Check permissions
            if (!req.apiKey.permissions.includes('pdf_conversion') && 
                !req.apiKey.permissions.includes('html_to_pdf')) {
                return res.status(403).json({
                    success: false,
                    message: 'API key does not have permission for PDF conversion'
                });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const fileName = `api-conversion-${timestamp}.pdf`;
            const filePath = path.join(this.pdfStoragePath, fileName);

            // Create conversion record
            conversionRecord = new ConversionsSchema({
                companyId: companyId,
                userId: userId,
                fileName: fileName,
                filePath: filePath,
                fileSize: 0,
                dataType: hasUrl ? 'url' : 'html',
                sourceType: hasUrl ? 'upload' : 'raw',
                status: 'queued',
                createdAt: new Date(),
                metadata: {
                    apiKeyId: req.apiKey._id,
                    source: 'public_api_v1_async',
                    hasCSS: !!css,
                    hasJavaScript: !!javascript,
                    originalUrl: url || null,
                    saveToVault: options.save_to_vault || false,
                    layoutRepair: ai_options.layout_repair || false,
                    options: options,
                    aiOptions: ai_options
                }
            });
            await conversionRecord.save();

            // Create log record
            const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            logRecord = new LogsSchema({
                companyId: companyId,
                userId: userId,
                conversionId: conversionRecord._id,
                requestId: requestId,
                timestamp: new Date(),
                status: 'queued',
                fileSize: 0,
                fileName: fileName,
                dataType: hasUrl ? 'url' : 'html',
                processingTime: 0,
                generationTimeMs: 0,
                inputSizeBytes: html ? Buffer.byteLength(html, 'utf8') : 0,
                apiEndpoint: '/api/v1/convert/pdf/async',
                metadata: {
                    apiKeyId: req.apiKey._id,
                    source: 'public_api_v1_async',
                    saveToVault: options.save_to_vault || false,
                    layoutRepair: ai_options.layout_repair || false
                }
            });
            await logRecord.save();

            // Add job to queue
            const jobResult = await this.queueService.addPDFJob({
                html,
                css,
                javascript,
                url,
                options,
                ai_options,
                companyId,
                userId,
                apiKeyId: req.apiKey._id,
                fileName,
                filePath,
                conversionId: conversionRecord._id,
                logId: logRecord._id
            }, {
                priority: options.priority || 0,
                delay: options.delay || 0
            });

            res.status(202).json({
                success: true,
                message: 'PDF generation job queued successfully',
                jobId: jobResult.jobId,
                status: 'queued',
                estimatedWaitTime: jobResult.estimatedWaitTime,
                statusUrl: `/api/v1/jobs/${jobResult.jobId}`,
                conversionId: conversionRecord._id,
                requestId: requestId
            });

        } catch (error) {
            console.error('Async PDF conversion failed:', error);
            
            const generationTime = Date.now() - startTime;
            
            // Update records with error
            if (conversionRecord) {
                conversionRecord.status = 'failed';
                conversionRecord.errorMessage = error.message;
                conversionRecord.generationTimeMs = generationTime;
                await conversionRecord.save();
            }
            
            if (logRecord) {
                logRecord.status = 'failed';
                logRecord.errorMessage = error.message;
                logRecord.generationTimeMs = generationTime;
                await logRecord.save();
            }

            res.status(500).json({
                success: false,
                message: 'Failed to queue PDF generation job',
                error: error.message
            });
        }
    }

    // Public API endpoint for external developers - returns binary PDF data
    async convertHTMLToPDFAPIPublic(req, res, next) {
        const startTime = Date.now();
        let conversionRecord = null;
        let logRecord = null;

        try {
            // Extract and validate payload according to your Node.js example schema
            const { html, css, javascript, url, options = {}, ai_options = {} } = req.body;
            
            console.log('=== PUBLIC API CONVERSION REQUEST ===');
            console.log('HTML provided:', !!html);
            console.log('CSS provided:', !!css);
            console.log('JavaScript provided:', !!javascript);
            console.log('URL provided:', !!url);
            // Set default values for specific options
            const saveToVault = options.save_to_vault || false;
            const layoutRepair = ai_options.layout_repair || false;
            
            console.log('Options provided:', Object.keys(options).length > 0 ? options : 'none');
            console.log('AI Options provided:', Object.keys(ai_options).length > 0 ? ai_options : 'none');
            console.log('Save to vault:', saveToVault);
            console.log('Layout repair:', layoutRepair);
            console.log('API Key User ID:', req.apiKey.userId);
            console.log('API Key Company ID:', req.apiKey.companyId);
            console.log('=== END PUBLIC API REQUEST DEBUG ===');
            
            // Validation: exactly one of 'html' OR 'url' must be provided
            const hasHtml = !!html;
            const hasUrl = !!url;
            
            if (!hasHtml && !hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Either "html" or "url" field is required'
                });
            }
            
            if (hasHtml && hasUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Provide either "html" OR "url", not both'
                });
            }

            // Get user and company info from API key
            const companyId = req.apiKey.companyId;
            const userId = req.apiKey.userId;
            
            if (!companyId || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid API key: missing user or company information'
                });
            }

            // Check if user has permission for PDF conversion
            if (!req.apiKey.permissions.includes('pdf_conversion') && 
                !req.apiKey.permissions.includes('html_to_pdf')) {
                return res.status(403).json({
                    success: false,
                    message: 'API key does not have permission for PDF conversion'
                });
            }

            // Generate unique filename for this conversion
            const timestamp = Date.now();
            const fileName = `api-conversion-${timestamp}.pdf`;
            const filePath = path.join(this.pdfStoragePath, fileName);

            // Create conversion record for tracking
            conversionRecord = new ConversionsSchema({
                companyId: companyId,
                userId: userId,
                fileName: fileName,
                filePath: filePath,
                fileSize: 0, // Will be updated after conversion
                dataType: hasUrl ? 'url' : 'html',
                sourceType: hasUrl ? 'upload' : 'raw',
                status: 'processing',
                createdAt: new Date(),
                metadata: {
                    apiKeyId: req.apiKey._id,
                    source: 'public_api_v1',
                    hasCSS: !!css,
                    hasJavaScript: !!javascript,
                    originalUrl: url || null,
                    saveToVault: saveToVault,
                    layoutRepair: layoutRepair,
                    options: options,
                    aiOptions: ai_options
                }
            });
            await conversionRecord.save();

            // Generate unique request ID
            const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Calculate input size
            const inputSizeBytes = html ? Buffer.byteLength(html, 'utf8') : (url ? 0 : 0);
            
            // Create log record
            logRecord = new LogsSchema({
                companyId: companyId,
                userId: userId,
                conversionId: conversionRecord._id,
                requestId: requestId,
                timestamp: new Date(),
                status: 'processing',
                fileSize: 0,
                fileName: fileName,
                dataType: hasUrl ? 'url' : 'html',
                processingTime: 0,
                generationTimeMs: 0, // Will be updated after completion
                inputSizeBytes: inputSizeBytes,
                apiEndpoint: '/api/v1/convert/pdf',
                metadata: {
                    apiKeyId: req.apiKey._id,
                    source: 'public_api_v1',
                    saveToVault: saveToVault,
                    layoutRepair: layoutRepair
                }
            });
            await logRecord.save();

            // Prepare HTML content
            let htmlContent;
            if (hasUrl) {
                // For URLs, we'll let the generatePDF method handle navigation directly
                htmlContent = url; // Pass the URL directly
                } else {
                // Use provided HTML content
                htmlContent = html;
                
                // Inject custom CSS if provided
                if (css) {
                    htmlContent = `<style>${css}</style>${htmlContent}`;
                }
                
                // Inject custom JavaScript if provided
                if (javascript) {
                    htmlContent = `${htmlContent}<script>${javascript}</script>`;
                }
            }

            // Check for layout repair using Gemini if ai_options.layout_repair is true
            if (layoutRepair === true) {
                console.log('=== AI REPAIR DEBUG (PUBLIC API) ===');
                console.log('Original HTML before AI repair:', htmlContent.substring(0, 200) + '...');
                console.log('Running Gemini layout repair analysis...');
                htmlContent = await this.checkHTMLWithGemini(htmlContent);
                console.log('HTML after AI repair:', htmlContent.substring(0, 200) + '...');
                console.log('=== END AI REPAIR DEBUG ===');
            }

            // Generate PDF with high-performance cluster
            const pdfOptions = {
                format: options.format || 'A4',
                printBackground: true,
                margin: options.margin || {
                    top: '10px',
                    right: '10px',
                    bottom: '10px',
                    left: '10px'
                },
                scale: options.scale || 0.9,
                displayHeaderFooter: options.displayHeaderFooter || false,
                landscape: options.landscape || false,
                width: options.width,
                height: options.height,
                pageRanges: options.pageRanges || '',
                headerTemplate: options.headerTemplate || '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="title"></span></div>',
                footerTemplate: options.footerTemplate || '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
            };

            // Use Playwright for PDF generation (handles concurrency internally)
            pdfOptions.isUrl = hasUrl; // Pass URL flag for caching decision
            const pdfBuffer = await this.generatePDF(htmlContent, pdfOptions);

            // Save PDF to file system
            await fsPromises.writeFile(filePath, pdfBuffer);

            // Handle save to vault (Cloudflare R2) if requested
            let storageInfo = null;
            console.log('=== STORAGE DECISION DEBUG (PUBLIC API) ===');
            console.log('Save to vault requested:', saveToVault);
            console.log('R2 Enabled:', this.r2Enabled);

            if (saveToVault) {
                if (this.r2Enabled) {
                    // Save to Cloudflare R2
                    console.log('Saving PDF to Cloudflare R2...');
                    const r2Result = await this.uploadToR2(pdfBuffer, fileName);
                    storageInfo = {
                        storageType: 'r2',
                        r2Url: r2Result.url,
                        r2Key: r2Result.key,
                        r2Bucket: r2Result.bucket
                    };
                    console.log('PDF saved to R2:', r2Result.url);
                    console.log('Storage Info set to:', storageInfo);
                } else {
                    // R2 is not enabled but saveToVault is true - fail the conversion
                    throw new Error('Cloudflare R2 storage is not configured. Cannot save to vault.');
                }
            } else {
                // saveToVault is false - don't save anywhere, just return the PDF
                console.log('Save to Vault is false - PDF not saved to storage');
                storageInfo = {
                    storageType: 'none',
                    message: 'PDF not saved to storage'
                };
            }
            console.log('=== END STORAGE DECISION DEBUG ===');

            // Update conversion record with success
            const fileStats = await fsPromises.stat(filePath);
            const fileSize = fileStats.size;
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            conversionRecord.status = 'completed';
            conversionRecord.fileSize = fileSize;
            conversionRecord.completedAt = new Date();
            conversionRecord.processingTime = processingTime;
            conversionRecord.storageInfo = storageInfo;
            await conversionRecord.save();

            // Get PDF page count for credits calculation
            let pageCount = 1; // Default to 1 page if we can't determine
            try {
                const pdfMetadata = await this.pdfPostProcessingService.getPDFMetadata(pdfBuffer);
                pageCount = pdfMetadata.pageCount || 1;
                console.log(`PDF has ${pageCount} pages`);
            } catch (error) {
                console.warn('Could not determine PDF page count, defaulting to 1:', error);
            }

            // Update log record
            logRecord.status = 'success';
            logRecord.outputSizeBytes = fileSize;
            logRecord.generationTimeMs = processingTime;
            logRecord.creditUsed = pageCount; // Update with actual page count
            logRecord.storageRef = saveToVault && conversionRecord ? conversionRecord._id.toString() : null;
            await logRecord.save();

            console.log(`✅ Public API PDF conversion completed: ${fileName} (${fileSize} bytes, ${processingTime}ms)`);

            // Return binary PDF data directly (as per your Node.js example)
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            
            // Stream the PDF file back to client
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);

        } catch (error) {
            console.error('Public API conversion error:', error);

            // Update records with error status
            if (conversionRecord) {
                try {
                    conversionRecord.status = 'failed';
                    conversionRecord.error = error.message;
                    await conversionRecord.save();
                } catch (saveError) {
                    console.error('Error updating conversion record:', saveError);
                }
            }

            if (logRecord) {
                try {
                    logRecord.status = 'failed';
                    logRecord.error = error.message;
                    logRecord.processingTime = Date.now() - startTime;
                    await logRecord.save();
                } catch (saveError) {
                    console.error('Error updating log record:', saveError);
                }
            }

            res.status(500).json({
                success: false,
                message: 'PDF conversion failed',
                error: error.message
            });
        }
    }

    // Original function - renamed to be more descriptive
    async fetchAllConvertedPDFs(req, res, next) {
        console.log('FETCHING ALL CONVERTED PDFs')
        const filter = req.query;
        const query = { $and: [] }; // Initialize $and operator as an array
        filter.limit = undefined;

        // Get companyId and userId from request (same pattern as LogsRoute)
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch PDFs'
            });
        }

        // Filter by companyId if available, otherwise use userId
        if (companyId) {
            query.$and.push({ companyId: companyId });
        } else if (userId) {
            query.$and.push({ userId: userId });
        }

        try {
            const pdfs = await ConversionsSchema.find(query)
            .sort({ completedAt: -1 }) // Sort by completedAt descending (newest first)
            .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
            .limit(parseInt(filter.limit))
        
            if(pdfs?.length) {
                // Transform the data to include download URLs for frontend
                const transformedPdfs = pdfs.map(pdf => {
                    const pdfData = pdf.toObject();
                    
                    // Add download URL based on storage type
                    if (pdfData.storageInfo && pdfData.storageInfo.storageType === 'r2') {
                        // Generate a fresh signed URL for R2 files
                        try {
                            pdfData.downloadUrl = conversionsController.generateSignedUrl(pdfData.storageInfo.r2Key);
                        } catch (error) {
                            console.error('Error generating signed URL for PDF:', pdfData._id, error);
                            pdfData.downloadUrl = null;
                        }
                    } else if (pdfData.storageInfo && pdfData.storageInfo.storageType === 'local') {
                        // For local files, provide the download endpoint
                        pdfData.downloadUrl = `/api/conversions/download/${pdfData._id}`;
                    } else if (pdfData.storageInfo && pdfData.storageInfo.storageType === 'none') {
                        // For files not saved to storage, no download URL
                        pdfData.downloadUrl = null;
                    }
                    
                    // Format file size for display
                    if (pdfData.fileSize) {
                        pdfData.fileSizeFormatted = conversionsController.formatFileSize(pdfData.fileSize);
                    }
                    
                    // Add title and description for frontend compatibility
                    pdfData.title = pdfData.fileName || 'Untitled PDF';
                    pdfData.description = `Generated from ${pdfData.sourceType || 'unknown source'}`;
                    pdfData.type = pdfData.dataType || 'PDF';
                    
                    // Map _id to id for frontend compatibility
                    pdfData.id = pdfData._id;
                    
                    return pdfData;
                });

                return res.status(200).json({
                    success: true,
                    status: true,
                    data: transformedPdfs,
                    total: transformedPdfs.length,
                    page: parseInt(filter.page) || 1,
                    limit: parseInt(filter.limit) || 10
                });
            } 

            return res.status(200).json({
                success: true,
                status: true,
                data: [],
                total: 0,
                page: parseInt(filter.page) || 1,
                limit: parseInt(filter.limit) || 10
            });
            
        } catch(error) {
            console.error('Error fetching PDFs:', error);
            return res.status(500).json({
                success: false,
                error: 'Something went wrong'
            });
        }
    }

    // Delete PDF by ID
    async deletePDF(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user?.companyId || req.companyId;
            const userId = req.userId || req.user?.id;
            
            if (!companyId && !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID or User ID is required to delete PDF'
                });
            }
            
            // Build query to find conversion record with proper authorization
            const query = { _id: id };
            if (companyId) {
                query.companyId = companyId;
            } else if (userId) {
                query.userId = userId;
            }
            
            // Find the conversion record
            const conversion = await ConversionsSchema.findOne(query);
            if (!conversion) {
                return res.status(404).json({
                    success: false,
                    message: 'PDF not found or you do not have permission to delete it'
                });
            }

            // Delete from storage if it exists
            if (conversion.storageInfo && conversion.storageInfo.storageType === 'r2') {
                try {
                    // Delete from R2
                    await this.s3.deleteObject({
                        Bucket: this.r2BucketName,
                        Key: conversion.storageInfo.r2Key
                    }).promise();
                    console.log('PDF deleted from R2:', conversion.storageInfo.r2Key);
                } catch (error) {
                    console.error('Error deleting from R2:', error);
                    // Continue with database deletion even if R2 deletion fails
                }
            } else if (conversion.storageInfo && conversion.storageInfo.storageType === 'local') {
                try {
                    // Delete local file
                    const fs = await import('fs');
                    const path = await import('path');
                    const filePath = path.join(this.pdfStoragePath, conversion.storageInfo.filePath);
                    await fs.promises.unlink(filePath);
                    console.log('PDF deleted from local storage:', filePath);
                } catch (error) {
                    console.error('Error deleting local file:', error);
                    // Continue with database deletion even if file deletion fails
                }
            }

            // Delete from database
            await ConversionsSchema.findByIdAndDelete(id);
            
            res.status(200).json({
                success: true,
                message: 'PDF deleted successfully'
            });

        } catch (error) {
            console.error('PDF Delete Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete PDF',
                error: error.message
            });
        }
    }

    async updateUserCredits(userId, creditsUsed) {
        try {
            if (!userId) {
                console.warn('No userId provided for credit update');
                return;
            }

            // Update user credits in database
            const user = await UserSchema.findById(userId);
            if (user) {
                user.creditsUsed = (user.creditsUsed || 0) + creditsUsed;
                await user.save();
                console.log(`Updated credits for user ${userId}: +${creditsUsed} credits`);
            } else {
                console.warn(`User not found for credit update: ${userId}`);
            }
        } catch (error) {
            console.error('Error updating user credits:', error);
        }
    }

    // Helper method to format file size in MB
    formatFileSize(bytes) {
        if (bytes === 0) return '0 MB';
        
        const mb = bytes / (1024 * 1024);
        return parseFloat(mb.toFixed(2)) + ' MB';
    }

    // Helper method to get file size in MB
    getFileSizeInMB(bytes) {
        if (!bytes) return 0;
        return parseFloat((bytes / (1024 * 1024)).toFixed(2));
    }

    // Download PDF by ID
    async downloadPDF(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user?.companyId || req.companyId;
            const userId = req.userId || req.user?.id;
            
            if (!companyId && !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID or User ID is required to download PDF'
                });
            }
            
            // Build query to find conversion record with proper authorization
            const query = { _id: id };
            if (companyId) {
                query.companyId = companyId;
            } else if (userId) {
                query.userId = userId;
            }
            
            const conversion = await ConversionsSchema.findOne(query);
            if (!conversion) {
                return res.status(404).json({
                    success: false,
                    message: 'PDF not found or you do not have permission to download it'
                });
            }

            if (conversion.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    message: 'PDF conversion not completed'
                });
            }

            // Check storage type and download accordingly
            if (conversion.storageInfo && conversion.storageInfo.storageType === 'r2') {
                // Download from R2
                console.log('Downloading PDF from R2...');
                try {
                    const pdfBuffer = await this.downloadFromR2(conversion.storageInfo.r2Key);
                    
                    // Set response headers for PDF download
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${conversion.fileName}.pdf"`);
                    res.setHeader('Content-Length', pdfBuffer.length);
                    
                    // Send the PDF buffer
                    res.send(pdfBuffer);
                } catch (error) {
                    console.error('Error downloading from R2:', error);
                    return res.status(404).json({
                        success: false,
                        message: 'PDF file not found in cloud storage'
                    });
                }
            } else {
                // Download from local file system
                const pdfFilePath = path.join(this.pdfStoragePath, conversion.filePath);
                
                // Check if file exists
                try {
                    await fsPromises.access(pdfFilePath);
                } catch (error) {
                    return res.status(404).json({
                        success: false,
                        message: 'PDF file not found on server'
                    });
                }

                // Set response headers for PDF download
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${conversion.fileName}.pdf"`);
                
                // Stream the file
                const fileStream = fs.createReadStream(pdfFilePath);
                fileStream.pipe(res);
            }

        } catch (error) {
            console.error('PDF Download Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to download PDF',
                error: error.message
            });
        }
    }

    // Get job status for async processing
    async getJobStatus(req, res, next) {
        try {
            if (!this.queueService) {
                return res.status(503).json({
                    success: false,
                    message: 'Queue service not available'
                });
            }

            const { jobId } = req.params;
            const jobStatus = await this.queueService.getJobStatus(jobId);

            if (jobStatus.status === 'not_found') {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }

            res.json({
                success: true,
                job: jobStatus
            });

        } catch (error) {
            console.error('Failed to get job status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get job status',
                error: error.message
            });
        }
    }

    // Get queue statistics
    async getQueueStats(req, res, next) {
        try {
            if (!this.queueService) {
                return res.status(503).json({
                    success: false,
                    message: 'Queue service not available'
                });
            }

            const stats = await this.queueService.getQueueStats();
            
            res.json({
                success: true,
                queue: stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Failed to get queue stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get queue statistics',
                error: error.message
            });
        }
    }

    async cleanup() {
        try {
            if (this.cluster) {
                await this.cluster.idle();
                await this.cluster.close();
                this.cluster = null;
                console.log('Cluster closed successfully');
            }
            
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                console.log('Browser closed successfully');
            }

            if (this.queueService) {
                await this.queueService.close();
                this.queueService = null;
                console.log('Queue service closed successfully');
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

const conversionsController = new ConversionsController();

// Export the functions needed
export const {
    fetchAllConvertedPDFs,
    convertHTMLToPDFAPI,
    convertHTMLToPDFAPIPublic,
    downloadPDF,
    deletePDF,
    updateUserCredits,
    formatFileSize,
    getFileSizeInMB
} = conversionsController;

export default conversionsController;
