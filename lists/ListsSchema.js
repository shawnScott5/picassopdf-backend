import mongoose from "mongoose";

const ListsSchema = new mongoose.Schema({
    createdDate: {
        type: String
    },
    updatedDate: {
        type: String
    },
    userId: {
        type: String
    },
    name: {
        type: String
    },
    influencers: {
        type: Array
    }
}, {timeStamps: true});

export default mongoose.model('InfluencerList', ListsSchema);