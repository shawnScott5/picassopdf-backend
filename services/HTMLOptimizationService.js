/**
 * HTML Optimization Service for PDF Generation
 * Optimizes HTML content before Lambda processing to improve performance
 * while preserving visual appearance and functionality
 */
class HTMLOptimizationService {
    constructor() {
        console.log('✅ HTMLOptimizationService initialized');
    }

    /**
     * Optimize HTML content for faster PDF generation
     * @param {string} html - The HTML content to optimize
     * @param {Object} options - Optimization options
     * @param {boolean} options.enabled - Whether optimization is enabled (default: true)
     * @param {boolean} options.removeJavaScript - Remove unnecessary JavaScript (default: true)
     * @param {boolean} options.optimizeDOM - Optimize DOM structure (default: true)
     * @param {boolean} options.preserveImages - Keep external images (default: true)
     * @param {boolean} options.preserveCSS - Keep CSS animations and transitions (default: true)
     * @returns {string} Optimized HTML content
     */
    optimizeHTML(html, options = {}) {
        const {
            enabled = true,
            removeJavaScript = true,
            optimizeDOM = true,
            preserveImages = true,
            preserveCSS = true
        } = options;

        if (!enabled) {
            console.log('🔧 HTML optimization disabled, returning original HTML');
            return html;
        }

        console.log('🚀 Starting HTML optimization...');
        const startTime = Date.now();

        let optimizedHTML = html;

        try {
            // Remove unnecessary JavaScript while preserving essential functionality
            if (removeJavaScript) {
                optimizedHTML = this.removeUnnecessaryJavaScript(optimizedHTML);
            }

            // Optimize DOM structure by removing unnecessary attributes
            if (optimizeDOM) {
                optimizedHTML = this.optimizeDOMStructure(optimizedHTML);
            }

            const endTime = Date.now();
            const originalSize = html.length;
            const optimizedSize = optimizedHTML.length;
            const reductionPercent = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

            console.log(`✅ HTML optimization completed in ${endTime - startTime}ms`);
            console.log(`📊 Size reduction: ${originalSize} → ${optimizedSize} bytes (${reductionPercent}% smaller)`);

            return optimizedHTML;

        } catch (error) {
            console.error('❌ HTML optimization failed:', error);
            console.log('🔄 Returning original HTML due to optimization error');
            return html;
        }
    }

