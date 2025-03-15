import express from 'express';
import { subscriptionPlans } from './SubscribeController.js';

const SubscribeRoute = express.Router();

SubscribeRoute.get('/', subscriptionPlans);

export default SubscribeRoute;