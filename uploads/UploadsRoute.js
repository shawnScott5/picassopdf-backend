import express from 'express';
import { uploadImage } from './UploadsRouteController.js';

const UploadsRoute = express.Router();

UploadsRoute.get('/image', uploadImage);

export default UploadsRoute;  