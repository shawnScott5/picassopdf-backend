import express from 'express';
import { myCampaigns, updateCampaign, deleteCampaign, createCampaign } from './CampaignsController.js';

const CampaingsRoute = express.Router();

CampaingsRoute.get('/', myCampaigns);
CampaingsRoute.post('/create-campaign', createCampaign);
CampaingsRoute.patch('/update-campaign', updateCampaign);
CampaingsRoute.delete('/delete-campaign', deleteCampaign);

export default CampaingsRoute;