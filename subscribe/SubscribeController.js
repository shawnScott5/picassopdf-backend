import SubscribeSchema from './SubscribeSchema.js';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10'
});
console.log(stripe)

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

const subscribeToPro = async(req, res, next) => {
    try {
        const { priceId } = req.body; // Price ID from frontend
    
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: "https://app.distros.io/membership",
          cancel_url: "https://app.distros.io/membership",
        });
    
        return res.json({ sessionUrl: session.url }); // Send back checkout URL to frontend
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
}

const subscribeToScale = async(req, res, next) => {
    try {
        const { priceId } = req.body; // Price ID from frontend
    
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: "https://app.distros.io/membership",
          cancel_url: "https://app.distros.io/membership",
        });
    
        return res.json({ sessionUrl: session.url }); // Send back checkout URL to frontend
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
}

export { subscriptionPlans, subscribeToPro, subscribeToScale };