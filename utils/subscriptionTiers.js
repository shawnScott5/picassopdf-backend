/**
 * Subscription Tier Utility Functions
 * Determines subscription tier based on credit amount
 */

/**
 * Get subscription tier based on credit amount
 * @param {number} credits - Number of credits
 * @returns {string} - Subscription tier name
 */
export const getSubscriptionTier = (credits) => {
    if (credits <= 50) {
        return 'FREE';
    } else if (credits <= 500) {
        return 'STARTER';
    } else if (credits <= 5000) {
        return 'GROWTH';
    } else if (credits <= 50000) {
        return 'SCALE';
    } else if (credits <= 100000) {
        return 'SMALL_BUSINESS';
    } else if (credits <= 500000) {
        return 'MEDIUM_BUSINESS';
    } else {
        return 'ENTERPRISE';
    }
};

/**
 * Get rate limit based on subscription tier
 * @param {string} tier - Subscription tier
 * @returns {number} - Requests per minute
 */
export const getRateLimitForTier = (tier) => {
    // All tiers get the same rate limit (600 RPM / 10 RPS)
    // This provides good performance for all company sizes while maintaining protection
    const rateLimits = {
        'FREE': 600,           // 600 RPM (10 RPS) - same as others
        'STARTER': 600,        // 600 RPM (10 RPS)
        'GROWTH': 600,         // 600 RPM (10 RPS)
        'SCALE': 600,          // 600 RPM (10 RPS)
        'SMALL_BUSINESS': 600, // 600 RPM (10 RPS)
        'MEDIUM_BUSINESS': 600,// 600 RPM (10 RPS)
        'ENTERPRISE': 600      // 600 RPM (10 RPS)
    };
    
    return rateLimits[tier] || rateLimits['FREE'];
};

/**
 * Get tier display information
 * @param {string} tier - Subscription tier
 * @returns {object} - Tier display info
 */
export const getTierInfo = (tier) => {
    const tierInfo = {
        'FREE': {
            name: 'Free',
            credits: '≤ 50',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Perfect for testing and small projects'
        },
        'STARTER': {
            name: 'Starter',
            credits: '51-500',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Great for small businesses and startups'
        },
        'GROWTH': {
            name: 'Growth',
            credits: '501-5,000',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Ideal for growing businesses'
        },
        'SCALE': {
            name: 'Scale',
            credits: '5,001-50,000',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Built for high-volume operations'
        },
        'SMALL_BUSINESS': {
            name: 'Small Business',
            credits: '50,001-100,000',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Perfect for established small businesses'
        },
        'MEDIUM_BUSINESS': {
            name: 'Medium Business',
            credits: '100,001-500,000',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Ideal for medium-sized organizations'
        },
        'ENTERPRISE': {
            name: 'Enterprise',
            credits: '500,001-1,000,000',
            rateLimit: '600 RPM (10 RPS)',
            description: 'Custom solutions for large organizations'
        }
    };
    
    return tierInfo[tier] || tierInfo['FREE'];
};

/**
 * Get all available tiers
 * @returns {array} - Array of tier objects
 */
export const getAllTiers = () => {
    return [
        'FREE',
        'STARTER', 
        'GROWTH',
        'SCALE',
        'SMALL_BUSINESS',
        'MEDIUM_BUSINESS',
        'ENTERPRISE'
    ].map(tier => ({
        tier,
        ...getTierInfo(tier),
        rateLimit: getRateLimitForTier(tier)
    }));
};

/**
 * Check if user can upgrade to a higher tier
 * @param {string} currentTier - Current subscription tier
 * @param {string} targetTier - Target subscription tier
 * @returns {boolean} - Whether upgrade is allowed
 */
export const canUpgrade = (currentTier, targetTier) => {
    const tierOrder = ['FREE', 'STARTER', 'GROWTH', 'SCALE', 'SMALL_BUSINESS', 'MEDIUM_BUSINESS', 'ENTERPRISE'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    return targetIndex > currentIndex;
};

/**
 * Get next tier in the upgrade path
 * @param {string} currentTier - Current subscription tier
 * @returns {string|null} - Next tier or null if at highest tier
 */
export const getNextTier = (currentTier) => {
    const tierOrder = ['FREE', 'STARTER', 'GROWTH', 'SCALE', 'SMALL_BUSINESS', 'MEDIUM_BUSINESS', 'ENTERPRISE'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex < tierOrder.length - 1) {
        return tierOrder[currentIndex + 1];
    }
    
    return null;
};

export default {
    getSubscriptionTier,
    getRateLimitForTier,
    getTierInfo,
    getAllTiers,
    canUpgrade,
    getNextTier
};
