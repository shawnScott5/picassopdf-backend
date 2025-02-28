import UserSchema from '../users/UserSchema.js';
import config from '../config/config.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cloudinary from 'cloudinary';
import UserTokenSchema from '../users/UserTokenSchema.js';
import debounce from 'lodash.debounce';

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
    const { name, email, password, subscription, referralCode } = req.body;

    if(!name || !email || !password) {
        return res.status(400).json({error: 'All fields are required'});
    }

    const user = await UserSchema.findOne({email: email});
    if(user != null) {
        return res.status(400).json({error: 'User already exists'});
    }

    try {
        const today = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const thisMonthName = monthNames[today.getMonth()];
        const lastMonthName = (today.getMonth() + 1) == 1 ? monthNames[11] : monthNames[today.getMonth() -1];
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date(); // Get current local time
        now.setMonth(now.getMonth() + 1); // Add 1 month
        const newUser  = await UserSchema.create({
            name,
            email,
            password: hashedPassword,
            subscription: subscription,
            subscriptionStartDate: new Date().toLocaleString(),
            nextPaymentDate: now.toLocaleString(),
            thisMonthName: thisMonthName,
            lastMonthName: lastMonthName,
            referralCode: referralCode,
            influencersEmailViewedCount: 0,
            influencersEmailViewed: []
        });
        return res.status(201).json({
            status: true,
            message: 'User created',
            data: {
                _id: newUser._id,
                email: newUser.email
            }
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const login = async(req, res, next) => {
    const { email, password } = req.body;
    
    if(!email || !password) {
        return res.status(400).json({error: 'All fields are required'});
    }

    console.log(req)
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
        return res.status(200).json({
            status: true,
            data: {
                _id: user._id,
                email: user.email,
                name: user.name,
                recurringRevenue: user.recurringRevenue,
                thisMonthRevenue: user.thisMonthRevenue,
                totalClients: user.totalClients,
                newClients: user.newClients,
                subscription: user.subscription,
                subscriptionStartDate: user.subscriptionStartDate,
                influencersEmailViewed: user.influencersEmailViewed,
                influencersEmailViewedCount: user.influencersEmailViewedCount,
                nextPaymentDate: user.nextPaymentDate,
                admin: user.admin,
                avatar: user.avatar
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
            <a href=${process.env.LIVE_URL}/reset-password/${token}><button style="background-color: #12e19f; color: white; padding: 14px 20px; border: 1px solid #12e19f; cursor: pointer; border-radius: 4px">Reset Password</button></a>
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
        console.log(error)
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

    const newNextPaymentDate = date.toLocaleDateString();
    const userUpdated = await UserSchema.findOneAndUpdate(
                { _id: filter.user._id }, 
                { 
                    $set: { influencersEmailViewed: [] },
                    $set: { influencersEmailViewedCount: 0 }, // Increment by 1
                    $set: { nextPaymentDate: newNextPaymentDate }
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

const updateAvatar = async (req, res) => {
    try {
        const form = req.body;
        const user = await UserSchema.findOne({_id: form.userId});

        if(user) {
            await UserSchema.updateOne({ _id: form.userId }, { $set: { avatar: form.avatar}}, {new: true});
        }
    } catch (error) {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
  

export { register, login, me, forgotPassword, resetPassword, updateRevenue, updateAvatar, updateViewCount, resetViewCount };