import express from 'express';
import { myEvents, updateEvent, deleteEvent, createEvent, completeEvent, incompleteEvent } from './EventsController.js';

const EventsRoute = express.Router();

EventsRoute.get('/', myEvents);
EventsRoute.post('/create-event', createEvent);
EventsRoute.patch('/update-event', updateEvent);
EventsRoute.patch('/complete-event', completeEvent);
EventsRoute.patch('/incomplete-event', incompleteEvent);
EventsRoute.delete('/delete-event', deleteEvent);

export default EventsRoute;