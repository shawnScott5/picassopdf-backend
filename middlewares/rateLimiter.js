import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import RateLimitMonitorService from '../services/RateLimitMonitor.js';
import { getSubscriptionTier, getRateLimitForTier } from '../utils/subscriptionTiers.js';

/**
 * Production Rate Limiting Configuration
 * Based on 4 RPS (240 RPM) with tiered limits
 */

// Redis client for distributed rate limiting (optional)
let redisClient = null;
if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
    });
    
    redisClient.on('error', (err) => {
        console.warn('⚠️ Redis connection error, falling back to memory store:', err.message);
        redisClient = null;
    });
}

/**
 * Create rate limiter with custom configuration
 * Uses API key as the primary identifier for rate limiting
 */
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 60 * 1000, // 1 minute
        max: 240, // 240 requests per minute (4 RPS) PER API KEY
        message: {
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many requests, please try again later',
            retryAfter: '1 minute',
            limit: 240,
            remaining: 0
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        keyGenerator: (req) => {
            // Use API key as primary identifier, fallback to IP
            const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
            if (apiKey) {
                return `api_key:${apiKey}`;
            }
            return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
        },
        handler: (req, res) => {
            const remaining = res.get('RateLimit-Remaining') || 0;
            const resetTime = res.get('RateLimit-Reset') || Math.floor(Date.now() / 1000) + 60;
            const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
            
            console.log(`🚫 Rate limit exceeded for API key: ${apiKey ? 'present' : 'missing'} - IP: ${req.ip} - ${req.method} ${req.path}`);
            
            res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: 'Too many requests, please try again later',
                retryAfter: '1 minute',
                limit: 240,
                remaining: parseInt(remaining),
                resetTime: new Date(resetTime * 1000).toISOString(),
                apiKey: apiKey ? 'present' : 'missing'
            });
        },
        onLimitReached: (req, res, options) => {
            const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
            console.log(`🚨 Rate limit reached for API key: ${apiKey ? 'present' : 'missing'} - IP: ${req.ip} - ${req.method} ${req.path}`);
            // Log to monitoring service
            RateLimitMonitorService.logRateLimitEvent(req, res, {
                rateLimitType: 'general',
                limit: 240,
                apiKey: apiKey ? 'present' : 'missing'
            });
        },
        skip: (req) => {
            // Skip rate limiting for health checks and status endpoints
            return req.path === '/v1/status' || req.path === '/health';
        }
    };

    // Use Redis store if available, otherwise use memory store
    if (redisClient) {
        defaultOptions.store = {
            incr: async (key, cb) => {
                try {
                    const current = await redisClient.incr(key);
                    if (current === 1) {
                        await redisClient.expire(key, Math.ceil(defaultOptions.windowMs / 1000));
                    }
                    cb(null, current, Date.now() + defaultOptions.windowMs);
                } catch (err) {
                    cb(err);
                }
            },
            decrement: async (key) => {
                try {
                    await redisClient.decr(key);
                } catch (err) {
                    console.warn('Redis decrement error:', err.message);
                }
            },
            resetKey: async (key) => {
                try {
                    await redisClient.del(key);
                } catch (err) {
                    console.warn('Redis reset error:', err.message);
                }
            }
        };
    }

    return rateLimit({ ...defaultOptions, ...options });
};

/**
 * General API rate limiter - 4 RPS (240 RPM)
 */
export const generalLimiter = createRateLimiter({
    max: 240, // 240 requests per minute
    message: {
        success: false,
        error: 'API rate limit exceeded',
        message: 'Too many API requests, please try again later',
        retryAfter: '1 minute',
        limit: 240
    }
});

/**
 * PDF conversion rate limiter - 4 RPS (240 RPM) PER API KEY
 * More restrictive for resource-intensive operations
 */
