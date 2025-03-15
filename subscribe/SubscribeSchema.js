import mongoose from "mongoose";

const SubscribeSchema = new mongoose.Schema({
    plan: {
        type: String
    },
    stripeProductId: {
        type: Object
    }
}, {timeStamps: true});

export default mongoose.model('Subscription', SubscribeSchema);