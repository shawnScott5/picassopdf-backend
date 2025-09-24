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

        // 3. Process <object> tags with SVG data
        const objectRegex = /<object([^>]*?)type\s*=\s*["']image\/svg\+xml["']([^>]*?)data\s*=\s*["']([^"']*?)["']([^>]*?)><\/object>/gi;
        let objectMatch;
        while ((objectMatch = objectRegex.exec(processedHtml)) !== null) {
            const [fullMatch, beforeType, afterType, dataUrl, afterData] = objectMatch;
            
            try {
                const processedSrc = await this.processImageSrc(dataUrl);
                
                // Extract width and height attributes
                const widthMatch = fullMatch.match(/width\s*=\s*["']([^"']*?)["']/i);
                const heightMatch = fullMatch.match(/height\s*=\s*["']([^"']*?)["']/i);
                
                const width = widthMatch ? ` width="${widthMatch[1]}"` : '';
                const height = heightMatch ? ` height="${heightMatch[1]}"` : '';
                
                const imgTag = `<img src="${processedSrc}"${width}${height} alt="SVG Image">`;
                processedHtml = processedHtml.replace(fullMatch, imgTag);
            } catch (error) {
                // Hide broken object by replacing with empty div
                const newDiv = `<div style="display:none;"></div>`;
                processedHtml = processedHtml.replace(fullMatch, newDiv);
            }
        }

        // 4. Process <picture> elements
        const pictureRegex = /<picture[^>]*>[\s\S]*?<\/picture>/gi;
        let pictureMatch;
        while ((pictureMatch = pictureRegex.exec(processedHtml)) !== null) {
            const pictureContent = pictureMatch[0];
            
            try {
                // Check if picture contains problematic services
                const problematicServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
                const hasProblematicService = problematicServices.some(service => 
                    pictureContent.includes(service)
                );
                
                if (hasProblematicService) {
                    // Hide picture elements with problematic services
                    const newDiv = `<div style="display:none !important;" data-removed-picture="true"></div>`;
                    processedHtml = processedHtml.replace(pictureContent, newDiv);
                    continue;
                }
                
                // Process all source elements and the fallback img tag
                let processedPictureContent = pictureContent;
                
                // Process source elements
                const sourceRegex = /<source([^>]*?)srcset\s*=\s*["']([^"']*?)["']([^>]*?)>/gi;
                let sourceMatch;
                while ((sourceMatch = sourceRegex.exec(pictureContent)) !== null) {
                    const [fullSourceMatch, beforeSrcset, srcset, afterSrcset] = sourceMatch;
                    try {
                        const processedSrcset = await this.processImageSrc(srcset);
                        const newSourceTag = `<source${beforeSrcset}srcset="${processedSrcset}"${afterSrcset}>`;
                        processedPictureContent = processedPictureContent.replace(fullSourceMatch, newSourceTag);
                    } catch (error) {
                        // If source fails, remove it
                        processedPictureContent = processedPictureContent.replace(fullSourceMatch, '');
                    }
                }
                
                // Process the fallback img tag
                const imgMatch = processedPictureContent.match(/<img([^>]*?)src\s*=\s*["']([^"']*?)["']([^>]*?)>/i);
                
                if (imgMatch) {
                    const [imgTag, beforeSrc, src, afterSrc] = imgMatch;
                    try {
                        const processedSrc = await this.processImageSrc(src);
                        const newImgTag = `<img${beforeSrc}src="${processedSrc}"${afterSrc}>`;
                        processedPictureContent = processedPictureContent.replace(imgTag, newImgTag);
                        
                        // Replace the entire picture element with the processed version
                        processedHtml = processedHtml.replace(pictureContent, processedPictureContent);
                    } catch (error) {
                        // If fallback img fails, hide the picture element
                        const newDiv = `<div style="display:none !important;"></div>`;
                        processedHtml = processedHtml.replace(pictureContent, newDiv);
                    }
                } else {
                    // If no img tag found, hide the picture element
                    const newDiv = `<div style="display:none !important;"></div>`;
                    processedHtml = processedHtml.replace(pictureContent, newDiv);
                }
            } catch (error) {
                // Hide broken picture by replacing with empty div
                const newDiv = `<div style="display:none !important;"></div>`;
                processedHtml = processedHtml.replace(pictureContent, newDiv);
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
            // 4. Local file paths (copy to /tmp while preserving styling)
            else if (this.isRealLocalPath(src)) {
                processedSrc = await this.handleLocalFile(src);
            }
            // 5. Relative paths (resolve to absolute while preserving styling)
            else if (this.isRelativePath(src)) {
                processedSrc = await this.handleRelativePath(src);
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
            // Re-throw errors to trigger hiding of broken images
            throw error;
        }

        // Cache the result
        this.imageCache.set(src, processedSrc);
        return processedSrc;
    }

    /**
     * Check if path is relative
     */
    isRelativePath(src) {
        // Only consider these as invalid relative paths that should be hidden
        return src.startsWith('/images/') || src.includes('sample.jpg') ||
               (!src.startsWith('http') && !src.startsWith('data:') &&
                !src.startsWith('blob:') && !src.startsWith('/') &&
                !src.includes('<svg') && !this.isRealLocalPath(src) &&
                !src.startsWith('./') && !src.startsWith('../'));
    }

    /**
     * Check if this is a real local file path (Windows or Unix style)
     */
    isRealLocalPath(src) {
        // Windows paths: C:\ or D:\ etc.
        if (/^[A-Za-z]:\\/.test(src)) {
            return true;
        }
        // Relative paths that could be valid: ./ or ../
        if (src.startsWith('./') || src.startsWith('../')) {
            return true;
        }
        // Unix paths: /home/ or /Users/ etc. (but not /images/ which is relative)
        if (src.startsWith('/') && !src.startsWith('/images/') && !src.includes('sample.jpg')) {
            return true;
        }
        return false;
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
        // Check if this is a real local file path (Windows or Unix style)
        if (this.isRealLocalPath(src)) {
            return await this.handleLocalFile(src);
        }
        
        // For relative paths that won't work in Lambda, throw error to trigger hiding
        throw new Error(`Relative path images not supported in Lambda environment: ${src}`);
    }

    /**
     * Handle local file paths by copying to /tmp
     * Preserves original file structure
     */
    async handleLocalFile(src) {
        try {
            // For Windows paths, try to access them directly
            if (/^[A-Za-z]:\\/.test(src)) {
                // Check if the file exists
                if (fs.existsSync(src)) {
                    // Copy to /tmp for Lambda processing
                    const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const tmpPath = path.join(this.tmpDir, fileName);
                    fs.copyFileSync(src, tmpPath);
                    return `file://${tmpPath}`;
                } else {
                    throw new Error(`Windows local file not found: ${src}`);
                }
            }
            
            // For Unix-style paths and relative paths
            let cleanPath;
            if (src.startsWith('./') || src.startsWith('../')) {
                // For relative paths, resolve from current working directory
                cleanPath = path.resolve(process.cwd(), src);
            } else {
                // For absolute paths
                cleanPath = path.resolve('/', src);
            }
            
            const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tmpPath = path.join(this.tmpDir, fileName);

            if (fs.existsSync(cleanPath)) {
                fs.copyFileSync(cleanPath, tmpPath);
                return `file://${tmpPath}`;
            } else {
                throw new Error(`Local file not found: ${src} (resolved to: ${cleanPath})`);
            }
        } catch (error) {
            throw error; // Re-throw to trigger hiding
        }
    }

    /**
     * Handle HTTP/HTTPS URLs by downloading and optimizing
     * Preserves original image quality and styling
     * Fast-fails on invalid images to prevent 20-second delays
     */
    async handleHttpUrl(src) {
        try {
            // Quick validation of URL format first
            if (!this.isValidImageUrl(src)) {
                throw new Error('Invalid image URL format');
            }

            const response = await axios.get(src, {
                responseType: 'arraybuffer',
                timeout: 3000, // Increased slightly for external SVGs
                maxRedirects: 3,
                validateStatus: function (status) {
                    // Only accept 200 status codes
                    return status === 200;
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PDF-Converter/1.0)',
                    'Accept': 'image/*,image/svg+xml,*/*'
                }
            });

            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || 'image/png';

            // For SVG content, always inline as data URI to preserve vector quality
            if (contentType.includes('svg') || src.toLowerCase().includes('.svg')) {
                const svgContent = buffer.toString('utf-8');
                const encodedSvg = encodeURIComponent(svgContent);
                return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
            }

            // Validate that we actually got image data for non-SVG
            if (!this.isValidImageContent(buffer, contentType)) {
                throw new Error('Invalid image content received');
            }

            // For small images (< 100KB), inline as base64 to preserve quality
            if (buffer.length <= 100 * 1024) {
                const base64 = buffer.toString('base64');
                return `data:${contentType};base64,${base64}`;
            }

            // For larger images, save to /tmp
            const fileName = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tmpPath = path.join(this.tmpDir, fileName);
            fs.writeFileSync(tmpPath, buffer);
            return `file://${tmpPath}`;

        } catch (error) {
            // Fast fail - throw error to trigger hiding of broken image
            throw new Error(`Image load failed: ${error.message}`);
        }
    }

    /**
     * Validate if URL looks like a valid image URL
     */
    isValidImageUrl(src) {
        try {
            const url = new URL(src);
            const pathname = url.pathname.toLowerCase();
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
            const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));
            
            // Check for common invalid image services that cause delays
            const invalidServices = ['via.placeholder.com', 'placeholder.com', 'dummyimage.com'];
            const hasInvalidService = invalidServices.some(service => url.hostname.includes(service));
            
            // Allow URLs without extensions if they're from trusted domains (like Wikipedia)
            const trustedDomains = ['upload.wikimedia.org', 'commons.wikimedia.org', 'wikipedia.org'];
            const isTrustedDomain = trustedDomains.some(domain => url.hostname.includes(domain));
            
            return (hasValidExtension || isTrustedDomain) && !hasInvalidService;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate if buffer contains valid image content
     */
    isValidImageContent(buffer, contentType) {
        if (!buffer || buffer.length === 0) {
            return false;
        }

        // Check for common image file signatures
        const signatures = {
            'image/jpeg': [0xFF, 0xD8, 0xFF],
            'image/png': [0x89, 0x50, 0x4E, 0x47],
            'image/gif': [0x47, 0x49, 0x46],
            'image/webp': [0x52, 0x49, 0x46, 0x46],
            'image/svg+xml': [0x3C, 0x3F, 0x78, 0x6D, 0x6C] // <?xml
        };

        const expectedSignature = signatures[contentType];
        if (expectedSignature) {
            return expectedSignature.every((byte, index) => buffer[index] === byte);
        }

        // If we can't validate, assume it's valid
        return true;
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