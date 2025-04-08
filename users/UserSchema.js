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
    }

}, {timeStamps: true});

export default mongoose.model('User', UserSchema);