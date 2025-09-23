/**
 * HTML Optimization Service
 * Optimizes HTML content for faster PDF generation by:
 * - Removing external images
 * - Simplifying CSS
 * - Removing unnecessary JavaScript
 * - Optimizing DOM structure
 */
class HTMLOptimizationService {
    constructor() {
        this.optimizationEnabled = true;
    }

    /**
     * Optimize HTML content for PDF generation
     * @param {string} htmlContent - Original HTML content
     * @param {object} options - Optimization options
     * @returns {string} - Optimized HTML content
     */
    optimizeHTML(htmlContent, options = {}) {
        if (!this.optimizationEnabled || !htmlContent) {
            return htmlContent;
        }

        try {
            console.log('🔧 Starting HTML optimization...');
            const originalLength = htmlContent.length;
            
            let optimizedHTML = htmlContent;

            // Apply optimizations based on options
            if (options.removeExternalImages !== false) {
                optimizedHTML = this.removeExternalImages(optimizedHTML);
            }

            if (options.simplifyCSS !== false) {
                optimizedHTML = this.simplifyCSS(optimizedHTML);
            }

            if (options.removeJavaScript !== false) {
                optimizedHTML = this.removeUnnecessaryJavaScript(optimizedHTML);
            }

            if (options.optimizeDOM !== false) {
                optimizedHTML = this.optimizeDOM(optimizedHTML);
            }

            const optimizedLength = optimizedHTML.length;
            const reductionPercent = ((originalLength - optimizedLength) / originalLength * 100).toFixed(1);
            
            console.log(`✅ HTML optimization complete: ${originalLength} → ${optimizedLength} bytes (${reductionPercent}% reduction)`);
            
            return optimizedHTML;
        } catch (error) {
            console.warn('⚠️ HTML optimization failed, returning original HTML:', error.message);
            return htmlContent;
        }
    }

    /**
     * Remove external images and replace with placeholder
     */
    removeExternalImages(html) {
        try {
            // Replace external images with placeholder divs
            const imageRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
            const optimizedHTML = html.replace(imageRegex, (match, src) => {
                // Extract alt text if available
                const altMatch = match.match(/alt=["']([^"']*)["']/i);
                const altText = altMatch ? altMatch[1] : 'Image';
                
                // Replace with a styled placeholder div
                return `<div style="width: 100%; height: 150px; background-color: #f0f0f0; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #666; font-family: Arial, sans-serif; margin: 10px 0;">[Image: ${altText}]</div>`;
            });

            console.log('🖼️ External images replaced with placeholders');
            return optimizedHTML;
        } catch (error) {
            console.warn('⚠️ Failed to remove external images:', error.message);
            return html;
        }
    }

    /**
     * Simplify CSS by removing unnecessary properties and optimizing
     */
    simplifyCSS(html) {
        try {
            // Remove complex CSS properties that don't affect PDF layout
            const cssOptimizations = [
                // Remove hover effects
                /:hover\s*{[^}]*}/gi,
                // Remove transition animations
                /transition\s*:[^;]+;/gi,
                // Remove transform properties
                /transform\s*:[^;]+;/gi,
                // Remove box-shadow (can be slow to render)
                /box-shadow\s*:[^;]+;/gi,
                // Remove text-shadow
                /text-shadow\s*:[^;]+;/gi,
                // Remove complex gradients
                /background\s*:[^;]*gradient[^;]*;/gi,
                // Remove filter effects
                /filter\s*:[^;]+;/gi,
                // Remove animation properties
                /animation\s*:[^;]+;/gi,
                /@keyframes[^{]*{[^}]*}/gi
            ];

            let optimizedHTML = html;
            cssOptimizations.forEach(regex => {
                optimizedHTML = optimizedHTML.replace(regex, '');
            });

            // Clean up empty CSS rules
            optimizedHTML = optimizedHTML.replace(/{\s*}/g, '');
            optimizedHTML = optimizedHTML.replace(/,\s*}/g, '}');

            console.log('🎨 CSS simplified for PDF generation');
            return optimizedHTML;
        } catch (error) {
            console.warn('⚠️ Failed to simplify CSS:', error.message);
            return html;
        }
    }

    /**
     * Remove unnecessary JavaScript that doesn't affect PDF content
     */
    removeUnnecessaryJavaScript(html) {
        try {
            // Remove script tags that don't affect PDF content
            const scriptRegex = /<script[^>]*>[\s\S]*?<\/script>/gi;
            const optimizedHTML = html.replace(scriptRegex, (match) => {
                // Keep scripts that might be essential for content (like dynamic content generation)
                // Remove scripts that are clearly for interactivity
                if (match.includes('addEventListener') || 
                    match.includes('onclick') || 
                    match.includes('onload') ||
                    match.includes('DOMContentLoaded') ||
                    match.includes('console.log')) {
                    return ''; // Remove interactive scripts
                }
                return match; // Keep other scripts
            });

            // Remove inline event handlers
            const eventHandlerRegex = /\s(on\w+)\s*=\s*["'][^"']*["']/gi;
            const finalHTML = optimizedHTML.replace(eventHandlerRegex, '');

            console.log('⚡ Unnecessary JavaScript removed');
            return finalHTML;
        } catch (error) {
            console.warn('⚠️ Failed to remove JavaScript:', error.message);
            return html;
        }
    }

    /**
     * Optimize DOM structure for better PDF rendering
     */
    optimizeDOM(html) {
        try {
            let optimizedHTML = html;

            // Remove unnecessary attributes that don't affect PDF
            const unnecessaryAttributes = [
                'data-', // Remove data attributes
                'aria-', // Remove ARIA attributes (not needed for PDF)
                'role=', // Remove role attributes
                'tabindex=', // Remove tabindex
                'contenteditable=', // Remove contenteditable
                'draggable=', // Remove draggable
                'spellcheck=' // Remove spellcheck
            ];

            unnecessaryAttributes.forEach(attr => {
                const regex = new RegExp(`\\s${attr}[^\\s]*`, 'gi');
                optimizedHTML = optimizedHTML.replace(regex, '');
            });

            // Remove empty elements that don't contribute to PDF
            optimizedHTML = optimizedHTML.replace(/<div[^>]*>\s*<\/div>/gi, '');
            optimizedHTML = optimizedHTML.replace(/<span[^>]*>\s*<\/span>/gi, '');

            console.log('🏗️ DOM structure optimized');
            return optimizedHTML;
        } catch (error) {
            console.warn('⚠️ Failed to optimize DOM:', error.message);
            return html;
        }
    }

    /**
     * Enable or disable optimization
     */
    setOptimizationEnabled(enabled) {
        this.optimizationEnabled = enabled;
        console.log(`🔧 HTML optimization ${enabled ? 'enabled' : 'disabled'}`);
    }
}

export default HTMLOptimizationService;
