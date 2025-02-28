import mongoose from "mongoose";

const NotesSchema = new mongoose.Schema({
    createdDate: {
        type: String
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

export default mongoose.model('Notes', NotesSchema);