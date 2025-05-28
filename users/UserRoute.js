import express from 'express';
import { login, register, me, forgotPassword, resetPassword, updateRevenue, updateAvatar, updateViewCount, resetViewCount, fetchMyMatches } from './UserController.js';
import authenticate from '../middlewares/authenticate.js'
  
const UserRoute = express.Router();
UserRoute.get('/', fetchMyMatches);
UserRoute.get('/me', authenticate, me);
UserRoute.post('/register', register);
UserRoute.post('/login', login);
UserRoute.post('/forgot-password', forgotPassword);
UserRoute.post('/reset-password', resetPassword);
UserRoute.patch('/update-revenue', updateRevenue);
UserRoute.patch('/update-avatar', updateAvatar);
UserRoute.patch('/update-view-count', updateViewCount);
UserRoute.patch('/reset-view-count', resetViewCount);

export default UserRoute;
