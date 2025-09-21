import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
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
    
    website: {
        type: String,
        trim: true,
        validate: {
            validator: function(url) {
                if (!url) return true; // Allow empty
                try {
                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Invalid website URL'
        }
    },
    
    contactEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Invalid email format'
        }
    },
    
    size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
        default: '1-10'
    },
    
    industry: {
        type: String,
        trim: true,
        maxlength: 100
    },
    
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'US' }
    },
    
    // Company settings
    settings: {
        timezone: {
            type: String,
            default: 'America/New_York'
        },
        currency: {
            type: String,
            default: 'USD'
        },
        dateFormat: {
            type: String,
            default: 'MM/DD/YYYY'
        }
    },
    
    // Subscription and billing
    subscription: {
        type: {
            type: String,
            enum: ['FREE', 'PRO', 'SCALE', 'ENTERPRISE'],
            default: 'FREE'
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'cancelled', 'past_due'],
            default: 'active'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date
        }
    },
    
    // Company members
    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['owner', 'admin', 'member'],
            default: 'member'
        },
        permissions: [{
            type: String,
            enum: [
                'url_to_pdf',
                'html_to_pdf',
                'file_upload',
                'api_access',
                'team_management',
                'billing_management',
                'analytics_view'
            ]
        }],
        joinedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'pending', 'suspended'],
            default: 'active'
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    
    // Company limits and usage
    limits: {
        maxMembers: {
            type: Number,
            default: 5
        },
        monthlyConversions: {
            type: Number,
            default: 100
        },
        storageLimit: {
            type: Number,
            default: 1024 // MB
        }
    },
    
    usage: {
        currentMonthConversions: {
            type: Number,
            default: 0
        },
        totalStorageUsed: {
            type: Number,
            default: 0 // MB
        },
        lastResetDate: {
            type: Date,
            default: Date.now
        }
    },
    
    // Audit trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Made optional to allow company creation before user creation
    },
    
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    
    // Soft delete
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
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
CompanySchema.index({ name: 1 });
CompanySchema.index({ contactEmail: 1 });
CompanySchema.index({ 'members.userId': 1 });
CompanySchema.index({ status: 1, isDeleted: 1 });

// Virtual for member count
CompanySchema.virtual('memberCount').get(function() {
    return this.members.filter(member => member.status === 'active').length;
});

// Virtual for owner
CompanySchema.virtual('owner').get(function() {
    return this.members.find(member => member.role === 'owner');
});

// Static methods
CompanySchema.statics.findByUser = function(userId) {
    return this.findOne({
        'members.userId': userId,
        status: 'active',
        isDeleted: false
    });
};

CompanySchema.statics.findActiveCompanies = function() {
    return this.find({
        status: 'active',
        isDeleted: false
    }).sort({ createdAt: -1 });
};

// Instance methods
CompanySchema.methods.addMember = function(userId, role = 'member', permissions = [], invitedBy = null) {
    const existingMember = this.members.find(member => member.userId.toString() === userId.toString());
    
    if (existingMember) {
        throw new Error('User is already a member of this company');
    }
    
    this.members.push({
        userId,
        role,
        permissions,
        invitedBy,
        joinedAt: new Date(),
        status: 'active'
    });
    
    return this.save();
};

CompanySchema.methods.removeMember = function(userId) {
    this.members = this.members.filter(member => member.userId.toString() !== userId.toString());
    return this.save();
};

CompanySchema.methods.updateMemberRole = function(userId, role, permissions = []) {
    const member = this.members.find(member => member.userId.toString() === userId.toString());
    
    if (!member) {
        throw new Error('Member not found');
    }
    
    member.role = role;
    member.permissions = permissions;
    
    return this.save();
};

// Pre-save middleware
CompanySchema.pre('save', function(next) {
    // Ensure there's always an owner
    const hasOwner = this.members.some(member => member.role === 'owner' && member.status === 'active');
    
    if (!hasOwner && this.members.length > 0) {
        // Make the first member the owner
        this.members[0].role = 'owner';
    }
    
    next();
});

const Company = mongoose.model('Company', CompanySchema);

export default Company;
