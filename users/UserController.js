import UserSchema from '../users/UserSchema.js';
import config from '../config/config.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cloudinary from 'cloudinary';
import UserTokenSchema from '../users/UserTokenSchema.js';
import debounce from 'lodash.debounce';
import Stripe from "stripe";
import CampaignsSchema from '../campaigns/CampaignsSchema.js';
import OrganizationSchema from '../organizations/OrganizationSchema.js';
import CompanySchema from '../companies/CompanySchema.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10'
});

//https://www.instagram.com/shawnscottjr/?__a=1 (link to scrape IG profiles)
//Ex: https://api.hunter.io/v2/email-finder?domain=reddit.com&first_name=Alexis&last_name=Ohanian&api_key=e7f1950c4322e75a93bd93deb32aa4647929c13d
const hunterIoApiKey = "e7f1950c4322e75a93bd93deb32aa4647929c13d";
//Configure Cloudinary
cloudinary.config({
    cloud_name: 'dza3ed8yw',
    api_key: '396455137865889',
    api_secret: '1euYrjIo1usGDgk1cI8r76_l6Rw',
});

const { sign } = jwt;
const requestIds = new Set(); // Track processed request IDs

const register = async(req, res, next) => {
        const { 
            name, 
            email, 
            password, 
            subscription, 
            referralCode, 
            fingerprint,
            companyName
        } = req.body;

    if(!name || !email || !password) {
        return res.status(400).json({error: 'All fields are required'});
    }

    // Check if the fingerprint (device) already exists
    const existingDevice = false //await UserSchema.findOne({ fingerprint: fingerprint });
    if (existingDevice) {
        return res.status(403).json({ error: 'Multiple accounts from the same device are not allowed' });
    }
    console.log(req.body)
    const user = await UserSchema.findOne({email: email});
    if(user != null) {
        console.log('BOOM!!!!!!!!!!!!!!!!!!!!!!!!')
        return res.status(400).json({error: 'User already exists'});
    }

    try {
        const today = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const thisMonthName = monthNames[today.getMonth()];
        const lastMonthName = (today.getMonth() + 1) == 1 ? monthNames[11] : monthNames[today.getMonth() -1];
        const hashedPassword = await bcrypt.hash(password, 10);
        const nextPaymentDate = new Date(); // Get current local time
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Add 1 month

        // Create company first if companyName is provided
        let company = null;
        let companyId = null;
        
        if (companyName) {
            try {
                // Create a new company document first
                company = new CompanySchema({
                    name: companyName.trim(),
                    description: `Company: ${companyName}`,
                    contactEmail: email,
                    // We'll update createdBy and lastModifiedBy after user creation
                    members: []
                });

                await company.save();
                companyId = company._id;
            } catch (companyError) {
                console.error('Error creating company:', companyError);
                return res.status(500).json({error: 'Failed to create company'});
            }
        } else {
            // For personal accounts, create a default company or use a placeholder
            // For now, we'll create a personal company
            try {
                company = new CompanySchema({
                    name: `${name}'s Personal Account`,
                    description: `Personal account for ${name}`,
                    contactEmail: email,
                    members: []
                });

                await company.save();
                companyId = company._id;
            } catch (companyError) {
                console.error('Error creating personal company:', companyError);
                return res.status(500).json({error: 'Failed to create personal account'});
            }
        }

        // Now create the user with the companyId
        const newUser = await UserSchema.create({
            name,
            email,
            password: hashedPassword,
            subscription: subscription,
            companyId: companyId, // Set the companyId from the created company
            previousSubscriptionStartDate: new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true, // 12-hour clock with AM/PM
              }),
            subscriptionStartDate: new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true, // 12-hour clock with AM/PM
              }),
            previousPaymentDate: new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true, // 12-hour clock with AM/PM
              }),
            nextPaymentDate: nextPaymentDate.toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true, // 12-hour clock with AM/PM
              }),
            thisMonthName: thisMonthName,
            lastMonthName: lastMonthName,
            referralCode: referralCode,
            influencersEmailViewedCount: 0,
            influencersEmailViewed: [],
            fingerprint: fingerprint,
            // Company field
            companyName: companyName,
            accountType: companyName ? 'company' : 'personal',
            role: 'owner' // Set as owner since they created the company
        });

        // Update the company with the user as owner
        if (company) {
            try {
                await CompanySchema.findByIdAndUpdate(company._id, {
                    createdBy: newUser._id,
                    lastModifiedBy: newUser._id,
                    $push: {
                        members: {
                            userId: newUser._id,
                            role: 'owner',
                            permissions: ['url_to_pdf', 'html_to_pdf', 'file_upload', 'api_access', 'team_management', 'billing_management', 'analytics_view'],
                            joinedAt: new Date(),
                            status: 'active'
                        }
                    }
                });
            } catch (companyUpdateError) {
                console.error('Error updating company with user:', companyUpdateError);
                // Continue even if company update fails
            }
        }

        return res.status(201).json({
            status: true,
            message: 'User created',
            data: {
                _id: newUser._id,
                email: newUser.email,
                accountType: newUser.accountType,
                company: company ? {
                    _id: company._id,
                    name: company.name
                } : null
            }
        });
    } catch (error) {
        console.log('ERROR:', error)
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const login = async(req, res, next) => {
    const { email, password } = req.body;
    
    if(!email || !password) {
        return res.status(400).json({error: 'All fields are required'});
    }

    const user = await UserSchema.findOne({email: email});
    if(!user) {
        return res.status(400).json({error: 'User not found'});
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if(!isPasswordMatch) {
        return res.status(400).json({error: 'Incorrect password'});
    }

    try {
        const token = sign({sub: user._id}, config.jwtSecret, {
            expiresIn: '1d'
        });

        return res.status(200).json({
            status: true,
            message: 'Logged in successfully!',
            data: {
                _id: user._id,
                email: user.email,
                name: user.name,
                token
            }
        });
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const me = async(req, res, next) => {
    const request = req;
    const user = await UserSchema.findById({_id: request.userId});
    
    if(user) {
        // This block only triggers after a user backs out of stripe subscription page (this is a bug workout)
        if(user.subscription.type != 'FREE') {
            if(user.stripeSessionId) {
                const session = await stripe.checkout.sessions.retrieve(user.stripeSessionId);
        
                // Extract subscription ID from the session
                const subscriptionId = session.subscription;
        
                if (!subscriptionId) {
                  if(user.stripeSubscriptionId) {
                    const subscriptionType = user.subscription.type == 'PRO' ? 'SCALE' : 'PRO';
                    await UserSchema.findOneAndUpdate({ _id: user._id }, { $set: { stripeSessionId: '', 'subscription.type': subscriptionType, nextPaymentDate: user.previousPaymentDate, subscriptionStartDate: user.previousSubscriptionStartDate }}, { new: true });
                  } else {
                    await UserSchema.findOneAndUpdate({ _id: user._id }, { $set: { 'subscription.type': 'FREE', stripeSessionId: '', stripeSubscriptionId: '', nextPaymentDate: user.previousPaymentDate, subscriptionStartDate: user.previousSubscriptionStartDate }}, { new: true });
                  }
                } else {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    if(subscription) {
                        await UserSchema.findOneAndUpdate({ _id: user._id }, { $set: { stripeSessionId: '', stripeSubscriptionId: subscriptionId, previousPaymentDate: user.nextPaymentDate, previousSubscriptionStartDate: user.subscriptionStartDate }}, { new: true });
                    }
                }
            }
        }

        //Reset monthly membership data (if applicable)
        const today = new Date().toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true, // 12-hour clock with AM/PM
          });
        const todaysDate = new Date(today);
        const nextPaymentDate = new Date(user.nextPaymentDate);
       
        if(todaysDate.getTime() == nextPaymentDate.getTime() || todaysDate.getTime() > nextPaymentDate.getTime()) {
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            while(todaysDate.getTime() == nextPaymentDate.getTime() || todaysDate.getTime() > nextPaymentDate.getTime()) {
                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            }
            
            if(user.subscription.type != 'FREE') {
                const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
                if(!subscription || subscription?.status != 'active') {
                    await UserSchema.findOneAndUpdate({ _id: user._id }, { $set: { stripeSubscriptionId: '', stripeSessionId: '', 'subscription.type': 'FREE' }}, { new: true });
                }
            }

            await UserSchema.findOneAndUpdate({ _id: user._id }, { 
                $set: { 
                    nextPaymentDate: nextPaymentDate.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true, // 12-hour clock with AM/PM
                      }),
                    influencersEmailViewed: [],
                    influencersEmailViewedCount: 0,
                    tempViewLimit: null
                }}, { new: true });
        }

        const date = new Date();
        const currentMonth = date.getMonth() + 1;
        const currentYear = date.getFullYear();
        const currentDay = date.getDate(); 
        const campaigns = await CampaignsSchema.find({ userId: user._id, compensationDuration: 'One-Time Payment', isPaid: false });
        const currentMonthName = date.toLocaleString('en-US', { month: 'long' });
        
        const lastMonth = new Date();
        lastMonth.setMonth(date.getMonth() - 1);
        const lastMonthName = lastMonth.toLocaleString('en-US', { month: 'long' });

        for (const campaign of campaigns) { 
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);
            
            const isStartTodayOrPast = 
                (startDate.getFullYear() < currentYear) ||
                (startDate.getFullYear() === currentYear && startDate.getMonth() + 1 < currentMonth) ||
                (startDate.getFullYear() === currentYear && startDate.getMonth() + 1 === currentMonth && startDate.getDate() <= currentDay);
            
            const isEndTodayOrPast = 
                (endDate.getFullYear() < currentYear) ||
                (endDate.getFullYear() === currentYear && endDate.getMonth() + 1 < currentMonth) ||
                (endDate.getFullYear() === currentYear && endDate.getMonth() + 1 === currentMonth && endDate.getDate() <= currentDay);
        
            // Add campaign compensation if startDate is today/past and isPaid is false
            if (isStartTodayOrPast && !campaign.isPaid) {
                const updateFields = campaign.compensationDuration === 'Per Month' 
                    ? { $inc: { thisMonthTotalRevenue: campaign.compensation, thisMonthRecurringRevenue: campaign.compensation, thisMonthNewClients: 1, thisMonthTotalClients: 1 } }
                    : { $inc: { thisMonthTotalRevenue: campaign.compensation, thisMonthNewClients: 1 } };
        
                await UserSchema.findByIdAndUpdate(user._id, updateFields, { new: true });
                await CampaignsSchema.findByIdAndUpdate(campaign._id, { isPaid: true }, { new: true });
            } 
            // Deduct campaign compensation if endDate is today/past and isPaid is true
            else if (isEndTodayOrPast && campaign.isPaid) {
                if (campaign.compensationDuration === 'Per Month') {
                    const updateFields = { $inc: { thisMonthTotalRevenue: -campaign.compensation, thisMonthRecurringRevenue: -campaign.compensation, thisMonthTotalClients: -1 } };
                    await UserSchema.findByIdAndUpdate(user._id, updateFields, { new: true });
                }
            }
        }

        if(user.thisMonthName.toLowerCase() != currentMonthName.toLowerCase()) {
            await UserSchema.findByIdAndUpdate(user._id, {
                lastMonthTotalRevenue: user.thisMonthTotalRevenue,
                lastMonthRecurringRevenue: user.thisMonthRecurringRevenue,
                lastMonthTotalClients: user.thisMonthTotalClients,
                lastMonthNewClients: user.thisMonthNewClients,
                thisMonthNewClients: 0,
                thisMonthTotalRevenue: user.thisMonthRecurringRevenue,
                thisMonthName: currentMonthName,
                lastMonthName: lastMonthName
            }, { new: true } );
        }

        //fetch final user object
        const finalUser = await UserSchema.findById({_id: request.userId});
        return res.status(200).json({
            status: true,
            data: {
                _id: finalUser._id,
                email: finalUser.email,
                name: finalUser.name,
                organizationId: finalUser.organizationId,
                companyId: finalUser.companyId,
                companyName: finalUser.companyName,
                accountType: finalUser.accountType,
                role: finalUser.role,
                thisMonthRecurringRevenue: finalUser.thisMonthRecurringRevenue,
                thisMonthTotalRevenue: finalUser.thisMonthTotalRevenue,
                thisMonthTotalClients: finalUser.thisMonthTotalClients,
                thisMonthNewClients: finalUser.thisMonthNewClients,
                subscription: finalUser.subscription,
                subscriptionStartDate: finalUser.subscriptionStartDate,
                influencersEmailViewed: finalUser.influencersEmailViewed,
                influencersEmailViewedCount: finalUser.influencersEmailViewedCount,
                nextPaymentDate: finalUser.nextPaymentDate,
                admin: finalUser.admin,
                avatar: finalUser.avatar,
                stripeSessionId: finalUser.stripeSessionId,
                stripeSubscriptionId: finalUser.stripeSubscriptionId,
                tempViewLimit: finalUser.tempViewLimit,
                lastMonthTotalRevenue: finalUser.lastMonthTotalRevenue,
                lastMonthRecurringRevenue: finalUser.lastMonthRecurringRevenue,
                lastMonthTotalClients: finalUser.lastMonthTotalClients,
                lastMonthNewClients: finalUser.lastMonthNewClients
            }
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const forgotPassword = async(req, res, next) => {
    const { email } = req.body;
    const user = await UserSchema.findOne({ email: { $regex: new RegExp(`^${email}$`, "i")}});

    if(!user) {
        return res.status(404).json({error: 'Email not found'});
    }

    const payload = {
        email: user.email
    }

    const expriredTime = 300;
    const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: expriredTime});
    const newToken = new UserTokenSchema({
        userId: user._id,
        token: token
    });
    
    const mailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'shawnscottjunior@gmail.com',
            pass: 'rcll vbee edce yprn'
        }
    })

    let mailDetails = {
        from: 'shawnscottjunior@gmail.com',
        to: email,
        subject: 'Reset Your Distros Account Password',
        html: `
        <html>
        <head>
            <title>Password Reset Request</title>
        </head>
        <body>
            <h1 style="color: black;">Password Reset Request</h1>
            <p style="color: black;">${user.name},</p>
            <p style="color: black;">We received a request to reset your password for your Distros account. To complete the password reset process, please click the reset button below:</p>
             <a href=${process.env.LIVE_URL}?token=${token}><button style="background-color: #12e19f; color: white; padding: 14px 20px; border: 1px solid #12e19f; cursor: pointer; border-radius: 4px">Reset Password</button></a>
            <p style="color: black;">Please note that this link is only valid for 5mins. If you did not request a password reset, please disregard this message.</p>
            <p style="color: black;">Thank you,</p>
            <p style="color: black;">Distros Team</P>
        </body>
        </html>
        `,
    };
    mailTransporter.sendMail(mailDetails, async(err, data) => {
        if(err) {
            return res.status(500).json({error: 'Something went wrong'});
        } else {
            await newToken.save();
            return res.status(200).json({message: 'Mail sent successfully'});
        }
    });
};

