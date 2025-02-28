import express from 'express';
import { fetchAllInfluencers, hideInfluencer, unhideInfluencer } from './InfluencersController.js';

const InfluencersRoute = express.Router();

InfluencersRoute.get('/', fetchAllInfluencers);
InfluencersRoute.patch('/unhide', unhideInfluencer);
InfluencersRoute.patch('/hide', hideInfluencer);

export default InfluencersRoute;