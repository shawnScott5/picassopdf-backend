/**
 * Standardized API Error Response Handler
 * Consistent error format across all PicassoPDF endpoints
 * Matches industry standards (Stripe, AWS, Twilio style)
 */

class APIError {
    /**
     * Send standardized error response
     */
    static respond(res, statusCode, errorCode, message, details = {}) {
        const errorResponse = {
            success: false,
            error: {
                code: errorCode,
                message: message,
                timestamp: new Date().toISOString(),
                ...(Object.keys(details).length > 0 && { details })
            }
        };

        // Add helpful documentation links for common errors
        const docLinks = {
            'INVALID_HTML': 'input-validation',
            'INVALID_URL': 'url-requirements',
            'HTML_TOO_LARGE': 'size-limits',
            'CSS_TOO_LARGE': 'size-limits',
            'JAVASCRIPT_TOO_LARGE': 'size-limits',
            'TOTAL_CONTENT_TOO_LARGE': 'size-limits',
            'SECURITY_VIOLATION': 'security-guidelines',
            'INVALID_OPTIONS': 'pdf-options',
            'QUOTA_EXCEEDED': 'pricing',
            'RATE_LIMIT_EXCEEDED': 'rate-limits',
            'CONTENT_TOO_COMPLEX': 'optimization-tips',
            'BLOCKED_URL': 'url-requirements'
        };

        if (docLinks[errorCode]) {
            errorResponse.documentation = `https://docs.picassopdf.com/errors/${docLinks[errorCode]}`;
        }

        // Add retry-after header for rate limiting errors
        if (statusCode === 429 && details.retryAfter) {
            res.set('Retry-After', details.retryAfter);
        }

        // Add request ID if available
        if (details.requestId) {
            res.set('X-Request-ID', details.requestId);
        }

        return res.status(statusCode).json(errorResponse);
    }

    /**
     * Quick helper methods for common error types
     */
    static badRequest(res, message, details = {}) {
        return APIError.respond(res, 400, 'BAD_REQUEST', message, details);
    }

    static unauthorized(res, message = 'Authentication required', details = {}) {
        return APIError.respond(res, 401, 'UNAUTHORIZED', message, details);
    }

    static forbidden(res, message = 'Access forbidden', details = {}) {
        return APIError.respond(res, 403, 'FORBIDDEN', message, details);
    }

    static notFound(res, message = 'Resource not found', details = {}) {
        return APIError.respond(res, 404, 'NOT_FOUND', message, details);
    }

    static tooLarge(res, message, details = {}) {
        return APIError.respond(res, 413, 'PAYLOAD_TOO_LARGE', message, details);
    }

    static rateLimited(res, message = 'Rate limit exceeded', details = {}) {
        return APIError.respond(res, 429, 'RATE_LIMIT_EXCEEDED', message, details);
    }

    static serverError(res, message = 'Internal server error', details = {}) {
        // Don't expose internal error details in production
        const safeDetails = process.env.NODE_ENV === 'production' 
            ? {} 
            : details;
        return APIError.respond(res, 500, 'INTERNAL_ERROR', message, safeDetails);
    }

    static serviceUnavailable(res, message = 'Service temporarily unavailable', details = {}) {
        return APIError.respond(res, 503, 'SERVICE_UNAVAILABLE', message, details);
    }
}

/**
 * Error code constants for consistency
 */
const ERROR_CODES = {
    // Input validation errors (400)
    INVALID_HTML: 'INVALID_HTML',
    INVALID_URL: 'INVALID_URL',
    INVALID_URL_PROTOCOL: 'INVALID_URL_PROTOCOL',
    INVALID_URL_FORMAT: 'INVALID_URL_FORMAT',
    BLOCKED_URL: 'BLOCKED_URL',
    URL_TOO_LONG: 'URL_TOO_LONG',
    MISSING_INPUT: 'MISSING_INPUT',
    CONFLICTING_INPUT: 'CONFLICTING_INPUT',
    INVALID_OPTIONS: 'INVALID_OPTIONS',
    SECURITY_VIOLATION: 'SECURITY_VIOLATION',
    
    // Size limit errors (413)
    HTML_TOO_LARGE: 'HTML_TOO_LARGE',
    CSS_TOO_LARGE: 'CSS_TOO_LARGE',
    JAVASCRIPT_TOO_LARGE: 'JAVASCRIPT_TOO_LARGE',
    TOTAL_CONTENT_TOO_LARGE: 'TOTAL_CONTENT_TOO_LARGE',
    CONTENT_TOO_COMPLEX: 'CONTENT_TOO_COMPLEX',
    
    // Authentication errors (401)
    INVALID_API_KEY: 'INVALID_API_KEY',
    API_KEY_EXPIRED: 'API_KEY_EXPIRED',
    API_KEY_INACTIVE: 'API_KEY_INACTIVE',
    
    // Authorization errors (403)
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
    
    // Rate limiting errors (429)
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    TOO_MANY_CONCURRENT_REQUESTS: 'TOO_MANY_CONCURRENT_REQUESTS',
    
    // Timeout errors (408, 504)
    TIMEOUT: 'TIMEOUT',
    URL_TIMEOUT: 'URL_TIMEOUT',
    
    // Server errors (500, 507)
    CONVERSION_FAILED: 'CONVERSION_FAILED',
    OUT_OF_MEMORY: 'OUT_OF_MEMORY',
    BROWSER_CRASH: 'BROWSER_CRASH',
    
    // Service errors (503)
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    LAMBDA_UNAVAILABLE: 'LAMBDA_UNAVAILABLE',
    
    // Network errors
    CONNECTION_REFUSED: 'CONNECTION_REFUSED',
    SSL_ERROR: 'SSL_ERROR',
    DNS_ERROR: 'DNS_ERROR'
};

module.exports = {
    APIError,
    ERROR_CODES
};