const resetPassword = async(req, res, next) => {
    const token = req.body.token;
    const newPassword = req.body.password;

    jwt.verify(token, process.env.JWT_SECRET, async(err, data) => {
        if(err) {
            return res.status(500).json({error: 'Reset link is expired'});
        } else {
            const response = data;
            const user = await UserSchema.findOne({ email: { $regex: new RegExp(`^${response.email}$`, "i")}});
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            try {
                const updatedUser = await UserSchema.findOneAndUpdate(
                    { _id: user._id },
                    { $set: user },
                    { new: true }
                )
                return res.status(200).json({ message: 'Password Reset Successfully' });
            } catch(err) {
                return res.status(500).json({error: 'Something went wrong'});
            }
        }
    });
};

const updateRevenue = async(req, res, next) => {
    const form = req.body;

    const user = await UserSchema.findOne({_id: form.userId});
    if(user) {
        return res.status(400).json({error: 'User already exists'});
    }

    try {
        
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const updateViewCount = async (req, res) => {
    try {
        const filter = req.body;
        const userUpdated = await UserSchema.findOneAndUpdate(
                    { _id: filter.userId }, 
                    { 
                        $push: { influencersEmailViewed: filter.influencerId },
                        $inc: { influencersEmailViewedCount: 1 } // Increment by 1
                    }, 
                    { new: true }
               );
               
        if(userUpdated) {
            return res.status(200).json({
                message: 'Email view count updated successfully!',
                data: userUpdated
            });
        }
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const resetViewCount = async(req, res, next) => {
    const filter = req.body;
    const date = new Date(filter.user.nextPaymentDate);
    date.setMonth(date.getMonth() + 1); // Add 1 month
    while((new Date().getMonth > date.getMonth()) || (new Date().getMonth == date.getMonth() && new Date().getDate() >= date.getDate())) {
        //keep adding 1 until the next payment date is in the future
        //this edge case will only occur if the user doesnt log onto the app for multiple months (nextPaymentDate needs to catch up)
        date.setMonth(date.getMonth() + 1);
    }

    const newNextPaymentDate = date.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true, // 12-hour clock with AM/PM
      });
    const userUpdated = await UserSchema.findOneAndUpdate(
                { _id: filter.user._id }, 
                { 
                    $set: { influencersEmailViewed: [] },
                    $set: { influencersEmailViewedCount: 0 }, // Increment by 1
                    $set: { nextPaymentDate: newNextPaymentDate },
                    $set: { tempViewLimit: null }
                }, 
                { new: true }
           );
           
    if(userUpdated) {
        return res.status(200).json({message: 'Email view count updated successfully!'});
    }

    try {
        
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const fetchMyMatches = async (req, res) => {
    console.log('FETCHING MY MATCHES!!!!!!!!!!!!!!!!!!!!!!!!!!!')
}

const updateAvatar = async (req, res) => {
    try {
        const form = req.body;
        const user = await UserSchema.findOne({_id: form.userId});

        if(user) {
            const updatedProfile = await UserSchema.updateOne({ _id: form.userId }, { $set: { name: form.name, email: form.email}}, {new: true});
            if(!updatedProfile) {
                return res.status(500).json({ error: "Something went wrong" });
            }

            if(form.avatar && !user.avatar) {
                const updatedAvatar = await UserSchema.updateOne({ _id: form.userId }, { $set: { avatar: form.avatar}}, {new: true});
                if(!updatedAvatar) {
                    return res.status(500).json({ error: "Something went wrong" });
                }
            }

            if(form.password) {
                const hashedPassword = await bcrypt.hash(form.password, 10);
                const updatedProfile = await UserSchema.updateOne({ _id: form.userId }, { $set: { password: hashedPassword}}, {new: true});
                if(!updatedProfile) {
                    return res.status(500).json({ error: "Something went wrong" });
                }
            }

            const finalUser = await UserSchema.findOne({_id: form.userId});
            return res.status(200).json({
                message: 'Profile was updated successfully!',
                data: finalUser 
            });
        }
    } catch (error) {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
  

const inviteUserToCompany = async (req, res, next) => {
    try {
        const { fullName, email, companyName, permissions } = req.body;
        const currentUserId = req.userId; // From auth middleware

        // Validate required fields
        if (!fullName || !email || !companyName) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, and company name are required'
            });
        }

        // Get current user to verify they have company access
        const currentUser = await UserSchema.findById(currentUserId);
        if (!currentUser || !currentUser.companyId) {
            return res.status(403).json({
                success: false,
                message: 'You must be part of a company to invite users'
            });
        }

        // Check if user already exists
        const existingUser = await UserSchema.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Get the organization
        const organization = await OrganizationSchema.findById(currentUser.companyId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Create a temporary password (user will need to reset it)
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create the new user
        const newUser = await UserSchema.create({
            name: fullName,
            email: email,
            password: hashedPassword,
            companyId: currentUser.companyId,
            role: 'member',
            accountType: 'company',
            companyName: companyName,
            subscription: { type: 'FREE' },
            // Set other required fields with defaults
            subscriptionStartDate: new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            }),
            nextPaymentDate: new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            }),
            thisMonthName: new Date().toLocaleDateString('en-US', { month: 'long' }),
            lastMonthName: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long' }),
            influencersEmailViewedCount: 0,
            influencersEmailViewed: [],
            admin: false,
            avatar: '',
            stripeSessionId: '',
            stripeSubscriptionId: '',
            tempViewLimit: 0,
            lastMonthRecurringRevenue: 0,
            lastMonthTotalRevenue: 0,
            lastMonthNewClients: 0,
            lastMonthTotalClients: 0,
            thisMonthRecurringRevenue: 0,
            thisMonthTotalRevenue: 0,
            thisMonthNewClients: 0,
            thisMonthTotalClients: 0
        });

        // Add user to organization members
        organization.members.push({
            userId: newUser._id,
            role: 'member',
            joinedAt: new Date(),
            status: 'active',
            permissions: permissions || ['pdf_conversion', 'html_to_pdf']
        });

        await organization.save();

        // TODO: Send invitation email with temporary password
        // For now, we'll just return success

        return res.status(201).json({
            success: true,
            message: 'User invited successfully',
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                organizationId: newUser.organizationId
            }
        });

    } catch (error) {
        console.error('Error inviting user:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while inviting the user'
        });
    }
};

export { register, login, me, forgotPassword, resetPassword, updateRevenue, updateAvatar, updateViewCount, resetViewCount, fetchMyMatches, inviteUserToCompany };