/**
 * Rate Limit Monitoring Service
 * Tracks and logs rate limiting events for analytics and alerting
 */

import crypto from 'crypto';

class RateLimitMonitor {
    constructor() {
        this.events = [];
        this.stats = {
            totalRequests: 0,
            rateLimitedRequests: 0,
            rateLimitHits: 0,
            topBlockedIPs: new Map(),
            hourlyStats: new Map(),
            dailyStats: new Map(),
            apiKeyUsage: new Map()
        };
        
        // Clean up old events every hour
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);
    }

    /**
     * Log a rate limit event
     */
    logRateLimitEvent(req, res, options) {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
        const event = {
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            method: req.method,
            path: req.path,
            apiKey: apiKey ? 'present' : 'missing',
            apiKeyHash: apiKey ? this.hashApiKey(apiKey) : null, // Hash for privacy
            rateLimitType: options.rateLimitType || 'general',
            limit: options.limit || 240,
            remaining: res.get('RateLimit-Remaining') || 0,
            resetTime: res.get('RateLimit-Reset') || Math.floor(Date.now() / 1000) + 60
        };

        this.events.push(event);
        this.updateStats(event);
        
        // Log to console for immediate visibility
        console.log(`🚫 Rate limit hit: ${event.ip} - ${event.method} ${event.path} (${event.rateLimitType})`);
        
        // Keep only last 1000 events to prevent memory issues
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }
    }

    /**
     * Log a successful request
     */
    logSuccessfulRequest(req) {
        this.stats.totalRequests++;
        
        const hour = new Date().getHours();
        const day = new Date().toDateString();
        const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
        
        // Update hourly stats
        if (!this.stats.hourlyStats.has(hour)) {
            this.stats.hourlyStats.set(hour, 0);
        }
        this.stats.hourlyStats.set(hour, this.stats.hourlyStats.get(hour) + 1);
        
        // Update daily stats
        if (!this.stats.dailyStats.has(day)) {
            this.stats.dailyStats.set(day, 0);
        }
        this.stats.dailyStats.set(day, this.stats.dailyStats.get(day) + 1);
        
        // Track API key usage (hashed for privacy)
        if (apiKey) {
            const apiKeyHash = this.hashApiKey(apiKey);
            if (!this.stats.apiKeyUsage) {
                this.stats.apiKeyUsage = new Map();
            }
            if (!this.stats.apiKeyUsage.has(apiKeyHash)) {
                this.stats.apiKeyUsage.set(apiKeyHash, 0);
            }
            this.stats.apiKeyUsage.set(apiKeyHash, this.stats.apiKeyUsage.get(apiKeyHash) + 1);
        }
    }

    /**
     * Update statistics
     */
    updateStats(event) {
        this.stats.rateLimitedRequests++;
        this.stats.rateLimitHits++;
        
        // Track top blocked IPs
        const ip = event.ip;
        if (!this.stats.topBlockedIPs.has(ip)) {
            this.stats.topBlockedIPs.set(ip, 0);
        }
        this.stats.topBlockedIPs.set(ip, this.stats.topBlockedIPs.get(ip) + 1);
    }

    /**
     * Hash API key for privacy
     */
    hashApiKey(apiKey) {
        return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 8);
    }

    /**
     * Get current statistics
     */
    getStats() {
        const topBlockedIPs = Array.from(this.stats.topBlockedIPs.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ip, count]) => ({ ip, count }));

        const hourlyStats = Array.from(this.stats.hourlyStats.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([hour, count]) => ({ hour, count }));

        const dailyStats = Array.from(this.stats.dailyStats.entries())
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([day, count]) => ({ day, count }));

        const topApiKeys = Array.from(this.stats.apiKeyUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([hash, count]) => ({ apiKeyHash: hash, count }));

        return {
            totalRequests: this.stats.totalRequests,
            rateLimitedRequests: this.stats.rateLimitedRequests,
            rateLimitHits: this.stats.rateLimitHits,
            rateLimitPercentage: this.stats.totalRequests > 0 
                ? ((this.stats.rateLimitedRequests / this.stats.totalRequests) * 100).toFixed(2)
                : 0,
            topBlockedIPs,
            topApiKeys,
            hourlyStats,
            dailyStats,
            recentEvents: this.events.slice(-10) // Last 10 events
        };
    }

    /**
     * Get rate limit events for a specific time range
     */
    getEvents(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        return this.events.filter(event => {
            const eventTime = new Date(event.timestamp);
            return eventTime >= start && eventTime <= end;
        });
    }

    /**
     * Get events by IP address
     */
    getEventsByIP(ip) {
        return this.events.filter(event => event.ip === ip);
    }

    /**
     * Check if an IP should be temporarily blocked
     */
    shouldBlockIP(ip, timeWindow = 5 * 60 * 1000, maxHits = 10) {
        const now = new Date();
        const cutoff = new Date(now.getTime() - timeWindow);
        
        const recentHits = this.events.filter(event => 
            event.ip === ip && new Date(event.timestamp) > cutoff
        );
        
        return recentHits.length >= maxHits;
    }

    /**
     * Clean up old events and stats
     */
    cleanup() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        // Remove old events
        this.events = this.events.filter(event => 
            new Date(event.timestamp) > cutoff
        );
        
        // Clean up old daily stats
        const oldDays = Array.from(this.stats.dailyStats.keys()).filter(day => 
            new Date(day) < cutoff
        );
        oldDays.forEach(day => this.stats.dailyStats.delete(day));
        
        console.log(`🧹 Rate limit monitor cleanup: ${this.events.length} events remaining`);
    }

    /**
     * Export data for external monitoring systems
     */
    exportData() {
        return {
            timestamp: new Date().toISOString(),
            stats: this.getStats(),
            events: this.events
        };
    }

    /**
     * Reset all statistics (useful for testing)
     */
    reset() {
        this.events = [];
        this.stats = {
            totalRequests: 0,
            rateLimitedRequests: 0,
            rateLimitHits: 0,
            topBlockedIPs: new Map(),
            hourlyStats: new Map(),
            dailyStats: new Map(),
            apiKeyUsage: new Map()
        };
        console.log('🔄 Rate limit monitor statistics reset');
    }
}

// Create singleton instance
const rateLimitMonitor = new RateLimitMonitor();

export default rateLimitMonitor;
