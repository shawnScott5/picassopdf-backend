import { config as conf } from 'dotenv';
conf();

const config = {
    port: process.env.PORT,
    mongoUrl: process.env.MONGODB_URI,
    production: process.env.PRODUCTION,
    jwtSecret: process.env.JWT_SECRET
}

export default config;