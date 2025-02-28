import config from '../config/config.js';
import jwt from 'jsonwebtoken';

const { verify } = jwt;

const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];

    if(!token) {
        return res.status(401).json({ message: 'Authorization token is required'})
    }

    try {
        const parsedText = token.split(' ')[1];
        const decoded = verify(parsedText, config.jwtSecret);
        const request = req;
        request.userId = decoded.sub;

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized'})
    }
}

export default authenticate;