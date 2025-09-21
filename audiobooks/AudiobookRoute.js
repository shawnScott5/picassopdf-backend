import express from 'express';
import { AudiobookController } from './AudiobookController.js';
import authenticate from '../middlewares/authenticate.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Upload a new book
router.post('/upload', AudiobookController.uploadBook);

// Get all audiobooks for the authenticated user
router.get('/', AudiobookController.getUserAudiobooks);

// Get specific audiobook details
router.get('/:id', AudiobookController.getAudiobook);

// Update audiobook settings
router.put('/:id/settings', AudiobookController.updateAudiobookSettings);

// Start audio generation
router.post('/:id/generate', AudiobookController.startAudioGeneration);

// Download final audiobook
router.get('/:id/download', AudiobookController.downloadAudiobook);

// Delete audiobook
router.delete('/:id', AudiobookController.deleteAudiobook);

export default router;

