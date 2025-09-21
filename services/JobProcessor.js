// Redis/BullMQ removed - no longer needed
import { extractTextFromFile } from './TextExtractionService.js';
import { processAudioGeneration } from './AudioProcessingService.js';
import Audiobook from '../audiobooks/AudiobookSchema.js';

// Process text extraction synchronously
async function processTextExtraction(data) {
    const { audiobookId, filePath, fileType } = data;
    
    try {
        // Update audiobook status
        const audiobook = await Audiobook.findById(audiobookId);
        if (!audiobook) {
            throw new Error('Audiobook not found');
        }

        audiobook.status = 'extracting';
        await audiobook.save();

        // Extract text from file
        const extractionResult = await extractTextFromFile(filePath, fileType);
        
        // Update audiobook with extracted text and chapters
        audiobook.extractedText = extractionResult.fullText;
        audiobook.chapters = extractionResult.chapters.map(chapter => ({
            title: chapter.title,
            content: chapter.content,
            status: 'pending',
            processingProgress: 0
        }));
        audiobook.status = 'editing';
        await audiobook.save();

        console.log(`Text extraction completed for audiobook: ${audiobookId}`);

    } catch (error) {
        console.error('Text extraction error:', error);
        
        // Update audiobook status to failed
        const audiobook = await Audiobook.findById(audiobookId);
        if (audiobook) {
            audiobook.status = 'failed';
            await audiobook.save();
        }
        
        throw error;
    }
}

// Process audio generation synchronously
async function processAudioGenerationJob(data) {
    const { audiobookId, voiceSettings, audioSettings } = data;
    
    try {
        // Update audiobook status
        const audiobook = await Audiobook.findById(audiobookId);
        if (!audiobook) {
            throw new Error('Audiobook not found');
        }

        audiobook.status = 'generating_audio';
        await audiobook.save();

        // Generate audio
        const audioResult = await processAudioGeneration(audiobookId, voiceSettings, audioSettings);
        
        // Update audiobook with audio data
        audiobook.audioData = audioResult;
        audiobook.status = 'completed';
        await audiobook.save();

        console.log(`Audio generation completed for audiobook: ${audiobookId}`);

    } catch (error) {
        console.error('Audio generation error:', error);
        
        // Update audiobook status to failed
        const audiobook = await Audiobook.findById(audiobookId);
        if (audiobook) {
            audiobook.status = 'failed';
            await audiobook.save();
        }
        
        throw error;
    }
}

// Export functions for direct use (no queue needed)
export { 
    processTextExtraction, 
    processAudioGenerationJob 
};