const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Comprehensive image handler for all image source types
 * Handles: HTTP/HTTPS, data URIs, relative paths, local files, SVG, blob URLs
 * Preserves all original styling and attributes - what user sees is what they get
 * Only hides broken images, everything else is preserved exactly
 */
class ImageHandler {
    constructor() {
        this.tmpDir = '/tmp';
        this.baseUrl = null;
        this.imageCache = new Map();
    }

    /**
     * Set base URL for resolving relative paths
     */
    setBaseUrl(url) {
        this.baseUrl = url;
    }

    /**
     * Process all images in HTML and convert to accessible formats
     * Preserves ALL original styling and attributes exactly
     */
    async processImages(html) {
        let processedHtml = html;

        // 1. Process <img> tags with src attributes - preserve ALL original attributes and styling
        const imgRegex = /<img([^>]*?)src\s*=\s*["']([^"']*?)["']([^>]*?)>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
            const [fullMatch, beforeSrc, src, afterSrc] = match;
            
            try {
                const processedSrc = await this.processImageSrc(src);
                
                if (processedSrc !== src) {
                    // Preserve ALL original attributes and styling exactly as provided
                    const newImgTag = `<img${beforeSrc}src="${processedSrc}"${afterSrc}>`;
                    processedHtml = processedHtml.replace(fullMatch, newImgTag);
                }
            } catch (error) {
                // Hide broken images by replacing with empty div that maintains layout
                const newImgTag = `<div style="display:none;"></div>`;
                processedHtml = processedHtml.replace(fullMatch, newImgTag);
            }
        }

        // 2. Process inline SVG elements and convert to <img> tags
        const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
        let svgMatch;
        while ((svgMatch = svgRegex.exec(processedHtml)) !== null) {
            const svgContent = svgMatch[0];
            
            try {
                const dataUri = await this.handleInlineSvg(svgContent);
                
                // Extract ALL existing attributes from the SVG element to preserve styling
                const svgAttributes = this.extractSvgAttributes(svgContent);
                
                // Create img tag preserving original attributes and styling exactly
                const imgTag = `<img src="${dataUri}"${svgAttributes}>`;
                processedHtml = processedHtml.replace(svgContent, imgTag);
            } catch (error) {
                // Hide broken SVG by replacing with empty div
                const newDiv = `<div style="display:none;"></div>`;
                processedHtml = processedHtml.replace(svgContent, newDiv);
            }
        }

