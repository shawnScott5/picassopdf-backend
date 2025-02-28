import mongoose from "mongoose";

const TasksSchema = new mongoose.Schema({
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
    },
    priority: {
        type: String
    },
    addToCalendar: {
        type: Boolean
    },
    reminder: {
        type: String,
        default: ''
    },
    recurring: {
        type: Boolean
    },
    flagged: {
        type: Boolean
    },
    dueDate: {
        type: String
    },
    dueDateTime: {
        type: String
    },
    calendarDate: {
        type: String
    },
    dueDate: {
        type: String
    },
    status: {
        type: String
    },
}, {timeStamps: true});

export default mongoose.model('Task', TasksSchema);