import config from '../config/config.js';
import jwt from 'jsonwebtoken';
import UserSchema from '../users/UserSchema.js';

const { verify } = jwt;

const authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];

    if(!token) {
        return res.status(401).json({ message: 'Authorization token is required'})
    }

    try {
        const parsedText = token.split(' ')[1];
        const decoded = verify(parsedText, config.jwtSecret);
        const request = req;
        request.userId = decoded.sub;

        // Fetch the full user object to get companyId
        const user = await UserSchema.findById(decoded.sub).select('companyId email name role');
        if (user) {
            request.user = user;
            request.companyId = user.companyId;
        }

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized'})
    }
}

export default authenticate;