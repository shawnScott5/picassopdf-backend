import express from 'express';
import { myEvents, updateEvent, deleteEvent, createEvent } from './EventsController.js';

const EventsRoute = express.Router();

EventsRoute.get('/', myEvents);
EventsRoute.post('/create-event', createEvent);
EventsRoute.patch('/update-event', updateEvent);
EventsRoute.delete('/delete-event', deleteEvent);

export default EventsRoute;