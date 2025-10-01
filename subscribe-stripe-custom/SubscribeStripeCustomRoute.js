import express from 'express';
import Stripe from "stripe";
import UserSchema from '../users/UserSchema.js';

// Function to format credit amounts for display
function formatCredits(credits) {
    if (credits >= 1000000) {
        return (credits / 1000000).toFixed(0) + 'M';
    } else if (credits >= 1000) {
        return (credits / 1000).toFixed(0) + 'k';
    } else {
        return credits.toString();
    }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10'
});

const SubscribeStripeCustomRoute = express.Router();

// Create a custom subscription based on the number of credits
SubscribeStripeCustomRoute.post('/', async(req, res) => {
    try {
        console.log('Received subscription request:', req.body);
        const { credits, userId, price, customerEmail } = req.body; 
        
        // Create a product for this custom plan
        const product = await stripe.products.create({
            name: `PicassoPDF - ${formatCredits(credits)} Credits`,
            description: `Generate PDF Masterpieces in seconds`,
            metadata: {
                credits: credits.toString(),
                userId: userId || 'pending'
            }
        });

        // Create a price for this product
        const stripePrice = await stripe.prices.create({
            unit_amount: Math.round(price * 100), // Convert to cents
            currency: 'usd',
            recurring: { interval: 'month' },
            product: product.id,
            metadata: {
                credits: credits.toString(),
                userId: userId || 'pending'
            }
        });

        // Create checkout session
        const sessionConfig = {
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [{ 
                price: stripePrice.id, 
                quantity: 1,
                adjustable_quantity: {
                    enabled: false
                }
            }],
            subscription_data: {
                description: `PicassoPDF - ${formatCredits(credits)} Credits`
            },
            success_url: "https://app.distros.io/membership?success=true",
            cancel_url: "https://app.distros.io/app/dashboard",
            metadata: {
                userId: userId || 'pending',
                credits: credits.toString(),
                planType: 'CUSTOM'
            }
        };

        // Only add customer_email if it's valid
        if (customerEmail && customerEmail.trim() !== '') {
            sessionConfig.customer_email = customerEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        // Only update user if userId is provided (user is logged in)
        if(session.id && userId) {
            const nextPaymentDate = new Date();
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

            await UserSchema.findOneAndUpdate({ _id: userId }, 
                { $set: 
                    { 
                    stripeSessionId: session.id, 
                    'subscription.type': 'CUSTOM',
                    'subscription.credits': credits,
                    'subscription.price': price,
                    subscriptionStartDate: new Date().toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                    }),
                    nextPaymentDate: nextPaymentDate.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                    }),
                    }
                }, { new: true });
        }

        console.log('Successfully created Stripe session:', session.id);
        return res.json({ session: session });

    } catch (error) {
        console.error('Stripe custom subscription error:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ error: error.message });
    }
});

