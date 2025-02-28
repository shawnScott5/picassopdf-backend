import express from 'express';
import { updateInfluencersInDB, addInfluencersToDB, testImportFile } from './AdminController.js';

const AdminRoute = express.Router();

AdminRoute.put('/update-influencers-in-db', updateInfluencersInDB);
AdminRoute.put('/add-influencers-to-db', addInfluencersToDB);
AdminRoute.post('/test-import-file', testImportFile);

export default AdminRoute;