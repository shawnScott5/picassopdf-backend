import mongoose from "mongoose";

const CampaignSchema = new mongoose.Schema({
    userId: {
        type: String
    },
    profilePic: {
        type: Object
    },
    clientName: {
        type: String
    },
    compensation: {
        type: Number
    },
    compensationDuration: {
        type: String
    },
    startDate: {
        type: Date
    },
    isEndDate: {
        type: Boolean
    },
    endDate: {
        type: Date
    },
    details: {
        type: String
    },
    status: {
        type: String
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    }
}, {timeStamps: true});

export default mongoose.model('Campaign', CampaignSchema);