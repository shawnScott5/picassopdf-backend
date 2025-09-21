import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    avatar: {
        type: String
    },
    email: {
        type: String,
        require: true,
        unique: true
    },
    password: {
        type: String,
        require: true
    },
    thisMonthRecurringRevenue: {
        type: Number,
        default: 0
    },
    thisMonthTotalRevenue: {
        type: Number,
        default: 0
    },
    lastMonthRecurringRevenue: {
        type: Number,
        default: 0
    },
    lastMonthTotalRevenue: {
        type: Number,
        default: 0
    },
    thisMonthTotalClients: {
        type: Number,
        default: 0
    },
    lastMonthTotalClients: {
        type: Number,
        default: 0
    },
    lastMonthNewClients: {
        type: Number,
        default: 0
    },
    thisMonthNewClients: {
        type: Number,
        default: 0
    },
    lastMonthName: {
        type: String,
        required: true
    },
    thisMonthName: {
        type: String,
        required: true
    },
    previousPaymentDate: {
        type: String,
        required: true
    },
    nextPaymentDate: {
        type: String,
        required: true
    },
    referralCode: {
        type: String
    },
    subscription: {
        type: Object
    },
    previousSubscriptionStartDate: {
        type: String
    },
    subscriptionStartDate: {
        type: String
    },
    admin: {
        type: Boolean,
        default: false
    },
    influencersEmailViewed: {
        type: Array,
        default: []
    },
    influencersChecked: {
        type: Array,
        default: []
    },
    influencersEmailViewedCount: {
        type: Number,
        default: 0
    },
    stripeSessionId: {
        type: String
    },
    stripeSubscriptionId: {
        type: String
    },
    tempViewLimit: {
        type: Number
    },
    fingerprint: {
        type: String
    },
    credits: {
        type: Number,
        default: 0 // Available credits for PDF conversions
    },
    totalCreditsUsed: {
        type: Number,
        default: 0 // Total credits used across all conversions
    },
    lastCreditUpdate: {
        type: Date,
        default: Date.now
    },
    
    // Organization and Role Management
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: false,
        index: true
    },
    
    // Company Management
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    
    role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        required: false,
        default: null
    },
    
    // Account Type
    accountType: {
        type: String,
        enum: ['personal', 'company'],
        default: 'personal'
    },
    
    // Company-specific fields (for personal accounts that later join companies)
    companyName: {
        type: String,
        trim: true
    },
    companyWebsite: {
        type: String,
        trim: true
    },
    companySize: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    
    // User status within organization
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'suspended'],
        default: 'active'
    },
    
    // Invitation and joining
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    }

}, {timestamps: true});

export default mongoose.model('User', UserSchema);