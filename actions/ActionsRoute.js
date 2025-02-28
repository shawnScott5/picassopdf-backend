import express from 'express';
import { getMyNotes, createNewNote, deleteNote, updateNote } from './ActionsController.js';

const ActionsRoute = express.Router();

ActionsRoute.get('/', getMyNotes);
ActionsRoute.post('/create-note', createNewNote);
ActionsRoute.post('/delete-note', deleteNote);
ActionsRoute.patch('/update-note', updateNote);

export default ActionsRoute;  