import express from 'express';
import { subscriptionPlans, subscribeToPro, subscribeToScale } from './SubscribeController.js';

const SubscribeRoute = express.Router();

SubscribeRoute.get('/', subscriptionPlans);
SubscribeRoute.post('/pro', subscribeToPro);
SubscribeRoute.post('/scale', subscribeToScale);

export default SubscribeRoute;