import mongoose from "mongoose";

const InfluencerListsSchema = new mongoose.Schema({
    userId: {
        type: String
    },
    name: {
        type: String
    },
    influencersInList: {
        type: Array
    }
}, {timeStamps: true});

export default mongoose.model('InfluencerLists', InfluencerListsSchema);