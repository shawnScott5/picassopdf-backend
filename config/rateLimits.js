/**
 * Rate Limiting Configuration
 * Environment-specific rate limits for PicassoPDF API
 */

const rateLimits = {
    development: {
        pdfConversion: {
            max: 1000, // Very high for development
            windowMs: 60 * 1000, // 1 minute
            message: 'Development rate limit exceeded'
        },
        generalApi: {
            max: 1000,
            windowMs: 60 * 1000,
            message: 'Development API rate limit exceeded'
        },
        ipLimit: {
            max: 2000,
            windowMs: 60 * 1000,
            message: 'Development IP rate limit exceeded'
        }
    },
    
    production: {
        pdfConversion: {
            max: 240, // 4 RPS (240 RPM)
            windowMs: 60 * 1000, // 1 minute
            message: 'PDF conversion rate limit exceeded'
        },
        generalApi: {
            max: 240, // 4 RPS (240 RPM)
            windowMs: 60 * 1000, // 1 minute
            message: 'API rate limit exceeded'
        },
        ipLimit: {
            max: 500, // 500 RPM per IP
            windowMs: 60 * 1000, // 1 minute
            message: 'IP rate limit exceeded'
        },
        healthCheck: {
            max: 1000, // 1000 RPM for health checks
            windowMs: 60 * 1000, // 1 minute
            message: 'Health check rate limit exceeded'
        }
    },
    
    staging: {
        pdfConversion: {
            max: 120, // Half of production for staging
            windowMs: 60 * 1000,
            message: 'Staging PDF conversion rate limit exceeded'
        },
        generalApi: {
            max: 120,
            windowMs: 60 * 1000,
            message: 'Staging API rate limit exceeded'
        },
        ipLimit: {
            max: 250,
            windowMs: 60 * 1000,
            message: 'Staging IP rate limit exceeded'
        }
    }
};

/**
 * Get rate limits for current environment
 */
export const getRateLimits = () => {
    const env = process.env.NODE_ENV || 'development';
    return rateLimits[env] || rateLimits.development;
};

/**
 * Rate limit tiers for different user types
 */
export const rateLimitTiers = {
    free: {
        max: 10, // 10 requests per minute
        windowMs: 60 * 1000,
        message: 'Free tier rate limit exceeded. Upgrade to increase limits.',
        upgradeUrl: 'https://picassopdf.com/pricing'
    },
    basic: {
        max: 100, // 100 requests per minute
        windowMs: 60 * 1000,
        message: 'Basic tier rate limit exceeded'
    },
    premium: {
        max: 240, // 240 requests per minute (4 RPS)
        windowMs: 60 * 1000,
        message: 'Premium tier rate limit exceeded'
    },
    enterprise: {
        max: 1000, // 1000 requests per minute
        windowMs: 60 * 1000,
        message: 'Enterprise rate limit exceeded'
    }
};

/**
 * Burst rate limiting configuration
 */
export const burstLimits = {
    windowMs: 10 * 1000, // 10 seconds
    max: 10, // 10 requests in 10 seconds
    message: 'Burst rate limit exceeded. Please slow down.'
};

/**
 * Redis configuration for distributed rate limiting
 */
export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
};

export default {
    getRateLimits,
    rateLimitTiers,
    burstLimits,
    redisConfig
};
