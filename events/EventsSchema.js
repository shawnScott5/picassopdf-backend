import mongoose from "mongoose";

const EventsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    details: {
        type: String
    },
    startDate: {
        type: String,
        required: true
    },
    startTime: {
        type: String
    },
    isEndDate: {
        type: Boolean
    },
    endDate: {
        type: String
    },
    endTime: {
        type: String
    },
    isComplete: {
        type: Boolean,
        default: false
    }
}, {timeStamps: true});

export default mongoose.model('Event', EventsSchema);