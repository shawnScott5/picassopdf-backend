import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import Audiobook from '../audiobooks/AudiobookSchema.js';

export const TextExtractionService = {
    async extractTextFromFile(filePath, fileType) {
        try {
            let extractedText = '';

            switch (fileType) {
                case 'application/pdf':
                    extractedText = await this.extractFromPDF(filePath);
                    break;
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    extractedText = await this.extractFromDOCX(filePath);
                    break;
                case 'application/epub+zip':
                    extractedText = await this.extractFromEPUB(filePath);
                    break;
                default:
                    throw new Error('Unsupported file type');
            }

            return this.cleanAndStructureText(extractedText);
        } catch (error) {
            console.error('Text extraction error:', error);
            throw error;
        }
    },

    async extractFromPDF(filePath) {
        try {
            const pdfParse = (await import('pdf-parse')).default;
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    },

    async extractFromDOCX(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            console.error('DOCX extraction error:', error);
            throw new Error('Failed to extract text from DOCX');
        }
    },

    async extractFromEPUB(filePath) {
        try {
            // For EPUB, we'll use a simple approach
            // In production, you might want to use a more robust EPUB parser
            const epub = require('epub');
            return new Promise((resolve, reject) => {
                epub.open(filePath, (err, book) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    book.getChapterRaw('chapter1', (err, text) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(text);
                    });
                });
            });
        } catch (error) {
            console.error('EPUB extraction error:', error);
            throw new Error('Failed to extract text from EPUB');
        }
    },

    cleanAndStructureText(text) {
        // Clean up the extracted text
        let cleanedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Split into chapters (basic implementation)
        const chapters = this.splitIntoChapters(cleanedText);

        return {
            fullText: cleanedText,
            chapters: chapters
        };
    },

    splitIntoChapters(text) {
        // Basic chapter splitting logic
        // This can be enhanced with more sophisticated chapter detection
        const chapterPatterns = [
            /^Chapter\s+\d+/i,
            /^CHAPTER\s+\d+/i,
            /^\d+\.\s+/,
            /^Part\s+\d+/i,
            /^Book\s+\d+/i
        ];

        const lines = text.split('\n');
        const chapters = [];
        let currentChapter = { title: 'Introduction', content: '' };
        let chapterIndex = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this line is a chapter header
            const isChapterHeader = chapterPatterns.some(pattern => pattern.test(line));
            
            if (isChapterHeader && currentChapter.content.trim()) {
                // Save current chapter
                chapters.push({
                    ...currentChapter,
                    title: currentChapter.title || `Chapter ${chapterIndex}`
                });
                
                // Start new chapter
                chapterIndex++;
                currentChapter = { 
                    title: line, 
                    content: '' 
                };
            } else {
                currentChapter.content += line + '\n';
            }
        }

        // Add the last chapter
        if (currentChapter.content.trim()) {
            chapters.push({
                ...currentChapter,
                title: currentChapter.title || `Chapter ${chapterIndex}`
            });
        }

        // If no chapters were detected, create a single chapter
        if (chapters.length === 0) {
            chapters.push({
                title: 'Chapter 1',
                content: text
            });
        }

        return chapters;
    }
};

export const extractTextFromFile = TextExtractionService.extractTextFromFile;