export const pdfConversionLimiter = createRateLimiter({
    max: 240, // 240 requests per minute PER API KEY
    message: {
        success: false,
        error: 'PDF conversion rate limit exceeded',
        message: 'Too many PDF conversion requests, please try again later',
        retryAfter: '1 minute',
        limit: 240
    },
    onLimitReached: (req, res, options) => {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
        console.log(`🚨 PDF conversion rate limit reached for API key: ${apiKey ? 'present' : 'missing'} - IP: ${req.ip}`);
        // Log to monitoring service
        RateLimitMonitorService.logRateLimitEvent(req, res, {
            rateLimitType: 'pdf_conversion',
            limit: 240,
            apiKey: apiKey ? 'present' : 'missing'
        });
    }
});

/**
 * Tiered rate limiting based on subscription tier
 */
export const createTieredLimiter = (tier = 'FREE') => {
    const rateLimit = getRateLimitForTier(tier);
    
    return createRateLimiter({
        max: rateLimit,
        windowMs: 60 * 1000,
        message: {
            success: false,
            error: `${tier} tier rate limit exceeded`,
            message: `Rate limit exceeded for ${tier} tier (${rateLimit} RPM)`,
            retryAfter: '1 minute',
            limit: rateLimit,
            tier: tier
        }
    });
};

/**
 * Burst rate limiter for handling traffic spikes
 * Allows short bursts above the normal rate
 */
export const burstLimiter = createRateLimiter({
    windowMs: 10 * 1000, // 10 seconds
    max: 10, // 10 requests in 10 seconds (allows burst of 1 RPS)
    message: {
        success: false,
        error: 'Burst rate limit exceeded',
        message: 'Too many requests in a short time, please slow down',
        retryAfter: '10 seconds',
        limit: 10
    }
});

/**
 * IP-based rate limiter for additional protection
 * This is a global IP limit to prevent abuse
 */
export const ipLimiter = createRateLimiter({
    max: 1000, // 1000 requests per minute per IP (global protection)
    windowMs: 60 * 1000,
    message: {
        success: false,
        error: 'IP rate limit exceeded',
        message: 'Too many requests from this IP address',
        retryAfter: '1 minute',
        limit: 1000
    },
    keyGenerator: (req) => {
        // Use IP address as key for global IP protection
        return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
    }
});

/**
 * Middleware to determine user tier and apply appropriate rate limiting
 * Uses subscription tier from user's subscription data
 */
export const tieredRateLimit = async (req, res, next) => {
    try {
        // Check for API key to determine tier
        const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
        
        if (!apiKey) {
            // No API key - apply free tier limits (very restrictive)
            return createTieredLimiter('FREE')(req, res, next);
        }
        
        // TODO: Implement API key validation and tier determination from database
        // For now, we'll need to look up the user's subscription tier
        // This would typically involve:
        // 1. Validate API key
        // 2. Get user's subscription data
        // 3. Determine tier from credits or subscription type
        // 4. Apply appropriate rate limit
        
        // Placeholder: For now, assume BUSINESS tier for authenticated users
        return createTieredLimiter('BUSINESS')(req, res, next);
        
    } catch (error) {
        console.error('Error in tiered rate limiting:', error);
        // Fallback to free tier on error
        return createTieredLimiter('FREE')(req, res, next);
    }
};

/**
 * Rate limit monitoring middleware
 */
export const rateLimitMonitor = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        if (res.statusCode === 429) {
            console.log(`📊 Rate limit hit: ${req.ip} - ${req.method} ${req.path}`);
            // Add monitoring/alerting here
        }
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Health check endpoint rate limiter (very permissive)
 */
export const healthCheckLimiter = createRateLimiter({
    max: 1000, // 1000 requests per minute for health checks
    windowMs: 60 * 1000,
    message: {
        success: false,
        error: 'Health check rate limit exceeded',
        message: 'Too many health check requests',
        retryAfter: '1 minute'
    }
});

export default {
    generalLimiter,
    pdfConversionLimiter,
    createTieredLimiter,
    burstLimiter,
    ipLimiter,
    tieredRateLimit,
    rateLimitMonitor,
    healthCheckLimiter
};
