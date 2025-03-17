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
    recurringRevenue: {
        type: Number,
        default: 0
    },
    thisMonthRevenue: {
        type: Number,
        default: 0
    },
    totalClients: {
        type: Number,
        default: 0
    },
    lastMonthClients: {
        type: Number,
        default: 0
    },
    newClients: {
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
    }

}, {timeStamps: true});

export default mongoose.model('User', UserSchema);