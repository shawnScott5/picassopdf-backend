import mongoose from 'mongoose';
import crypto from 'crypto';

const ApiKeys = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    
    // API Key Details (HASHED - never store plain text)
    keyHash: {
        type: String,
        required: false, // Optional for backward compatibility
        unique: true,
        sparse: true, // Allows multiple null values
        index: true
    },
    
    // Key identifier (public, non-sensitive)
    keyId: {
        type: String,
        required: false, // Optional for backward compatibility
        unique: true,
        sparse: true, // Allows multiple null values
        index: true
    },
    
    // Key version for rotation support
    keyVersion: {
        type: Number,
        default: 1,
        index: true
    },
    
    // Salt for key hashing (stored securely)
    salt: {
        type: String,
        required: false // Optional for backward compatibility
    },
    
    // Legacy key field (for backward compatibility)
    key: {
        type: String,
        required: false, // Optional for new secure keys
        sparse: true // Allows multiple null values, no unique constraint
    },
    
    keyPrefix: {
        type: String,
        required: true,
        enum: ['pk_live_', 'pk_test_', 'sk_live_', 'sk_test_'],
        default: 'pk_live_'
    },
    
    // User and Organization
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: false,
        index: true
    },
    
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: false,
        index: true
    },
    
    // Permissions and Scopes
    permissions: [{
        type: String,
        enum: [
            'pdf_conversion',
            'html_to_pdf',
            'notion_conversion',
            'airtable_conversion',
            'csv_conversion',
            'grapesjs_conversion',
            'file_upload',
            'file_download',
            'user_management',
            'analytics_read',
            'analytics_write',
            'billing_read',
            'billing_write',
            'api_keys_manage',
            'webhooks_manage',
            'templates_manage',
            'data_export',
            'data_import'
        ],
        default: ['pdf_conversion', 'html_to_pdf']
    }],
    
    scopes: [{
        type: String,
        enum: [
            'read',
            'write',
            'admin',
            'billing',
            'analytics',
            'webhooks'
        ],
        default: ['read', 'write']
    }],
    
    // Rate Limiting (Tripled for better scalability)
    rateLimits: {
        requestsPerMinute: {
            type: Number,
            default: 300, // Tripled from 100
            min: 1,
            max: 30000 // Tripled from 10000
        },
        requestsPerHour: {
            type: Number,
            default: 3000, // Tripled from 1000
            min: 1,
            max: 300000 // Tripled from 100000
        },
        requestsPerDay: {
            type: Number,
            default: 30000, // Tripled from 10000
            min: 1,
            max: 3000000 // Tripled from 1000000
        },
        burstLimit: {
            type: Number,
            default: 150, // Tripled from 50
            min: 1,
            max: 3000 // Tripled from 1000
        }
    },
    
    // Usage Tracking
    usage: {
        totalRequests: {
            type: Number,
            default: 0
        },
        successfulRequests: {
            type: Number,
            default: 0
        },
        failedRequests: {
            type: Number,
            default: 0
        },
        lastUsed: {
            type: Date,
            default: null
        },
        lastUsedIP: {
            type: String,
            default: null
        },
        lastUsedUserAgent: {
            type: String,
            default: null
        },
        dailyUsage: [{
            date: {
                type: Date,
                default: Date.now
            },
            requests: {
                type: Number,
                default: 0
            },
            successful: {
                type: Number,
                default: 0
            },
            failed: {
                type: Number,
                default: 0
            }
        }],
        monthlyUsage: [{
            month: {
                type: String,
                format: 'YYYY-MM'
            },
            requests: {
                type: Number,
                default: 0
            },
            successful: {
                type: Number,
                default: 0
            },
            failed: {
                type: Number,
                default: 0
            }
        }]
    },
    
    // Status and Lifecycle
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'expired', 'revoked'],
        default: 'active',
        index: true
    },
    
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Expiration
    expiresAt: {
        type: Date,
        default: null,
        index: true
    },
    
    // Security
    allowedIPs: [{
        type: String,
        validate: {
            validator: function(ip) {
                // Basic IP validation (IPv4 and IPv6)
                const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
                return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrRegex.test(ip);
            },
            message: 'Invalid IP address format'
        }
    }],
    
    // Security metadata
    securityMetadata: {
        lastRotated: {
            type: Date,
            default: null
        },
        rotationCount: {
            type: Number,
            default: 0
        },
        compromisedAt: {
            type: Date,
            default: null
        },
        lastSecurityCheck: {
            type: Date,
            default: Date.now
        },
        failedAttempts: {
            type: Number,
            default: 0
        },
        lastFailedAttempt: {
            type: Date,
            default: null
        }
    },
    
    allowedDomains: [{
        type: String,
        validate: {
            validator: function(domain) {
                const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
                return domainRegex.test(domain);
            },
            message: 'Invalid domain format'
        }
    }],
    
    // Webhook Configuration
    webhooks: [{
        url: {
            type: String,
            required: true,
            validate: {
                validator: function(url) {
                    try {
                        new URL(url);
                        return true;
                    } catch {
                        return false;
                    }
                },
                message: 'Invalid webhook URL'
            }
        },
        events: [{
            type: String,
            enum: [
                'conversion.completed',
                'conversion.failed',
                'rate_limit.exceeded',
                'key.usage_warning',
                'key.expired',
                'key.revoked'
            ]
        }],
        secret: {
            type: String,
            required: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastTriggered: {
            type: Date,
            default: null
        },
        failureCount: {
            type: Number,
            default: 0
        }
    }],
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    
    // Audit Trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    
    // Versioning
    version: {
        type: Number,
        default: 1
    },
    
    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    
    deletedAt: {
        type: Date,
        default: null
    },
    
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
ApiKeys.index({ userId: 1, isActive: 1 });
ApiKeys.index({ organizationId: 1, isActive: 1 });
ApiKeys.index({ companyId: 1, isActive: 1 });
ApiKeys.index({ key: 1, isDeleted: 1 }, { sparse: true }); // Compound index with isDeleted for better querying
ApiKeys.index({ keyId: 1, isDeleted: 1 }, { unique: true, sparse: true }); // Optimized for uniqueness checks
ApiKeys.index({ status: 1, expiresAt: 1 });
ApiKeys.index({ 'usage.lastUsed': -1 });
ApiKeys.index({ createdAt: -1 });
ApiKeys.index({ isDeleted: 1, createdAt: -1 });

// Compound indexes
ApiKeys.index({ userId: 1, status: 1, isActive: 1 });
ApiKeys.index({ organizationId: 1, status: 1, isActive: 1 });
ApiKeys.index({ companyId: 1, status: 1, isActive: 1 });

// Virtual for full API key (prefix + keyId for display purposes)
ApiKeys.virtual('fullKey').get(function() {
    if (this.keyId) {
        return this.keyPrefix + this.keyId;
    }
    // Fallback for old API keys that don't have keyId
    return this.keyPrefix + (this.key || 'legacy_key');
});

// Virtual for display key (shows only first 8 chars of keyId for security)
ApiKeys.virtual('displayKey').get(function() {
    if (this.keyId) {
        return this.keyPrefix + this.keyId.substring(0, 8) + '...';
    }
    // Fallback for old API keys
    if (this.key) {
        return this.keyPrefix + this.key.substring(0, 8) + '...';
    }
    return this.keyPrefix + 'legacy...';
});

// Virtual for days until expiration
ApiKeys.virtual('daysUntilExpiration').get(function() {
    if (!this.expiresAt) return null;
    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for usage statistics
ApiKeys.virtual('usageStats').get(function() {
    return {
        totalRequests: this.usage.totalRequests,
        successfulRequests: this.usage.successfulRequests,
        failedRequests: this.usage.failedRequests,
        successRate: this.usage.totalRequests > 0 
            ? ((this.usage.successfulRequests / this.usage.totalRequests) * 100).toFixed(2)
            : 0,
        lastUsed: this.usage.lastUsed,
        isExpired: this.expiresAt ? this.expiresAt < new Date() : false,
        isNearExpiration: this.expiresAt ? this.daysUntilExpiration <= 7 : false
    };
});

// Virtual for rate limit status
ApiKeys.virtual('rateLimitStatus').get(function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get today's usage
    const todayUsage = this.usage.dailyUsage.find(usage => 
        usage.date.toDateString() === today.toDateString()
    );
    
    const dailyRequests = todayUsage ? todayUsage.requests : 0;
    
    return {
        dailyLimit: this.rateLimits.requestsPerDay,
        dailyUsed: dailyRequests,
        dailyRemaining: Math.max(0, this.rateLimits.requestsPerDay - dailyRequests),
        isDailyLimitReached: dailyRequests >= this.rateLimits.requestsPerDay,
        hourlyLimit: this.rateLimits.requestsPerHour,
        minuteLimit: this.rateLimits.requestsPerMinute
    };
});

// Pre-save middleware
ApiKeys.pre('save', async function(next) {
    // Generate secure key pair if not provided (only for new keys)
    if (this.isNew && (!this.keyHash || !this.keyId)) {
        try {
            const keyPair = await this.constructor.generateUniqueApiKeyPair();
            this.keyHash = keyPair.keyHash;
            this.keyId = keyPair.keyId;
            this.salt = keyPair.salt;
            
            // Ensure key field is undefined (not null) for new secure keys
            this.key = undefined;
            
            // Store the raw key temporarily for response (will be discarded after save)
            this._tempRawKey = keyPair.rawKey;
        } catch (error) {
            return next(error);
        }
    }
    
    // For existing keys without secure fields, keep the legacy key
    if (!this.isNew && !this.keyHash && !this.keyId && this.key) {
        // This is a legacy key, keep it as is
        console.log('Processing legacy API key:', this._id);
    }
    
    // Set last modified by if not set
    if (this.isModified() && !this.lastModifiedBy) {
        this.lastModifiedBy = this.createdBy;
    }
    
    // Increment version on modification
    if (this.isModified() && !this.isNew) {
        this.version += 1;
    }
    
    next();
});

// Pre-save middleware for soft delete
ApiKeys.pre('save', function(next) {
    if (this.isDeleted && !this.deletedAt) {
        this.deletedAt = new Date();
    }
    next();
});

// Instance methods
ApiKeys.methods.generateSecureKeyPair = function() {
    // Generate a cryptographically secure random key (48 bytes = 384 bits for higher entropy)
    const randomBytes = crypto.randomBytes(48);
    const rawKey = randomBytes.toString('base64url');
    
    // Generate a unique key ID with higher entropy (24 bytes = 192 bits)
    const keyId = crypto.randomBytes(24).toString('hex');
    
    // Hash the key using PBKDF2 with salt (industry standard)
    const salt = crypto.randomBytes(32);
    const keyHash = crypto.pbkdf2Sync(rawKey, salt, 100000, 64, 'sha512').toString('hex');
    
    return {
        rawKey: rawKey,
        keyId: keyId,
        keyHash: keyHash,
        salt: salt.toString('hex')
    };
};

// Static method to generate a guaranteed unique key pair
ApiKeys.statics.generateUniqueApiKeyPair = async function() {
    let attempts = 0;
    const maxAttempts = 50; // Increased for better collision handling at scale
    
    while (attempts < maxAttempts) {
        // Generate secure key pair with increased entropy
        const keyPair = this.prototype.generateSecureKeyPair();
        
        // Use a more efficient query with compound index
        const existingKey = await this.findOne({ 
            keyId: keyPair.keyId, 
            isDeleted: false 
        }).select('_id').lean(); // Only select _id for efficiency
        
        if (!existingKey) {
            return keyPair; // Key ID is unique
        }
        
        attempts++;
        
        // Add exponential backoff for high collision scenarios
        if (attempts > 10) {
            await new Promise(resolve => setTimeout(resolve, Math.min(100 * Math.pow(2, attempts - 10), 1000)));
        }
    }
    
    // If we can't generate a unique key after max attempts, use a timestamp-based approach
    console.warn(`Failed to generate unique key after ${maxAttempts} attempts, using timestamp-based approach`);
    
    const timestamp = Date.now().toString(36);
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const fallbackKeyId = `${timestamp}_${randomSuffix}`;
    
    // Verify this fallback is also unique
    const existingFallback = await this.findOne({ 
        keyId: fallbackKeyId, 
        isDeleted: false 
    }).select('_id').lean();
    
    if (existingFallback) {
        throw new Error('Critical: Unable to generate unique API key even with fallback method');
    }
    
    // Generate a new key pair with the fallback keyId
    const fallbackKeyPair = this.prototype.generateSecureKeyPair();
    fallbackKeyPair.keyId = fallbackKeyId;
    
    return fallbackKeyPair;
};

// Method to verify API key
ApiKeys.methods.verifyApiKey = function(rawKey) {
    console.log('=== VERIFY API KEY DEBUG ===');
    console.log('Raw key received:', rawKey);
    console.log('Raw key length:', rawKey.length);
    console.log('Stored salt (first 16 chars):', this.salt ? this.salt.substring(0, 16) + '...' : 'NO SALT');
    console.log('Stored hash (first 16 chars):', this.keyHash ? this.keyHash.substring(0, 16) + '...' : 'NO HASH');
    console.log('API key version:', this.keyVersion || 'legacy');
    console.log('Has legacy key field:', !!this.key);
    
    // Check if this is a legacy key
    if (!this.keyHash && this.key) {
        console.log('Using legacy key comparison');
        return this.key === rawKey;
    }
    
    // Recreate the hash using the stored salt
    const salt = Buffer.from(this.salt, 'hex');
    const hashToVerify = crypto.pbkdf2Sync(rawKey, salt, 100000, 64, 'sha512').toString('hex');
    console.log('Generated hash (first 16 chars):', hashToVerify.substring(0, 16) + '...');
    
    // Use constant-time comparison to prevent timing attacks
    const result = crypto.timingSafeEqual(Buffer.from(this.keyHash, 'hex'), Buffer.from(hashToVerify, 'hex'));
    console.log('Hash comparison result:', result);
    console.log('=== END VERIFY DEBUG ===');
    
    return result;
};

ApiKeys.methods.incrementUsage = async function(success = true, ip = null, userAgent = null) {
    this.usage.totalRequests += 1;
    
    if (success) {
        this.usage.successfulRequests += 1;
    } else {
        this.usage.failedRequests += 1;
    }
    
    this.usage.lastUsed = new Date();
    if (ip) this.usage.lastUsedIP = ip;
    if (userAgent) this.usage.lastUsedUserAgent = userAgent;
    
    // Update daily usage
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let dailyUsage = this.usage.dailyUsage.find(usage => 
        usage.date.toISOString().split('T')[0] === todayStr
    );
    
    if (!dailyUsage) {
        dailyUsage = {
            date: today,
            requests: 0,
            successful: 0,
            failed: 0
        };
        this.usage.dailyUsage.push(dailyUsage);
    }
    
    dailyUsage.requests += 1;
    if (success) {
        dailyUsage.successful += 1;
    } else {
        dailyUsage.failed += 1;
    }
    
    // Update monthly usage
    const monthStr = today.toISOString().substring(0, 7); // YYYY-MM
    
    let monthlyUsage = this.usage.monthlyUsage.find(usage => 
        usage.month === monthStr
    );
    
    if (!monthlyUsage) {
        monthlyUsage = {
            month: monthStr,
            requests: 0,
            successful: 0,
            failed: 0
        };
        this.usage.monthlyUsage.push(monthlyUsage);
    }
    
    monthlyUsage.requests += 1;
    if (success) {
        monthlyUsage.successful += 1;
    } else {
        monthlyUsage.failed += 1;
    }
    
    await this.save();
    return this;
};

ApiKeys.methods.checkRateLimit = function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get today's usage
    const todayUsage = this.usage.dailyUsage.find(usage => 
        usage.date.toDateString() === today.toDateString()
    );
    
    const dailyRequests = todayUsage ? todayUsage.requests : 0;
    
    return {
        allowed: dailyRequests < this.rateLimits.requestsPerDay,
        remaining: Math.max(0, this.rateLimits.requestsPerDay - dailyRequests),
        resetTime: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
    };
};

ApiKeys.methods.checkIPWhitelist = function(ip) {
    if (!this.allowedIPs || this.allowedIPs.length === 0) {
        return true; // No IP restrictions
    }
    
    return this.allowedIPs.some(allowedIP => {
        if (allowedIP.includes('/')) {
            // CIDR notation
            return this.isIPInCIDR(ip, allowedIP);
        } else {
            // Exact IP match
            return ip === allowedIP;
        }
    });
};

ApiKeys.methods.isIPInCIDR = function(ip, cidr) {
    // Simple CIDR check implementation
    // In production, you might want to use a library like 'ip-cidr'
    const [network, prefixLength] = cidr.split('/');
    // This is a simplified implementation
    return ip.startsWith(network.split('.').slice(0, Math.floor(prefixLength / 8)).join('.'));
};

ApiKeys.methods.checkDomainWhitelist = function(domain) {
    if (!this.allowedDomains || this.allowedDomains.length === 0) {
        return true; // No domain restrictions
    }
    
    return this.allowedDomains.some(allowedDomain => {
        return domain === allowedDomain || domain.endsWith('.' + allowedDomain);
    });
};

ApiKeys.methods.revoke = async function(revokedBy) {
    this.status = 'revoked';
    this.isActive = false;
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = revokedBy;
    this.lastModifiedBy = revokedBy;
    await this.save();
    return this;
};

ApiKeys.methods.suspend = async function(suspendedBy, reason = '') {
    this.status = 'suspended';
    this.isActive = false;
    this.lastModifiedBy = suspendedBy;
    if (reason) {
        this.metadata.suspensionReason = reason;
    }
    await this.save();
    return this;
};

ApiKeys.methods.activate = async function(activatedBy) {
    this.status = 'active';
    this.isActive = true;
    this.lastModifiedBy = activatedBy;
    if (this.metadata.suspensionReason) {
        delete this.metadata.suspensionReason;
    }
    await this.save();
    return this;
};

// Static methods
ApiKeys.statics.findByKeyId = function(keyId) {
    return this.findOne({ keyId: keyId, isActive: true, isDeleted: false });
};

ApiKeys.statics.findByKey = function(key) {
    // This method is deprecated - use findByKeyId instead
    console.warn('findByKey is deprecated. Use findByKeyId for secure key lookup.');
    return this.findOne({ key: key, isActive: true, isDeleted: false });
};

ApiKeys.statics.findByUser = function(userId, options = {}) {
    const query = { userId: userId, isDeleted: false };
    
    if (options.activeOnly) {
        query.isActive = true;
        query.status = 'active';
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

ApiKeys.statics.findByOrganization = function(organizationId, options = {}) {
    const query = { organizationId: organizationId, isDeleted: false };
    
    if (options.activeOnly) {
        query.isActive = true;
        query.status = 'active';
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

ApiKeys.statics.findByCompany = function(companyId, options = {}) {
    const query = { companyId: companyId, isDeleted: false };
    
    if (options.activeOnly) {
        query.isActive = true;
        query.status = 'active';
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

ApiKeys.statics.getUsageStats = function(userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                userId: mongoose.Types.ObjectId(userId),
                isDeleted: false,
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalKeys: { $sum: 1 },
                activeKeys: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                totalRequests: { $sum: '$usage.totalRequests' },
                successfulRequests: { $sum: '$usage.successfulRequests' },
                failedRequests: { $sum: '$usage.failedRequests' }
            }
        }
    ]);
};

ApiKeys.statics.findExpiringSoon = function(days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        expiresAt: { $lte: futureDate, $gte: new Date() },
        isActive: true,
        isDeleted: false
    });
};

ApiKeys.statics.cleanupExpired = async function() {
    const result = await this.updateMany(
        {
            expiresAt: { $lt: new Date() },
            status: { $ne: 'expired' }
        },
        {
            $set: {
                status: 'expired',
                isActive: false,
                lastModifiedBy: null // System action
            }
        }
    );
    
    return result;
};

// Create the model
const ApiKeysModel = mongoose.model('ApiKeys', ApiKeys);

export default ApiKeysModel;
