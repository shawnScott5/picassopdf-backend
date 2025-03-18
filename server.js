import express from 'express';
import UserRoute from './users/UserRoute.js';
import InfluencersRoute from './influencers/InfluencersRoute.js';
import ListsRoute from './lists/ListsRoute.js';
import TasksRoute from './tasks/TasksRoute.js';
import AdminRoute from './admin/AdminRoute.js';
import bodyParser from 'body-parser';
import UploadsRoute from './uploads/UploadsRoute.js';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './config/config.js';
import db from './config/db.js';
import ActionsRoute from './actions/ActionsRoute.js';
import CampaingsRoute from './campaigns/CampaignsRoutes.js';
import NotesRoute from './notes/NotesRoute.js';
import helmet from 'helmet';
import fileupload from 'express-fileupload';
import EventsRoute from './events/EventsRoutes.js';
import SubscribeRoute from './subscribe/SubscribeRoute.js';
import path from 'path';
import url from 'url';
import SubscribeStripeScaleRoute from './subscribe-stripe-scale/SubscribeStripeScaleRoute.js';
import SubscribeStripeRoute from './subscribe-stripe/SubscribeStripeRoute.js';

const app = express();
const allowedOrigins = ['https://app.distros.io'];
const PORT = process.env.PORT || 3000;

// Get the directory name of the current module
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Enable proxy to correctly handle HTTPS redirection in Heroku
app.enable('trust proxy');

// Middleware to force HTTPS in production (for Heroku)
app.use((req, res, next) => {
    if (req.secure) {
        return next();  // Continue if the request is already HTTPS
    } else {
        res.redirect('https://' + req.headers.host + req.url);  // Redirect to HTTPS
    }
});

// Middleware
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));
app.use(fileupload({useTempFiles: true}))
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true  // Allows sending cookies or authentication headers if needed
}));
app.use(bodyParser.json());
app.use('/api/actions', ActionsRoute);
app.use('/api/admin', AdminRoute);
app.use('/api/campaigns', CampaingsRoute);
app.use('/api/users', UserRoute);
app.use('/api/influencers', InfluencersRoute);
app.use('/api/lists', ListsRoute);
app.use('/api/events', EventsRoute);
app.use('/api/tasks', TasksRoute);
app.use('/api/notes', NotesRoute);
app.use('/api/uploads', UploadsRoute);
app.use('/api/subscribe', SubscribeRoute);
app.use('/api/subscribe-stripe-pro', SubscribeStripeRoute);
app.use('/api/subscribe-stripe-scale', SubscribeStripeScaleRoute);

// Serve static files from Angular's `dist` folder
app.use(express.static(path.join(__dirname, '..', 'distros-frontend', 'dist', 'distros-frontend')));

// Handle all other routes by redirecting to `index.html`
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'distros-frontend', 'dist', 'distros-frontend', 'index.html'));
});

// Connect to the database
db();

// Start the server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));