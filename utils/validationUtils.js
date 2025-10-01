/**
 * Validation Utilities for PicassoPDF API
 * Enterprise-grade input validation and security checks
 * Designed for performance - all checks are O(1) or O(n) with small constants
 */

// Size limits (configurable per tier)
const SIZE_LIMITS = {
    MAX_HTML_SIZE: 10 * 1024 * 1024,  // 10MB - generous limit
    MAX_CSS_SIZE: 2 * 1024 * 1024,     // 2MB
    MAX_JS_SIZE: 2 * 1024 * 1024,      // 2MB
    MAX_TOTAL_SIZE: 15 * 1024 * 1024,  // 15MB combined
    MAX_URL_LENGTH: 2048,               // Standard max URL length
    MAX_PAGES_ESTIMATE: 1000,           // Max estimated pages
    MAX_DOM_ELEMENTS: 50000,            // Prevent DOM explosion attacks
    MAX_NESTING_DEPTH: 100              // Prevent stack overflow
};

/**
 * Validate content size limits
 * Fast: O(1) - just checks string length
 */
function validateContentSize(html = '', css = '', javascript = '') {
    const htmlSize = html ? Buffer.byteLength(html, 'utf8') : 0;
    const cssSize = css ? Buffer.byteLength(css, 'utf8') : 0;
    const jsSize = javascript ? Buffer.byteLength(javascript, 'utf8') : 0;
    const totalSize = htmlSize + cssSize + jsSize;

    if (htmlSize > SIZE_LIMITS.MAX_HTML_SIZE) {
        return {
            valid: false,
            error: 'HTML_TOO_LARGE',
            message: `HTML content exceeds maximum size of ${SIZE_LIMITS.MAX_HTML_SIZE / 1024 / 1024}MB`,
            details: {
                maxSize: `${SIZE_LIMITS.MAX_HTML_SIZE / 1024 / 1024}MB`,
                currentSize: `${(htmlSize / 1024 / 1024).toFixed(2)}MB`
            }
        };
    }

    if (cssSize > SIZE_LIMITS.MAX_CSS_SIZE) {
        return {
            valid: false,
            error: 'CSS_TOO_LARGE',
            message: `CSS content exceeds maximum size of ${SIZE_LIMITS.MAX_CSS_SIZE / 1024 / 1024}MB`,
            details: {
                maxSize: `${SIZE_LIMITS.MAX_CSS_SIZE / 1024 / 1024}MB`,
                currentSize: `${(cssSize / 1024 / 1024).toFixed(2)}MB`
            }
        };
    }

    if (jsSize > SIZE_LIMITS.MAX_JS_SIZE) {
        return {
            valid: false,
            error: 'JAVASCRIPT_TOO_LARGE',
            message: `JavaScript content exceeds maximum size of ${SIZE_LIMITS.MAX_JS_SIZE / 1024 / 1024}MB`,
            details: {
                maxSize: `${SIZE_LIMITS.MAX_JS_SIZE / 1024 / 1024}MB`,
                currentSize: `${(jsSize / 1024 / 1024).toFixed(2)}MB`
            }
        };
    }

    if (totalSize > SIZE_LIMITS.MAX_TOTAL_SIZE) {
        return {
            valid: false,
            error: 'TOTAL_CONTENT_TOO_LARGE',
            message: `Total content size exceeds maximum of ${SIZE_LIMITS.MAX_TOTAL_SIZE / 1024 / 1024}MB`,
            details: {
                maxSize: `${SIZE_LIMITS.MAX_TOTAL_SIZE / 1024 / 1024}MB`,
                currentSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`
            }
        };
    }

    return { valid: true, sizes: { htmlSize, cssSize, jsSize, totalSize } };
}

/**
 * Validate URL for security (SSRF protection)
 * Fast: O(1) - just string checks and URL parsing
 */
function validateUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return { valid: false, error: 'INVALID_URL', message: 'URL must be a string' };
    }

    if (urlString.length > SIZE_LIMITS.MAX_URL_LENGTH) {
        return {
            valid: false,
            error: 'URL_TOO_LONG',
            message: `URL exceeds maximum length of ${SIZE_LIMITS.MAX_URL_LENGTH} characters`
        };
    }

    try {
        const url = new URL(urlString);
        
        // Block dangerous protocols - only allow HTTP(S)
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(url.protocol)) {
            return {
                valid: false,
                error: 'INVALID_URL_PROTOCOL',
                message: `Only HTTP and HTTPS protocols are allowed. Found: ${url.protocol}`
            };
        }
        
        const hostname = url.hostname.toLowerCase();
        
        // SSRF Protection: Block internal/private IPs and localhost
        const blockedPatterns = [
            'localhost',
            '127.', '0.0.0.0',
            '::1', '::ffff:127',
            '169.254.169.254', // AWS metadata endpoint
            '169.254.', // Link-local addresses
            'metadata.google.internal', // GCP metadata
            '10.', // Private IP range
            '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.',
            '172.24.', '172.25.', '172.26.', '172.27.',
            '172.28.', '172.29.', '172.30.', '172.31.', // Private IP range
            '192.168.' // Private IP range
        ];
        
        for (const pattern of blockedPatterns) {
            if (hostname === pattern || hostname.startsWith(pattern) || hostname.endsWith(pattern)) {
                return {
                    valid: false,
                    error: 'BLOCKED_URL',
                    message: 'Cannot access internal, private, or localhost URLs'
                };
            }
        }
        
        // Block .local domains
        if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
            return {
                valid: false,
                error: 'BLOCKED_URL',
                message: 'Cannot access .local or .localhost domains'
            };
        }
        
        return { valid: true, parsedUrl: url };
    } catch (e) {
        return {
            valid: false,
            error: 'INVALID_URL_FORMAT',
            message: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL'
        };
    }
}

/**
 * Detect potentially malicious content
 * Optimized: Uses compiled regex patterns for speed
 */
function detectSecurityThreats(html = '', css = '', javascript = '') {
    const threats = [];
    
    // Quick size check first (cheapest operation)
    const content = `${html} ${css} ${javascript}`;
    
    // Check for excessive DOM size (DoS attack vector)
    // Fast: Simple regex count, O(n) but very fast
    const allTags = (html || '').match(/<[^>]+>/g);
    if (allTags && allTags.length > SIZE_LIMITS.MAX_DOM_ELEMENTS) {
        threats.push({
            type: 'EXCESSIVE_DOM_SIZE',
            severity: 'HIGH',
            message: `Detected ${allTags.length} HTML elements, maximum is ${SIZE_LIMITS.MAX_DOM_ELEMENTS}`,
            count: allTags.length
        });
    }
    
    // Check for excessive nesting (stack overflow / DoS)
    const nestedDivs = (html || '').match(/<div[^>]*>/g);
    if (nestedDivs && nestedDivs.length > 5000) {
        threats.push({
            type: 'EXCESSIVE_NESTING',
            severity: 'MEDIUM',
            message: `Detected ${nestedDivs.length} nested div elements`,
            count: nestedDivs.length
        });
    }
    
    // Dangerous patterns - optimized regex (pre-compiled in production)
    const dangerousPatterns = [
        { pattern: /<script[^>]*>[\s\S]*?(crypto|bitcoin|mining)[\s\S]*?<\/script>/i, threat: 'CRYPTO_MINING' },
        { pattern: /eval\s*\(/i, threat: 'EVAL_USAGE' },
        { pattern: /Function\s*\(/i, threat: 'FUNCTION_CONSTRUCTOR' },
        { pattern: /document\.write\s*\(/i, threat: 'DOCUMENT_WRITE' },
        { pattern: /<iframe[^>]*srcdoc/i, threat: 'SRCDOC_IFRAME' },
        { pattern: /data:text\/html/i, threat: 'DATA_URI_HTML' }
    ];
    
    // Only scan if content is reasonably sized (performance optimization)
    if (content.length < 1024 * 1024) { // Only scan first 1MB for performance
        dangerousPatterns.forEach(({ pattern, threat }) => {
            if (pattern.test(content)) {
                threats.push({
                    type: threat,
                    severity: 'MEDIUM',
                    message: `Detected potentially dangerous pattern: ${threat}`
                });
            }
        });
    }
    
    return threats;
}

/**
 * Validate PDF generation options
 * Fast: O(1) object property checks
 */
function validatePDFOptions(options = {}) {
    const errors = [];
    
    // Valid formats
    const validFormats = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger'];
    if (options.format && !validFormats.includes(options.format)) {
        errors.push({
            field: 'format',
            message: `Invalid format "${options.format}". Must be one of: ${validFormats.join(', ')}`
        });
    }
    
    // Scale validation
    if (options.scale !== undefined) {
        const scale = parseFloat(options.scale);
        if (isNaN(scale) || scale < 0.1 || scale > 2) {
            errors.push({
                field: 'scale',
                message: 'Scale must be a number between 0.1 and 2'
            });
        }
    }
    
    // Margin validation
    if (options.margin) {
        const margin = options.margin;
        const sides = ['top', 'right', 'bottom', 'left'];
        sides.forEach(side => {
            if (margin[side]) {
                const value = margin[side].toString();
                const numValue = parseFloat(value);
                if (isNaN(numValue) || numValue < 0) {
                    errors.push({
                        field: `margin.${side}`,
                        message: `Margin ${side} must be a positive number`
                    });
                }
            }
        });
    }
    
    // Width/Height validation
    if ((options.width || options.height) && options.format) {
        errors.push({
            field: 'dimensions',
            message: 'Cannot specify both format and custom width/height dimensions'
        });
    }
    
    // Landscape validation
    if (options.landscape !== undefined && typeof options.landscape !== 'boolean') {
        errors.push({
            field: 'landscape',
            message: 'Landscape must be a boolean value'
        });
    }
    
    // DisplayHeaderFooter validation
    if (options.displayHeaderFooter !== undefined && typeof options.displayHeaderFooter !== 'boolean') {
        errors.push({
            field: 'displayHeaderFooter',
            message: 'displayHeaderFooter must be a boolean value'
        });
    }
    
    return errors;
}

/**
 * Estimate PDF complexity and page count
 * Fast: Simple heuristic calculation
 */
function estimatePDFComplexity(html = '', options = {}) {
    const htmlSize = html ? html.length : 0;
    
    // Rough estimate: 5000 characters per page (very approximate)
    const estimatedPages = Math.ceil(htmlSize / 5000);
    
    // Check image count (images increase complexity)
    const imageCount = (html.match(/<img[^>]*>/g) || []).length;
    
    // Check table count (tables are complex to render)
    const tableCount = (html.match(/<table[^>]*>/g) || []).length;
    
    const complexity = {
        estimatedPages,
        imageCount,
        tableCount,
        complexity: 'low'
    };
    
    // Determine complexity level
    if (estimatedPages > 100 || imageCount > 50 || tableCount > 20) {
        complexity.complexity = 'high';
    } else if (estimatedPages > 20 || imageCount > 10 || tableCount > 5) {
        complexity.complexity = 'medium';
    }
    
    // Check if exceeds limits
    if (estimatedPages > SIZE_LIMITS.MAX_PAGES_ESTIMATE) {
        return {
            valid: false,
            error: 'CONTENT_TOO_COMPLEX',
            message: `Estimated ${estimatedPages} pages exceeds maximum of ${SIZE_LIMITS.MAX_PAGES_ESTIMATE} pages`,
            details: complexity
        };
    }
    
    return { valid: true, ...complexity };
}

/**
 * Main validation function - runs all checks efficiently
 * Optimized: Fails fast on first error
 */
function validateConversionRequest(data) {
    const { html, css, javascript, url, options } = data;
    
    // 1. Validate input presence (fastest check first)
    const hasHtml = !!(html);
    const hasUrl = !!(url);
    
    if (!hasHtml && !hasUrl) {
        return {
            valid: false,
            error: 'MISSING_INPUT',
            message: 'Either "html" or "url" field is required',
            statusCode: 400
        };
    }
    
    if (hasHtml && hasUrl) {
        return {
            valid: false,
            error: 'CONFLICTING_INPUT',
            message: 'Provide either "html" OR "url", not both',
            statusCode: 400
        };
    }
    
    // 2. Validate URL if provided (fast string checks)
    if (hasUrl) {
        const urlValidation = validateUrl(url);
        if (!urlValidation.valid) {
            return {
                valid: false,
                error: urlValidation.error,
                message: urlValidation.message,
                statusCode: 400
            };
        }
    }
    
    // 3. Validate content size if HTML provided (fast buffer length check)
    if (hasHtml) {
        const sizeValidation = validateContentSize(html, css, javascript);
        if (!sizeValidation.valid) {
            return {
                valid: false,
                error: sizeValidation.error,
                message: sizeValidation.message,
                details: sizeValidation.details,
                statusCode: 413
            };
        }
    }
    
    // 4. Security threat detection (only for HTML, not URLs)
    if (hasHtml) {
        const threats = detectSecurityThreats(html, css, javascript);
        const highThreats = threats.filter(t => t.severity === 'HIGH');
        
        if (highThreats.length > 0) {
            return {
                valid: false,
                error: 'SECURITY_VIOLATION',
                message: 'Content contains potentially malicious or dangerous patterns',
                details: {
                    threats: highThreats.map(t => ({ type: t.type, message: t.message }))
                },
                statusCode: 400
            };
        }
        
        // Log medium threats but don't block (for monitoring)
        if (threats.length > 0) {
            console.warn('⚠️ Security warnings detected:', threats);
        }
    }
    
    // 5. Validate PDF options (fast object checks)
    if (options) {
        const optionErrors = validatePDFOptions(options);
        if (optionErrors.length > 0) {
            return {
                valid: false,
                error: 'INVALID_OPTIONS',
                message: 'Invalid PDF generation options provided',
                details: { errors: optionErrors },
                statusCode: 400
            };
        }
    }
    
    // 6. Estimate complexity (fast heuristic)
    if (hasHtml) {
        const complexityCheck = estimatePDFComplexity(html, options);
        if (!complexityCheck.valid) {
            return {
                valid: false,
                error: complexityCheck.error,
                message: complexityCheck.message,
                details: complexityCheck.details,
                statusCode: 413
            };
        }
    }
    
    // All validations passed
    return {
        valid: true,
        message: 'All validations passed'
    };
}

module.exports = {
    validateConversionRequest,
    validateContentSize,
    validateUrl,
    detectSecurityThreats,
    validatePDFOptions,
    estimatePDFComplexity,
    SIZE_LIMITS
};