        return processedHtml;
    }

    /**
     * Process individual image source
     * What user passes in is what they get - no modifications to styling or layout
     */
    async processImageSrc(src) {
        if (!src || src.trim() === '') {
            return src;
        }

        // Check cache first
        if (this.imageCache.has(src)) {
            return this.imageCache.get(src);
        }

        let processedSrc = src;

        try {
            // 1. Data URIs (already optimized - preserve exactly)
            if (src.startsWith('data:')) {
                processedSrc = src;
            }
            // 2. Blob URLs (let browser handle - preserve exactly)
            else if (src.startsWith('blob:')) {
                processedSrc = src; // Let browser handle blob URLs
            }
            // 3. SVG inline (convert to data URI while preserving styling)
            else if (src.includes('<svg') || src.includes('<?xml')) {
                processedSrc = await this.handleInlineSvg(src);
            }
            // 4. Relative paths (resolve to absolute while preserving styling)
            else if (this.isRelativePath(src)) {
                processedSrc = await this.handleRelativePath(src);
            }
            // 5. Local file paths (copy to /tmp while preserving styling)
            else if (src.startsWith('/') || src.startsWith('./') || src.startsWith('../')) {
                processedSrc = await this.handleLocalFile(src);
            }
            // 6. HTTP/HTTPS URLs (download and optimize while preserving styling)
            else if (src.startsWith('http://') || src.startsWith('https://')) {
                processedSrc = await this.handleHttpUrl(src);
            }
            // 7. Base64 without data: prefix (add prefix while preserving content)
            else if (this.isBase64(src)) {
                processedSrc = `data:image/png;base64,${src}`;
            }
            // 8. Unknown format - preserve exactly as provided
            else {
                processedSrc = src; // Don't modify unknown formats
            }
        } catch (error) {
            // If processing fails, return original src to preserve user's intent
            processedSrc = src;
        }

        // Cache the result
        this.imageCache.set(src, processedSrc);
        return processedSrc;
    }

    /**
     * Check if path is relative
     */
    isRelativePath(src) {
        return src.startsWith('./') || src.startsWith('../') ||
               (!src.startsWith('http') && !src.startsWith('data:') &&
                !src.startsWith('blob:') && !src.startsWith('/') &&
                !src.includes('<svg'));
    }

    /**
     * Check if string is base64
     */
    isBase64(str) {
        if (str.length < 100) return false;
        try {
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            return base64Regex.test(str) && str.length % 4 === 0;
        } catch (err) {
            return false;
        }
    }

    /**
     * Extract ALL attributes from SVG element to preserve everything exactly
     * Maintains user's original styling and layout
     */
    extractSvgAttributes(svgContent) {
        const svgTagMatch = svgContent.match(/<svg([^>]*)>/i);
        if (!svgTagMatch) return '';

        const attributes = svgTagMatch[1].trim();
        if (!attributes) return '';

        // Return ALL attributes exactly as they were - preserve user's styling
        return ' ' + attributes;
    }

    /**
     * Handle inline SVG by converting to data URI
     * Preserves all original SVG styling and attributes
     */
    async handleInlineSvg(svgContent) {
        const cleanedSvg = svgContent.trim();
        const encodedSvg = encodeURIComponent(cleanedSvg);
        return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
    }

    /**
     * Handle relative paths by resolving to absolute URLs
     * Preserves original path structure and styling
     */
    async handleRelativePath(src) {
        if (!this.baseUrl) {
            return await this.handleLocalFile(src);
        }

        try {
            let resolvedUrl;
            if (src.startsWith('/')) {
                const base = new URL(this.baseUrl);
                resolvedUrl = `${base.protocol}//${base.host}${src}`;
            } else {
                resolvedUrl = new URL(src, this.baseUrl).href;
            }
            return await this.handleHttpUrl(resolvedUrl);
        } catch (error) {
            return await this.handleLocalFile(src);
        }
    }

    /**
     * Handle local file paths by copying to /tmp
     * Preserves original file structure
     */
    async handleLocalFile(src) {
        try {
            const cleanPath = path.resolve('/', src.replace(/^\.\//, ''));
            const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tmpPath = path.join(this.tmpDir, fileName);

            if (fs.existsSync(cleanPath)) {
                fs.copyFileSync(cleanPath, tmpPath);
                return `file://${tmpPath}`;
            } else {
                return src; // Return original if file doesn't exist
            }
        } catch (error) {
            return src; // Return original on error
        }
    }

    /**
     * Handle HTTP/HTTPS URLs by downloading and optimizing
     * Preserves original image quality and styling
     */
    async handleHttpUrl(src) {
        try {
            const response = await axios.get(src, {
                responseType: 'arraybuffer',
                timeout: 5000,
                maxRedirects: 3
            });

            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || 'image/png';

            // For small images (< 50KB), inline as base64 to preserve quality
            if (buffer.length <= 50 * 1024) {
                const base64 = buffer.toString('base64');
                return `data:${contentType};base64,${base64}`;
            }

            // For larger images, save to /tmp
            const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tmpPath = path.join(this.tmpDir, fileName);
            fs.writeFileSync(tmpPath, buffer);
            return `file://${tmpPath}`;

        } catch (error) {
            // Return original src if download fails - don't break user's layout
            return src;
        }
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        try {
            const files = fs.readdirSync(this.tmpDir);
            files.forEach(file => {
                if (file.startsWith('img_')) {
                    fs.unlinkSync(path.join(this.tmpDir, file));
                }
            });
        } catch (error) {
            // Silent cleanup
        }
    }
}

module.exports = { ImageHandler };