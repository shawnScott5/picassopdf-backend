import mongoose from "mongoose";

const InfluencersSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String
    },
    profilePic: {
        type: Object,
        require: true
    },
    domain: {
        type: String
    },
    hideFromUsers: {
        type: Array,
        default: []
    },
    inUsersListAlready: {
        type: Array,
        default: []
    },
    usernameIG: {
        type: String,
        require: true
    },
    profileUrlIG: {
        type: String,
        require: false
    },
    platform: {
        type: String,
        require: true
    },
    followersIG: {
        type: String,
        require: false
    },
    followersIGNum: {
        type: Number,
        require: false
    },
    profileUrlTikTok: {
        type: String,
        require: false
    },
    followersTikTok: {
        type: String,
        require: false
    },
    followersTikTok: {
        type: String,
        require: false
    },
    profileUrlFacebook: {
        type: String,
        require: false
    },
    followersFacebook: {
        type: String,
        require: false
    },
    followersFacebookNum: {
        type: Number,
        require: false
    },
    profileUrlX: {
        type: String,
        require: false
    },
    followersX: {
        type: String,
        require: false
    },
    followersXNum: {
        type: Number,
        require: false
    },
    profileUrlYoutube: {
        type: String,
        require: false
    },
    followersYoutube: {
        type: String,
        require: false
    },
    followersYoutubeNum: {
        type: Number,
        require: false
    },
    profileUrlLinkedIn: {
        type: Object,
        require: false
    },
    followersLinkedIn: {
        type: String,
        require: false
    },
    followersLinkedInNum: {
        type: Number,
        require: false
    },
    followersTotal: {
        type: String,
        require: true
    },
    followersTotalNum: {
        type: Number,
        require: true
    },
    emails: {
        type: Array,
        require: false
    },
    phoneNumber: {
        type: String
    },
    category: {
        type: String,
        require: true
    },
    country: {
        type: String,
        require: false
    },
    city: {
        type: String,
        require: false
    },
    state: {
        type: String,
        require: false
    },
    updatedDate: {
        type: String,
        require: true
    },
    isHidden: {
        type: Boolean,
        default: false
    }
}, {timeStamps: true});

export default mongoose.model('Influencer', InfluencersSchema);