// Handle subscription details for custom plans
SubscribeStripeCustomRoute.post('/details', async(req, res) => {
    try {
        const { sessionId, user } = req.body;

        if(user.subscription.type === 'CUSTOM' && !user.stripeSubscriptionId) {
            if(user.stripeSessionId) {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                const subscriptionId = session.subscription;

                if (!subscriptionId) {
                    const updatedUser = await UserSchema.findOneAndUpdate({ _id: user._id }, { 
                        $set: { 
                            'subscription.type': 'FREE', 
                            stripeSessionId: '', 
                            stripeSubscriptionId: '',
                            'subscription.credits': 50,
                            'subscription.price': 0
                        }
                    }, { new: true });
                    return res.status(200).json({
                        user: updatedUser
                    });
                }

                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                if(subscription) {
                    await UserSchema.findOneAndUpdate({ _id: user._id }, { 
                        $set: { stripeSubscriptionId: subscriptionId }
                    }, { new: true });
                    return res.json({ status: subscription.status });
                }
            } else {
                const updatedUser = await UserSchema.findOneAndUpdate({ _id: user._id }, { 
                    $set: { 
                        'subscription.type': 'FREE', 
                        stripeSessionId: '', 
                        stripeSubscriptionId: '',
                        'subscription.credits': 50,
                        'subscription.price': 0
                    }
                }, { new: true });
                return res.status(200).json({
                    user: updatedUser
                });
            }
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Cancel custom subscription
SubscribeStripeCustomRoute.post('/cancel', async (req, res) => {
    try {
        const { subscriptionId, userId } = req.body;

        // Cancel the subscription in Stripe
        await stripe.subscriptions.cancel(subscriptionId);

        // Update user in database
        await UserSchema.findOneAndUpdate({ _id: userId }, { 
            $set: { 
                'subscription.type': 'FREE',
                stripeSubscriptionId: '',
                'subscription.credits': 50,
                'subscription.price': 0
            }
        }, { new: true });

        return res.json({ success: true, message: 'Subscription canceled successfully' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint to handle Stripe events
SubscribeStripeCustomRoute.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutSessionCompleted(session);
            break;
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            await handleInvoicePaymentSucceeded(invoice);
            break;
        case 'customer.subscription.updated':
            const subscription = event.data.object;
            await handleSubscriptionUpdated(subscription);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
});

// Helper function to handle successful checkout sessions
async function handleCheckoutSessionCompleted(session) {
    try {
        const { userId, credits, planType, tier } = session.metadata;
        
        // Determine tier based on credits if not provided
        let subscriptionTier = tier;
        if (!subscriptionTier && credits) {
            const creditsNum = parseInt(credits);
            if (creditsNum <= 50) {
                subscriptionTier = 'FREE';
            } else if (creditsNum <= 500) {
                subscriptionTier = 'STARTER';
            } else if (creditsNum <= 5000) {
                subscriptionTier = 'GROWTH';
            } else if (creditsNum <= 50000) {
                subscriptionTier = 'SCALE';
            } else if (creditsNum <= 100000) {
                subscriptionTier = 'SMALL_BUSINESS';
            } else if (creditsNum <= 500000) {
                subscriptionTier = 'MEDIUM_BUSINESS';
            } else {
                subscriptionTier = 'ENTERPRISE';
            }
        }
        
        // Get the full subscription details from Stripe
        let stripeSubscription = null;
        if (session.subscription) {
            stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
        }
        
        if (userId === 'pending') {
            // Create a new user account if one doesn't exist
            const customerEmail = session.customer_details?.email;
            if (customerEmail) {
                // Check if user already exists
                let user = await UserSchema.findOne({ email: customerEmail });
                
                if (!user) {
                    // Create new user with temporary password
                    const tempPassword = Math.random().toString(36).slice(-8);
                    user = new UserSchema({
                        name: session.customer_details?.name || 'User',
                        email: customerEmail,
                        password: tempPassword, // User will need to reset password
                        subscription: {
                            type: subscriptionTier || 'CUSTOM',
                            status: stripeSubscription?.status || 'active',
                            credits: parseInt(credits),
                            price: session.amount_total / 100,
                            stripeSubscriptionId: session.subscription,
                            currentPeriodStart: stripeSubscription?.current_period_start ? new Date(stripeSubscription.current_period_start * 1000).toISOString() : null,
                            currentPeriodEnd: stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000).toISOString() : null,
                            cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
                            canceledAt: stripeSubscription?.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
                            trialStart: stripeSubscription?.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
                            trialEnd: stripeSubscription?.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
                            metadata: {
                                planType: subscriptionTier || 'CUSTOM',
                                credits: credits,
                                originalPrice: session.amount_total / 100,
                                tier: subscriptionTier
                            }
                        },
                        stripeSessionId: session.id,
                        stripeSubscriptionId: session.subscription,
                        stripeCustomerId: session.customer,
                        subscriptionStartDate: new Date().toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                        }),
                        nextPaymentDate: stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                        }) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                        })
                    });
                    await user.save();
                } else {
                    // Update existing user
                    await UserSchema.findOneAndUpdate(
                        { email: customerEmail },
                        {
                            $set: {
                                'subscription.type': 'CUSTOM',
                                'subscription.status': stripeSubscription?.status || 'active',
                                'subscription.credits': parseInt(credits),
                                'subscription.price': session.amount_total / 100,
                                'subscription.stripeSubscriptionId': session.subscription,
                                'subscription.currentPeriodStart': stripeSubscription?.current_period_start ? new Date(stripeSubscription.current_period_start * 1000).toISOString() : null,
                                'subscription.currentPeriodEnd': stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000).toISOString() : null,
                                'subscription.cancelAtPeriodEnd': stripeSubscription?.cancel_at_period_end || false,
                                'subscription.canceledAt': stripeSubscription?.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
                                'subscription.trialStart': stripeSubscription?.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
                                'subscription.trialEnd': stripeSubscription?.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
                                'subscription.metadata': {
                                    planType: planType,
                                    credits: credits,
                                    originalPrice: session.amount_total / 100
                                },
                                stripeSessionId: session.id,
                                stripeSubscriptionId: session.subscription,
                                stripeCustomerId: session.customer
                            }
                        }
                    );
                }
            }
        } else if (userId && userId !== 'pending') {
            // Update existing user
            await UserSchema.findOneAndUpdate(
                { _id: userId },
                {
                    $set: {
                        'subscription.type': 'CUSTOM',
                        'subscription.status': stripeSubscription?.status || 'active',
                        'subscription.credits': parseInt(credits),
                        'subscription.price': session.amount_total / 100,
                        'subscription.stripeSubscriptionId': session.subscription,
                        'subscription.currentPeriodStart': stripeSubscription?.current_period_start ? new Date(stripeSubscription.current_period_start * 1000).toISOString() : null,
                        'subscription.currentPeriodEnd': stripeSubscription?.current_period_end ? new Date(stripeSubscription.current_period_end * 1000).toISOString() : null,
                        'subscription.cancelAtPeriodEnd': stripeSubscription?.cancel_at_period_end || false,
                        'subscription.canceledAt': stripeSubscription?.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
                        'subscription.trialStart': stripeSubscription?.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
                        'subscription.trialEnd': stripeSubscription?.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
                        'subscription.metadata': {
                            planType: planType,
                            credits: credits,
                            originalPrice: session.amount_total / 100
                        },
                        stripeSessionId: session.id,
                        stripeSubscriptionId: session.subscription,
                        stripeCustomerId: session.customer
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error handling checkout session completed:', error);
    }
}

// Helper function to handle successful invoice payments
async function handleInvoicePaymentSucceeded(invoice) {
    try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (customer.email) {
            await UserSchema.findOneAndUpdate(
                { email: customer.email },
                {
                    $set: {
                        'subscription.status': subscription.status,
                        'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000).toISOString(),
                        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
                        'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end || false,
                        'subscription.canceledAt': subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
                        nextPaymentDate: new Date(invoice.period_end * 1000).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                        })
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error handling invoice payment succeeded:', error);
    }
}

// Helper function to handle subscription updates
async function handleSubscriptionUpdated(subscription) {
    try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        
        if (customer.email) {
            await UserSchema.findOneAndUpdate(
                { email: customer.email },
                {
                    $set: {
                        stripeSubscriptionId: subscription.id,
                        'subscription.type': subscription.status === 'active' ? 'CUSTOM' : 'FREE',
                        'subscription.status': subscription.status,
                        'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000).toISOString(),
                        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
                        'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end || false,
                        'subscription.canceledAt': subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
                        'subscription.trialStart': subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
                        'subscription.trialEnd': subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error handling subscription updated:', error);
    }
}

export default SubscribeStripeCustomRoute;
