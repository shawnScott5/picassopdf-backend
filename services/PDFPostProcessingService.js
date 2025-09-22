import { PDFDocument } from 'pdf-lib';

class PDFPostProcessingService {
    constructor() {
        // Service for PDF post-processing and metadata
    }

    /**
     * Get PDF metadata including page count for credits
     * @param {Buffer} pdfBuffer - PDF buffer
     * @returns {Object} PDF metadata
     */
    async getPDFMetadata(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();

            return {
                pageCount: pages.length,
                title: pdfDoc.getTitle() || 'Generated PDF',
                author: pdfDoc.getAuthor() || 'PicassoPDF',
                subject: pdfDoc.getSubject() || 'PDF Document',
                keywords: pdfDoc.getKeywords() || [],
                creator: pdfDoc.getCreator() || 'PicassoPDF API',
                producer: pdfDoc.getProducer() || 'Playwright',
                creationDate: pdfDoc.getCreationDate() || new Date(),
                modificationDate: pdfDoc.getModificationDate() || new Date()
            };

        } catch (error) {
            console.error('Error getting PDF metadata:', error);
            // Return default values if parsing fails
            return {
                pageCount: 1,
                title: 'Generated PDF',
                author: 'PicassoPDF',
                subject: 'PDF Document',
                keywords: [],
                creator: 'PicassoPDF API',
                producer: 'Playwright',
                creationDate: new Date(),
                modificationDate: new Date()
            };
        }
    }
}

export default PDFPostProcessingService;
