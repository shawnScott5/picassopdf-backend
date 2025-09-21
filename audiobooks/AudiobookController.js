import Audiobook from './AudiobookSchema.js';
import { extractTextFromFile } from '../services/TextExtractionService.js';
import { processAudioGeneration } from '../services/AudioProcessingService.js';
import { uploadToStorage } from '../services/StorageService.js';
// Redis/BullMQ removed - no longer needed

// Queue functionality removed - processing will be done synchronously

export const AudiobookController = {
    // Upload a new book
    async uploadBook(req, res) {
        try {
            const { title, author, description } = req.body;
            const file = req.files?.book;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Validate file type
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/epub+zip'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ error: 'Invalid file type. Please upload PDF, DOCX, or EPUB files.' });
            }

            // Upload file to storage
            const uploadedFile = await uploadToStorage(file, 'books');

            // Create audiobook record
            const audiobook = new Audiobook({
                title,
                author,
                description,
                originalFile: {
                    filename: file.name,
                    path: uploadedFile.path,
                    size: file.size,
                    mimetype: file.mimetype
                },
                userId: req.user.id,
                status: 'uploaded'
            });

            await audiobook.save();

            // Start text extraction process synchronously
            try {
                const { processTextExtraction } = await import('../services/JobProcessor.js');
                await processTextExtraction({
                    audiobookId: audiobook._id,
                    filePath: uploadedFile.path,
                    fileType: file.mimetype
                });
            } catch (error) {
                console.error('Text extraction failed:', error);
                // Update audiobook status to failed
                audiobook.status = 'failed';
                await audiobook.save();
            }

            res.status(201).json({
                message: 'Book uploaded successfully',
                audiobook: {
                    id: audiobook._id,
                    title: audiobook.title,
                    status: audiobook.status
                }
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Failed to upload book' });
        }
    },

    // Get all audiobooks for a user
    async getUserAudiobooks(req, res) {
        try {
            const audiobooks = await Audiobook.find({ userId: req.user.id })
                .select('title author status processingProgress createdAt')
                .sort({ createdAt: -1 });

            res.json(audiobooks);
        } catch (error) {
            console.error('Get audiobooks error:', error);
            res.status(500).json({ error: 'Failed to fetch audiobooks' });
        }
    },

    // Get specific audiobook details
    async getAudiobook(req, res) {
        try {
            const { id } = req.params;
            const audiobook = await Audiobook.findOne({ 
                _id: id, 
                userId: req.user.id 
            });

            if (!audiobook) {
                return res.status(404).json({ error: 'Audiobook not found' });
            }

            res.json(audiobook);
        } catch (error) {
            console.error('Get audiobook error:', error);
            res.status(500).json({ error: 'Failed to fetch audiobook' });
        }
    },

    // Update audiobook settings (voice, audio quality, etc.)
    async updateAudiobookSettings(req, res) {
        try {
            const { id } = req.params;
            const { voiceSettings, audioSettings } = req.body;

            const audiobook = await Audiobook.findOneAndUpdate(
                { _id: id, userId: req.user.id },
                { 
                    voiceSettings: voiceSettings || {},
                    audioSettings: audioSettings || {},
                    updatedAt: Date.now()
                },
                { new: true }
            );

            if (!audiobook) {
                return res.status(404).json({ error: 'Audiobook not found' });
            }

            res.json(audiobook);
        } catch (error) {
            console.error('Update settings error:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    },

    // Start audio generation process
    async startAudioGeneration(req, res) {
        try {
            const { id } = req.params;
            const audiobook = await Audiobook.findOne({ 
                _id: id, 
                userId: req.user.id 
            });

            if (!audiobook) {
                return res.status(404).json({ error: 'Audiobook not found' });
            }

            if (audiobook.status !== 'editing') {
                return res.status(400).json({ error: 'Audiobook must be in editing status to start generation' });
            }

            // Update status to processing
            audiobook.status = 'processing';
            audiobook.processingProgress = 0;
            await audiobook.save();

            // Start audio generation process synchronously
            try {
                const { processAudioGenerationJob } = await import('../services/JobProcessor.js');
                await processAudioGenerationJob({
                    audiobookId: audiobook._id,
                    voiceSettings: audiobook.voiceSettings,
                    audioSettings: audiobook.audioSettings
                });
            } catch (error) {
                console.error('Audio generation failed:', error);
                // Update audiobook status to failed
                audiobook.status = 'failed';
                await audiobook.save();
            }

            res.json({ 
                message: 'Audio generation started',
                status: audiobook.status 
            });

        } catch (error) {
            console.error('Start generation error:', error);
            res.status(500).json({ error: 'Failed to start audio generation' });
        }
    },

    // Download final audiobook
    async downloadAudiobook(req, res) {
        try {
            const { id } = req.params;
            const audiobook = await Audiobook.findOne({ 
                _id: id, 
                userId: req.user.id 
            });

            if (!audiobook) {
                return res.status(404).json({ error: 'Audiobook not found' });
            }

            if (audiobook.status !== 'completed') {
                return res.status(400).json({ error: 'Audiobook is not ready for download' });
            }

            if (!audiobook.finalAudioFile?.path) {
                return res.status(404).json({ error: 'Audio file not found' });
            }

            // Stream the file for download
            res.download(audiobook.finalAudioFile.path, `${audiobook.title}.${audiobook.audioSettings.format}`);

        } catch (error) {
            console.error('Download error:', error);
            res.status(500).json({ error: 'Failed to download audiobook' });
        }
    },

    // Delete audiobook
    async deleteAudiobook(req, res) {
        try {
            const { id } = req.params;
            const audiobook = await Audiobook.findOneAndDelete({ 
                _id: id, 
                userId: req.user.id 
            });

            if (!audiobook) {
                return res.status(404).json({ error: 'Audiobook not found' });
            }

            // TODO: Clean up associated files from storage

            res.json({ message: 'Audiobook deleted successfully' });

        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ error: 'Failed to delete audiobook' });
        }
    }
};

