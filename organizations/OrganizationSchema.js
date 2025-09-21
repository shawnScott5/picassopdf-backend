import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 100
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    
    website: {
        type: String,
        trim: true,
        maxlength: 200
    },
    
    // Company Details
    companySize: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
        required: false
    },
    
    industry: {
        type: String,
        trim: true,
        maxlength: 100
    },
    
    // Contact Information
    contactEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    
    phone: {
        type: String,
        trim: true,
        maxlength: 20
    },
    
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'US' }
    },
    
    // Organization Settings
    settings: {
        allowUserRegistration: {
            type: Boolean,
            default: true
        },
        requireEmailVerification: {
            type: Boolean,
            default: true
        },
        defaultUserRole: {
            type: String,
            enum: ['member', 'admin', 'owner'],
            default: 'member'
        },
        maxUsers: {
            type: Number,
            default: 10,
            min: 1,
            max: 10000
        },
        branding: {
            logo: { type: String },
            primaryColor: { type: String, default: '#dd0302' },
            secondaryColor: { type: String, default: '#e3aa36' }
        }
    },
    
    // Subscription and Billing
    subscription: {
        type: {
            type: String,
            enum: ['FREE', 'PRO', 'SCALE', 'ENTERPRISE'],
            default: 'FREE'
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'suspended', 'cancelled'],
            default: 'active'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date
        },
        stripeCustomerId: {
            type: String
        },
        stripeSubscriptionId: {
            type: String
        }
    },
    
    // Usage Limits
    limits: {
        monthlyConversions: {
            type: Number,
            default: 100
        },
        maxFileSize: {
            type: Number,
            default: 10485760 // 10MB in bytes
        },
        apiRequestsPerMonth: {
            type: Number,
            default: 1000
        }
    },
    
    // Usage Tracking
    usage: {
        currentMonthConversions: {
            type: Number,
            default: 0
        },
        currentMonthApiRequests: {
            type: Number,
            default: 0
        },
        lastResetDate: {
            type: Date,
            default: Date.now
        }
    },
    
    // Status and Metadata
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending_verification'],
        default: 'pending_verification'
    },
    
    isVerified: {
        type: Boolean,
        default: false
    },
    
    verificationToken: {
        type: String
    },
    
    verifiedAt: {
        type: Date
    },
    
    // Audit Fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for member count
OrganizationSchema.virtual('memberCount', {
    ref: 'User',
    localField: '_id',
    foreignField: 'organizationId',
    count: true
});

// Virtual for active member count
OrganizationSchema.virtual('activeMemberCount', {
    ref: 'User',
    localField: '_id',
    foreignField: 'organizationId',
    count: true,
    match: { status: 'active' }
});

// Indexes for better query performance
OrganizationSchema.index({ slug: 1 });
OrganizationSchema.index({ contactEmail: 1 });
OrganizationSchema.index({ createdBy: 1 });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ 'subscription.type': 1 });

// Pre-save middleware to generate slug
OrganizationSchema.pre('save', function(next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }
    this.updatedAt = new Date();
    next();
});

// Instance methods
OrganizationSchema.methods.addMember = async function(userId, role = 'member') {
    // This would be implemented in the User schema
    // to add the user to this organization
    return true;
};

OrganizationSchema.methods.removeMember = async function(userId) {
    // This would be implemented in the User schema
    // to remove the user from this organization
    return true;
};

OrganizationSchema.methods.updateUsage = async function(conversions = 0, apiRequests = 0) {
    this.usage.currentMonthConversions += conversions;
    this.usage.currentMonthApiRequests += apiRequests;
    await this.save();
    return this;
};

OrganizationSchema.methods.resetMonthlyUsage = async function() {
    this.usage.currentMonthConversions = 0;
    this.usage.currentMonthApiRequests = 0;
    this.usage.lastResetDate = new Date();
    await this.save();
    return this;
};

OrganizationSchema.methods.checkUsageLimits = function() {
    const conversionLimit = this.limits.monthlyConversions;
    const apiLimit = this.limits.apiRequestsPerMonth;
    
    return {
        conversions: {
            used: this.usage.currentMonthConversions,
            limit: conversionLimit,
            remaining: Math.max(0, conversionLimit - this.usage.currentMonthConversions),
            exceeded: this.usage.currentMonthConversions >= conversionLimit
        },
        apiRequests: {
            used: this.usage.currentMonthApiRequests,
            limit: apiLimit,
            remaining: Math.max(0, apiLimit - this.usage.currentMonthApiRequests),
            exceeded: this.usage.currentMonthApiRequests >= apiLimit
        }
    };
};

// Static methods
OrganizationSchema.statics.findBySlug = function(slug) {
    return this.findOne({ slug: slug, status: { $ne: 'suspended' } });
};

OrganizationSchema.statics.findByEmail = function(email) {
    return this.findOne({ contactEmail: email.toLowerCase() });
};

OrganizationSchema.statics.findByUser = function(userId) {
    return this.find({ createdBy: userId }).sort({ createdAt: -1 });
};

export default mongoose.model('Organization', OrganizationSchema);