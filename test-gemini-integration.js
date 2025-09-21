/**
 * Test script for Gemini Flash API integration with JavaScript rendering
 * This script demonstrates the new pipeline: HTML + JS → Playwright → Gemini → PDF
 */

import dotenv from 'dotenv';
import { chromium } from 'playwright';
import axios from 'axios';

// Load environment variables
dotenv.config();

/**
 * Test the complete pipeline: HTML + JS → Playwright → Gemini
 */
async function testCompletePipeline() {
    console.log('🧪 Testing complete pipeline: HTML + JS → Playwright → Gemini...');
    
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.error('❌ GOOGLE_GEMINI_API_KEY not found in environment variables');
        console.log('Please create a .env file in the backend directory with:');
        console.log('GOOGLE_GEMINI_API_KEY=your_api_key_here');
        return;
    }

    // Test HTML with JavaScript that modifies the DOM
    const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Page with JS</title>
        <style>
            .container { width: 100%; padding: 20px; }
            .dynamic-content { display: none; }
            .error { color: red; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Test Content</h1>
            <div class="dynamic-content" id="dynamic">
                <p>This content is added by JavaScript</p>
            </div>
            <div id="status">Loading...</div>
        </div>
        
        <script>
            // Simulate some JavaScript that modifies the DOM
            setTimeout(() => {
                document.getElementById('dynamic').style.display = 'block';
                document.getElementById('status').textContent = 'Content loaded successfully';
                
                // Add some dynamic styling that might cause layout issues
                const container = document.querySelector('.container');
                container.style.position = 'relative';
                container.style.height = '100vh';
                container.style.overflow = 'hidden';
            }, 1000);
        </script>
    </body>
    </html>
    `;

    try {
        // Step 1: Render HTML with JavaScript using Playwright
        console.log('📱 Step 1: Rendering HTML with JavaScript using Playwright...');
        
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });

        const page = await context.newPage();
        
        await page.setContent(testHTML, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        // Wait for JavaScript to execute
        await page.waitForTimeout(2000);

        // Extract the final rendered HTML and computed styles
        const renderedData = await page.evaluate(() => {
            const finalHTML = document.documentElement.outerHTML;
            
            const computedStyles = {};
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach((element, index) => {
                const styles = window.getComputedStyle(element);
                const elementId = element.id || element.className || `element-${index}`;
                
                computedStyles[elementId] = {
                    display: styles.display,
                    position: styles.position,
                    width: styles.width,
                    height: styles.height,
                    overflow: styles.overflow
                };
            });

            return {
                html: finalHTML,
                computedStyles: computedStyles,
                bodyText: document.body ? document.body.innerText : '',
                hasErrors: document.querySelectorAll('[style*="error"], .error, #error').length > 0
            };
        });

        await context.close();
        await browser.close();
        console.log('✅ HTML rendered successfully with JavaScript using Playwright');

        // Step 2: Analyze the rendered HTML with Gemini
        console.log('🤖 Step 2: Analyzing rendered HTML with Gemini...');
        
        const prompt = `Please analyze this HTML code that has been rendered with JavaScript for potential broken layouts, missing CSS, or structural issues that could cause rendering problems in PDF generation. 

The HTML below represents the final state after JavaScript execution. Focus on:
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

Please respond with only the corrected HTML code if changes are needed, or respond with "NO_CHANGES_NEEDED" if the HTML is fine as is.`;

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
                timeout: 30000
            }
        );

        const geminiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!geminiResponse) {
            console.error('❌ No response from Gemini API');
            return;
        }

        if (geminiResponse.trim() === 'NO_CHANGES_NEEDED') {
            console.log('✅ Gemini analysis: No changes needed for rendered HTML');
        } else {
            console.log('✅ Gemini analysis: Rendered HTML has been corrected');
            console.log('\n📝 Corrected HTML:');
            console.log('=' .repeat(50));
            console.log(geminiResponse.trim());
            console.log('=' .repeat(50));
        }

        console.log('\n🎉 Complete pipeline test completed successfully!');
        console.log('📊 Pipeline: HTML + JS → Playwright → Gemini → PDF-ready HTML');

    } catch (error) {
        console.error('❌ Pipeline error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testCompletePipeline();
