import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';
import Audiobook from '../audiobooks/AudiobookSchema.js';
import { uploadToStorage } from './StorageService.js';

// Install FFmpeg if not available
try {
    import('@ffmpeg-installer/ffmpeg');
} catch (error) {
    console.warn('FFmpeg not installed, audio processing may not work correctly');
}

export const AudioProcessingService = {
    async processAudioGeneration(audiobookId, voiceSettings, audioSettings) {
        try {
            const audiobook = await Audiobook.findById(audiobookId);
            if (!audiobook) {
                throw new Error('Audiobook not found');
            }

            // Update status to processing
            audiobook.status = 'processing';
            audiobook.processingProgress = 0;
            await audiobook.save();

            const totalChapters = audiobook.chapters.length;
            let completedChapters = 0;

            // Process each chapter
            for (let i = 0; i < audiobook.chapters.length; i++) {
                const chapter = audiobook.chapters[i];
                
                // Update chapter status
                chapter.status = 'processing';
                await audiobook.save();

                try {
                    // Generate audio for this chapter
                    const audioFile = await this.generateChapterAudio(
                        chapter.content,
                        voiceSettings,
                        audioSettings,
                        `${audiobook.title}_chapter_${i + 1}`
                    );

                    // Update chapter with audio file
                    chapter.audioFile = audioFile;
                    chapter.status = 'completed';
                    chapter.processingProgress = 100;

                    completedChapters++;
                    audiobook.processingProgress = Math.round((completedChapters / totalChapters) * 100);

                    await audiobook.save();

                } catch (error) {
                    console.error(`Error processing chapter ${i + 1}:`, error);
                    chapter.status = 'failed';
                    await audiobook.save();
                }
            }

            // Merge all chapters into final audiobook
            if (completedChapters > 0) {
                const finalAudioFile = await this.mergeChapters(audiobook);
                
                audiobook.finalAudioFile = {
                    path: finalAudioFile,
                    size: fs.statSync(finalAudioFile).size,
                    duration: await this.getAudioDuration(finalAudioFile)
                };
            }

            audiobook.status = 'completed';
            audiobook.processingProgress = 100;
            await audiobook.save();

            return audiobook;

        } catch (error) {
            console.error('Audio processing error:', error);
            
            // Update audiobook status to failed
            const audiobook = await Audiobook.findById(audiobookId);
            if (audiobook) {
                audiobook.status = 'failed';
                await audiobook.save();
            }
            
            throw error;
        }
    },

    async generateChapterAudio(text, voiceSettings, audioSettings, filename) {
        try {
            // Split text into smaller chunks for processing
            const chunks = this.splitTextIntoChunks(text, 500); // 500 characters per chunk
            const audioChunks = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkFilename = `${filename}_chunk_${i}`;
                
                // Generate audio for this chunk using Coqui TTS
                const audioChunk = await this.generateTTSAudio(chunk, voiceSettings, audioSettings, chunkFilename);
                audioChunks.push(audioChunk);
            }

            // Merge chunks into single chapter audio
            const chapterAudioFile = await this.mergeAudioChunks(audioChunks, filename);
            
            return chapterAudioFile;

        } catch (error) {
            console.error('Chapter audio generation error:', error);
            throw error;
        }
    },

    async generateTTSAudio(text, voiceSettings, audioSettings, filename) {
        return new Promise((resolve, reject) => {
            try {
                // Use Coqui TTS for text-to-speech
                // This is a simplified implementation - you'll need to install and configure Coqui TTS
                const outputPath = path.join(process.cwd(), 'temp', `${filename}.wav`);
                
                // Ensure temp directory exists
                const tempDir = path.dirname(outputPath);
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // For now, we'll use a placeholder implementation
                // In production, you'd integrate with Coqui TTS API or local installation
                this.generatePlaceholderAudio(text, outputPath, voiceSettings, audioSettings)
                    .then(() => resolve(outputPath))
                    .catch(reject);

            } catch (error) {
                reject(error);
            }
        });
    },

    async generatePlaceholderAudio(text, outputPath, voiceSettings, audioSettings) {
        // This is a placeholder implementation
        // In production, replace this with actual Coqui TTS integration
        
        return new Promise((resolve, reject) => {
            // Create a simple sine wave as placeholder audio
            const sampleRate = audioSettings.sampleRate || 22050;
            const duration = Math.max(text.length * 0.1, 1); // Rough estimate: 0.1 seconds per character
            const samples = Math.floor(sampleRate * duration);
            
            // Generate a simple audio file (this is just a placeholder)
            const audioData = Buffer.alloc(samples * 2); // 16-bit audio
            
            for (let i = 0; i < samples; i++) {
                const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3; // 440Hz tone
                const intSample = Math.floor(sample * 32767);
                audioData.writeInt16LE(intSample, i * 2);
            }

            // Write WAV header
            const wavHeader = this.createWAVHeader(samples, sampleRate);
            const fullAudioData = Buffer.concat([wavHeader, audioData]);
            
            fs.writeFileSync(outputPath, fullAudioData);
            resolve();
        });
    },

    createWAVHeader(samples, sampleRate) {
        const buffer = Buffer.alloc(44);
        
        // RIFF header
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + samples * 2, 4);
        buffer.write('WAVE', 8);
        
        // fmt chunk
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // mono
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
        buffer.writeUInt16LE(2, 32); // block align
        buffer.writeUInt16LE(16, 34); // bits per sample
        
        // data chunk
        buffer.write('data', 36);
        buffer.writeUInt32LE(samples * 2, 40);
        
        return buffer;
    },

    splitTextIntoChunks(text, maxChunkSize) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    },

    async mergeAudioChunks(chunkFiles, filename) {
        return new Promise((resolve, reject) => {
            const outputPath = path.join(process.cwd(), 'temp', `${filename}_merged.wav`);
            
            if (chunkFiles.length === 1) {
                // If only one chunk, just copy it
                fs.copyFileSync(chunkFiles[0], outputPath);
                resolve(outputPath);
                return;
            }

            // Use FFmpeg to concatenate audio files
            const inputFiles = chunkFiles.map(file => `file '${file}'`).join('\n');
            const concatFile = path.join(process.cwd(), 'temp', 'concat.txt');
            
            fs.writeFileSync(concatFile, inputFiles);

            ffmpeg()
                .input(concatFile)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .output(outputPath)
                .on('end', () => {
                    // Clean up chunk files
                    chunkFiles.forEach(file => {
                        if (fs.existsSync(file)) {
                            fs.unlinkSync(file);
                        }
                    });
                    if (fs.existsSync(concatFile)) {
                        fs.unlinkSync(concatFile);
                    }
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    reject(err);
                })
                .run();
        });
    },

    async mergeChapters(audiobook) {
        return new Promise((resolve, reject) => {
            const chapterFiles = audiobook.chapters
                .filter(chapter => chapter.status === 'completed')
                .map(chapter => chapter.audioFile);

            if (chapterFiles.length === 0) {
                reject(new Error('No completed chapters to merge'));
                return;
            }

            const outputPath = path.join(process.cwd(), 'temp', `${audiobook.title}_final.${audiobook.audioSettings.format}`);
            
            if (chapterFiles.length === 1) {
                // If only one chapter, just convert format
                ffmpeg(chapterFiles[0])
                    .output(outputPath)
                    .on('end', () => resolve(outputPath))
                    .on('error', reject)
                    .run();
            } else {
                // Merge multiple chapters
                const inputFiles = chapterFiles.map(file => `file '${file}'`).join('\n');
                const concatFile = path.join(process.cwd(), 'temp', 'final_concat.txt');
                
                fs.writeFileSync(concatFile, inputFiles);

                ffmpeg()
                    .input(concatFile)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .output(outputPath)
                    .on('end', () => {
                        if (fs.existsSync(concatFile)) {
                            fs.unlinkSync(concatFile);
                        }
                        resolve(outputPath);
                    })
                    .on('error', reject)
                    .run();
            }
        });
    },

    async getAudioDuration(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    }
};

export const processAudioGeneration = AudioProcessingService.processAudioGeneration;

