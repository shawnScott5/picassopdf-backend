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

// Middleware
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));
app.use(fileupload({useTempFiles: true}))
app.use(cors());
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
app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});