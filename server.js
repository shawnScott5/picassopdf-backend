import express from 'express';
import UserRoute from './users/UserRoute.js';
import InfluencersRoute from './influencers/InfluencersRoute.js'
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

const app = express();
const allowedOrigins = ['https://app.distros.io'];
const PORT = process.env.PORT || 3000;

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

db();

// Start the server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));