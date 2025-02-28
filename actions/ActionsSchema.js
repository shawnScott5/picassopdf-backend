import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema({
    createdDate: {
        type: Date
    },
    userId: {
        type: String
    },
    title: {
        type: String
    },
    description: {
        type: String
    }
}, {timeStamps: true});

export default mongoose.model('Note', NoteSchema);