import express from 'express';
import { createNewNote, getMyNotes, deleteNote, updateNote } from './NotesController.js';

const NotesRoute = express.Router();

NotesRoute.get('/', getMyNotes);
NotesRoute.post('/create-note', createNewNote);
NotesRoute.delete('/delete-note', deleteNote);
NotesRoute.put('/update-note', updateNote);

export default NotesRoute;  