import SubscribeSchema from './SubscribeSchema.js';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10'
});

const subscriptionPlans = async(req, res, next) => {
    try {
        const subscriptions = await SubscribeSchema.find();
        return res.status(200).json({
            status: true,
            data: subscriptions
        });

    } catch(error) {
        console.log(error)
        return res.status(500).json({error: 'Something went wrong'});
    }
}


export { subscriptionPlans };