    /**
     * Remove unnecessary JavaScript while preserving essential functionality
     * @param {string} html - HTML content
     * @returns {string} HTML with optimized JavaScript
     */
    removeUnnecessaryJavaScript(html) {
        console.log('🧹 Removing unnecessary JavaScript...');

        // Remove console.log statements
        html = html.replace(/console\.log\s*\([^)]*\)\s*;?/g, '');
        html = html.replace(/console\.warn\s*\([^)]*\)\s*;?/g, '');
        html = html.replace(/console\.error\s*\([^)]*\)\s*;?/g, '');
        html = html.replace(/console\.debug\s*\([^)]*\)\s*;?/g, '');
        html = html.replace(/console\.info\s*\([^)]*\)\s*;?/g, '');

        // Remove debug statements
        html = html.replace(/debugger\s*;?/g, '');
        html = html.replace(/alert\s*\([^)]*\)\s*;?/g, '');

        // Remove event handlers that are not essential for PDF rendering
        // Keep form validation and essential interactions
        html = html.replace(/\s*onclick\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmouseover\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmouseout\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmouseenter\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmouseleave\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmousemove\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmousedown\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onmouseup\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*oncontextmenu\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*ondblclick\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onfocus\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onblur\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onkeydown\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onkeyup\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onkeypress\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onresize\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*onscroll\s*=\s*["'][^"']*["']/gi, '');

        // Remove analytics and tracking scripts
        html = html.replace(/<script[^>]*>[\s\S]*?(?:google-analytics|gtag|ga\(|fbq|_gaq|mixpanel|amplitude)[\s\S]*?<\/script>/gi, '');
        html = html.replace(/<script[^>]*>[\s\S]*?(?:tracking|analytics|metrics)[\s\S]*?<\/script>/gi, '');

        // Remove social media widgets and embeds
        html = html.replace(/<script[^>]*>[\s\S]*?(?:facebook|twitter|linkedin|instagram|youtube|vimeo)[\s\S]*?<\/script>/gi, '');
        html = html.replace(/<iframe[^>]*>[\s\S]*?(?:facebook|twitter|linkedin|instagram|youtube|vimeo)[\s\S]*?<\/iframe>/gi, '');

        // Remove performance monitoring scripts
        html = html.replace(/<script[^>]*>[\s\S]*?(?:newrelic|datadog|sentry|rollbar)[\s\S]*?<\/script>/gi, '');

        // Clean up empty script tags
        html = html.replace(/<script[^>]*>\s*<\/script>/gi, '');
        html = html.replace(/<script[^>]*>\s*\/\/.*?\n\s*<\/script>/gi, '');

        console.log('✅ JavaScript optimization completed');
        return html;
    }

    /**
     * Optimize DOM structure by removing unnecessary attributes
     * @param {string} html - HTML content
     * @returns {string} HTML with optimized DOM structure
     */
    optimizeDOMStructure(html) {
        console.log('🏗️ Optimizing DOM structure...');

        // Remove unnecessary attributes that don't affect PDF rendering
        html = html.replace(/\s*data-[a-zA-Z0-9\-_]*\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*aria-[a-zA-Z0-9\-_]*\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*role\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*tabindex\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*accesskey\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*contenteditable\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*draggable\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*dropzone\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*spellcheck\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s*translate\s*=\s*["'][^"']*["']/gi, '');

        // Remove unnecessary meta tags for PDF generation
        html = html.replace(/<meta[^>]*name\s*=\s*["']viewport["'][^>]*>/gi, '');
        html = html.replace(/<meta[^>]*name\s*=\s*["']theme-color["'][^>]*>/gi, '');
        html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app[^>]*>/gi, '');
        html = html.replace(/<meta[^>]*name\s*=\s*["']msapplication[^>]*>/gi, '');
        html = html.replace(/<meta[^>]*property\s*=\s*["']og:[^>]*>/gi, '');
        html = html.replace(/<meta[^>]*property\s*=\s*["']twitter:[^>]*>/gi, '');

        // Remove unnecessary link tags
        html = html.replace(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']alternate["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']preconnect["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']dns-prefetch["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']prefetch["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']preload["'][^>]*>/gi, '');

        // Remove favicon links
        html = html.replace(/<link[^>]*rel\s*=\s*["']icon["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']shortcut icon["'][^>]*>/gi, '');
        html = html.replace(/<link[^>]*rel\s*=\s*["']apple-touch-icon["'][^>]*>/gi, '');

        // Remove manifest links
        html = html.replace(/<link[^>]*rel\s*=\s*["']manifest["'][^>]*>/gi, '');

        // Remove service worker registrations
        html = html.replace(/<script[^>]*>[\s\S]*?navigator\.serviceWorker[\s\S]*?<\/script>/gi, '');

        // Remove PWA related meta tags
        html = html.replace(/<meta[^>]*name\s*=\s*["']mobile-web-app-capable["'][^>]*>/gi, '');
        html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app-capable["'][^>]*>/gi, '');
        html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app-status-bar-style["'][^>]*>/gi, '');

        // Clean up multiple whitespace
        html = html.replace(/\s+/g, ' ');
        html = html.replace(/>\s+</g, '><');

        console.log('✅ DOM structure optimization completed');
        return html;
    }

    /**
     * Get optimization statistics
     * @param {string} originalHTML - Original HTML content
     * @param {string} optimizedHTML - Optimized HTML content
     * @returns {Object} Optimization statistics
     */
    getOptimizationStats(originalHTML, optimizedHTML) {
        const originalSize = originalHTML.length;
        const optimizedSize = optimizedHTML.length;
        const reduction = originalSize - optimizedSize;
        const reductionPercent = (reduction / originalSize * 100).toFixed(2);

        return {
            originalSize,
            optimizedSize,
            reduction,
            reductionPercent: `${reductionPercent}%`,
            compressionRatio: (optimizedSize / originalSize).toFixed(3)
        };
    }
}

export default HTMLOptimizationService;
