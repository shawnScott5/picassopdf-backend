import { PDFDocument, PDFPage, PDFImage, PDFFont, rgb, degrees } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFPostProcessingService {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'tmp');
        this.ensureTempDirectory();
    }

    /**
     * Ensure temporary directory exists
     */
    async ensureTempDirectory() {
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        } catch (error) {
            console.error('Error creating temp directory:', error);
        }
    }

    /**
     * Main method to post-process PDF
     * @param {Buffer} pdfBuffer - Original PDF buffer
     * @param {Object} options - Post-processing options
     * @returns {Buffer} Processed PDF buffer
     */
    async postProcessPDF(pdfBuffer, options = {}) {
        try {
            console.log('Starting PDF post-processing');

            let processedBuffer = pdfBuffer;

            // Load PDF document
            const pdfDoc = await PDFDocument.load(processedBuffer);

            // Apply watermarks if specified
            if (options.watermark) {
                processedBuffer = await this.addWatermark(pdfDoc, options.watermark);
            }

            // Apply signatures if specified
            if (options.signature) {
                processedBuffer = await this.addSignature(pdfDoc, options.signature);
            }

            // Apply annotations if specified
            if (options.annotations) {
                processedBuffer = await this.addAnnotations(pdfDoc, options.annotations);
            }

            // Fill forms if specified
            if (options.formData) {
                processedBuffer = await this.fillForms(pdfDoc, options.formData);
            }

            // Merge with other PDFs if specified
            if (options.mergeWith) {
                processedBuffer = await this.mergePDFs([processedBuffer, ...options.mergeWith]);
            }

            console.log('PDF post-processing completed successfully');
            return processedBuffer;

        } catch (error) {
            console.error('PDF post-processing error:', error);
            throw new Error(`Failed to post-process PDF: ${error.message}`);
        }
    }

    /**
     * Add watermark to PDF
     * @param {PDFDocument} pdfDoc - PDF document
     * @param {Object} watermarkOptions - Watermark options
     * @returns {Buffer} PDF buffer with watermark
     */
    async addWatermark(pdfDoc, watermarkOptions) {
        try {
            const {
                text = 'DRAFT',
                image = null,
                position = 'center',
                opacity = 0.3,
                rotation = -45,
                fontSize = 48,
                color = rgb(0.5, 0.5, 0.5)
            } = watermarkOptions;

            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                if (image) {
                    // Add image watermark
                    await this.addImageWatermark(page, image, position, opacity, rotation, width, height);
                } else {
                    // Add text watermark
                    await this.addTextWatermark(page, text, position, opacity, rotation, fontSize, color, width, height);
                }
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Error adding watermark:', error);
            throw error;
        }
    }

    /**
     * Add text watermark to a page
     * @param {PDFPage} page - PDF page
     * @param {string} text - Watermark text
     * @param {string} position - Position ('center', 'top-left', 'top-right', 'bottom-left', 'bottom-right')
     * @param {number} opacity - Opacity (0-1)
     * @param {number} rotation - Rotation in degrees
     * @param {number} fontSize - Font size
     * @param {Object} color - Text color
     * @param {number} width - Page width
     * @param {number} height - Page height
     */
    async addTextWatermark(page, text, position, opacity, rotation, fontSize, color, width, height) {
        try {
            // Embed default font
            const font = await this.getDefaultFont(page.doc);

            // Calculate position
            const { x, y } = this.calculateWatermarkPosition(position, width, height);

            // Add text watermark
            page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color,
                opacity,
                rotate: degrees(rotation)
            });

        } catch (error) {
            console.error('Error adding text watermark:', error);
            throw error;
        }
    }

    /**
     * Add image watermark to a page
     * @param {PDFPage} page - PDF page
     * @param {string|Buffer} image - Image path or buffer
     * @param {string} position - Position
     * @param {number} opacity - Opacity
     * @param {number} rotation - Rotation
     * @param {number} width - Page width
     * @param {number} height - Page height
     */
    async addImageWatermark(page, image, position, opacity, rotation, width, height) {
        try {
            let imageBuffer;
            if (typeof image === 'string') {
                imageBuffer = fs.readFileSync(image);
            } else {
                imageBuffer = image;
            }

            // Embed image
            const pdfImage = await page.doc.embedPng(imageBuffer);
            const { x, y } = this.calculateWatermarkPosition(position, width, height);

            // Calculate image dimensions (maintain aspect ratio)
            const imgWidth = 200; // Default width
            const imgHeight = (pdfImage.height * imgWidth) / pdfImage.width;

            // Add image watermark
            page.drawImage(pdfImage, {
                x,
                y,
                width: imgWidth,
                height: imgHeight,
                opacity,
                rotate: degrees(rotation)
            });

        } catch (error) {
            console.error('Error adding image watermark:', error);
            throw error;
        }
    }

    /**
     * Calculate watermark position
     * @param {string} position - Position string
     * @param {number} width - Page width
     * @param {number} height - Page height
     * @returns {Object} x, y coordinates
     */
    calculateWatermarkPosition(position, width, height) {
        switch (position) {
            case 'top-left':
                return { x: 50, y: height - 100 };
            case 'top-right':
                return { x: width - 200, y: height - 100 };
            case 'bottom-left':
                return { x: 50, y: 100 };
            case 'bottom-right':
                return { x: width - 200, y: 100 };
            case 'center':
            default:
                return { x: width / 2 - 100, y: height / 2 };
        }
    }

    /**
     * Get default font for PDF
     * @param {PDFDocument} pdfDoc - PDF document
     * @returns {PDFFont} Font object
     */
    async getDefaultFont(pdfDoc) {
        try {
            // Try to embed Helvetica font
            return await pdfDoc.embedFont('Helvetica');
        } catch (error) {
            // Fallback to standard font
            return await pdfDoc.embedFont('Helvetica-Bold');
        }
    }

    /**
     * Add digital signature to PDF
     * @param {PDFDocument} pdfDoc - PDF document
     * @param {Object} signatureOptions - Signature options
     * @returns {Buffer} PDF buffer with signature
     */
    async addSignature(pdfDoc, signatureOptions) {
        try {
            const {
                text = 'Digitally Signed',
                image = null,
                position = 'bottom-right',
                page = 'last',
                fontSize = 12,
                color = rgb(0, 0, 0)
            } = signatureOptions;

            const pages = pdfDoc.getPages();
            const targetPage = page === 'last' ? pages[pages.length - 1] : pages[page - 1];
            const { width, height } = targetPage.getSize();

            // Calculate signature position
            const { x, y } = this.calculateSignaturePosition(position, width, height);

            if (image) {
                // Add image signature
                await this.addImageSignature(targetPage, image, x, y);
            } else {
                // Add text signature
                await this.addTextSignature(targetPage, text, x, y, fontSize, color);
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Error adding signature:', error);
            throw error;
        }
    }

    /**
     * Add text signature
     * @param {PDFPage} page - PDF page
     * @param {string} text - Signature text
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} fontSize - Font size
     * @param {Object} color - Text color
     */
    async addTextSignature(page, text, x, y, fontSize, color) {
        try {
            const font = await this.getDefaultFont(page.doc);

            page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color
            });

            // Add signature line
            page.drawLine({
                start: { x, y: y - 5 },
                end: { x: x + 150, y: y - 5 },
                thickness: 1,
                color
            });

        } catch (error) {
            console.error('Error adding text signature:', error);
            throw error;
        }
    }

    /**
     * Add image signature
     * @param {PDFPage} page - PDF page
     * @param {string|Buffer} image - Signature image
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    async addImageSignature(page, image, x, y) {
        try {
            let imageBuffer;
            if (typeof image === 'string') {
                imageBuffer = fs.readFileSync(image);
            } else {
                imageBuffer = image;
            }

            const pdfImage = await page.doc.embedPng(imageBuffer);
            const imgWidth = 100;
            const imgHeight = (pdfImage.height * imgWidth) / pdfImage.width;

            page.drawImage(pdfImage, {
                x,
                y: y - imgHeight,
                width: imgWidth,
                height: imgHeight
            });

        } catch (error) {
            console.error('Error adding image signature:', error);
            throw error;
        }
    }

    /**
     * Calculate signature position
     * @param {string} position - Position string
     * @param {number} width - Page width
     * @param {number} height - Page height
     * @returns {Object} x, y coordinates
     */
    calculateSignaturePosition(position, width, height) {
        switch (position) {
            case 'top-left':
                return { x: 50, y: height - 50 };
            case 'top-right':
                return { x: width - 200, y: height - 50 };
            case 'bottom-left':
                return { x: 50, y: 50 };
            case 'bottom-right':
            default:
                return { x: width - 200, y: 50 };
        }
    }

    /**
     * Add annotations to PDF
     * @param {PDFDocument} pdfDoc - PDF document
     * @param {Array} annotations - Array of annotations
     * @returns {Buffer} PDF buffer with annotations
     */
    async addAnnotations(pdfDoc, annotations) {
        try {
            const pages = pdfDoc.getPages();

            for (const annotation of annotations) {
                const {
                    page: pageNum = 1,
                    type = 'text',
                    x = 0,
                    y = 0,
                    width = 100,
                    height = 50,
                    text = '',
                    color = rgb(1, 0, 0)
                } = annotation;

                if (pageNum <= pages.length) {
                    const page = pages[pageNum - 1];

                    switch (type) {
                        case 'text':
                            await this.addTextAnnotation(page, x, y, text, color);
                            break;
                        case 'highlight':
                            await this.addHighlightAnnotation(page, x, y, width, height, color);
                            break;
                        case 'strikeout':
                            await this.addStrikeoutAnnotation(page, x, y, width, color);
                            break;
                        default:
                            console.warn(`Unknown annotation type: ${type}`);
                    }
                }
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Error adding annotations:', error);
            throw error;
        }
    }

    /**
     * Add text annotation
     * @param {PDFPage} page - PDF page
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} text - Annotation text
     * @param {Object} color - Text color
     */
    async addTextAnnotation(page, x, y, text, color) {
        try {
            const font = await this.getDefaultFont(page.doc);

            page.drawText(text, {
                x,
                y,
                size: 10,
                font,
                color
            });

        } catch (error) {
            console.error('Error adding text annotation:', error);
            throw error;
        }
    }

    /**
     * Add highlight annotation
     * @param {PDFPage} page - PDF page
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {Object} color - Highlight color
     */
    async addHighlightAnnotation(page, x, y, width, height, color) {
        try {
            page.drawRectangle({
                x,
                y,
                width,
                height,
                color,
                opacity: 0.3
            });

        } catch (error) {
            console.error('Error adding highlight annotation:', error);
            throw error;
        }
    }

    /**
     * Add strikeout annotation
     * @param {PDFPage} page - PDF page
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width
     * @param {Object} color - Strikeout color
     */
    async addStrikeoutAnnotation(page, x, y, width, color) {
        try {
            page.drawLine({
                start: { x, y },
                end: { x: x + width, y },
                thickness: 2,
                color
            });

        } catch (error) {
            console.error('Error adding strikeout annotation:', error);
            throw error;
        }
    }

    /**
     * Fill PDF forms
     * @param {PDFDocument} pdfDoc - PDF document
     * @param {Object} formData - Form field data
     * @returns {Buffer} PDF buffer with filled forms
     */
    async fillForms(pdfDoc, formData) {
        try {
            const form = pdfDoc.getForm();
            const fields = form.getFields();

            for (const [fieldName, value] of Object.entries(formData)) {
                if (fields[fieldName]) {
                    const field = fields[fieldName];
                    const fieldType = field.constructor.name;

                    switch (fieldType) {
                        case 'PDFTextField':
                            field.setText(value);
                            break;
                        case 'PDFCheckBox':
                            if (value) {
                                field.check();
                            } else {
                                field.uncheck();
                            }
                            break;
                        case 'PDFRadioGroup':
                            field.select(value);
                            break;
                        case 'PDFDropdown':
                            field.select(value);
                            break;
                        default:
                            console.warn(`Unknown field type: ${fieldType} for field: ${fieldName}`);
                    }
                }
            }

            return await pdfDoc.save();

        } catch (error) {
            console.error('Error filling forms:', error);
            throw error;
        }
    }

    /**
     * Merge multiple PDFs
     * @param {Array} pdfBuffers - Array of PDF buffers
     * @returns {Buffer} Merged PDF buffer
     */
    async mergePDFs(pdfBuffers) {
        try {
            const mergedPdf = await PDFDocument.create();

            for (const pdfBuffer of pdfBuffers) {
                const pdf = await PDFDocument.load(pdfBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            return await mergedPdf.save();

        } catch (error) {
            console.error('Error merging PDFs:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF
     * @param {Buffer} pdfBuffer - PDF buffer
     * @returns {string} Extracted text
     */
    async extractText(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            let extractedText = '';

            for (const page of pages) {
                // Note: pdf-lib doesn't support text extraction
                // This would require additional libraries like pdf-parse
                extractedText += `Page ${pages.indexOf(page) + 1}\n`;
            }

            return extractedText;

        } catch (error) {
            console.error('Error extracting text:', error);
            throw error;
        }
    }

    /**
     * Get PDF metadata
     * @param {Buffer} pdfBuffer - PDF buffer
     * @returns {Object} PDF metadata
     */
    async getPDFMetadata(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();

            return {
                pageCount: pages.length,
                title: pdfDoc.getTitle() || 'Untitled',
                author: pdfDoc.getAuthor() || 'Unknown',
                subject: pdfDoc.getSubject() || '',
                keywords: pdfDoc.getKeywords() || [],
                creator: pdfDoc.getCreator() || 'PDF Generator',
                producer: pdfDoc.getProducer() || 'PDF-lib',
                creationDate: pdfDoc.getCreationDate(),
                modificationDate: pdfDoc.getModificationDate()
            };

        } catch (error) {
            console.error('Error getting PDF metadata:', error);
            throw error;
        }
    }

    /**
     * Set PDF metadata
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {Object} metadata - Metadata to set
     * @returns {Buffer} PDF buffer with updated metadata
     */
    async setPDFMetadata(pdfBuffer, metadata) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);

            if (metadata.title) pdfDoc.setTitle(metadata.title);
            if (metadata.author) pdfDoc.setAuthor(metadata.author);
            if (metadata.subject) pdfDoc.setSubject(metadata.subject);
            if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords);
            if (metadata.creator) pdfDoc.setCreator(metadata.creator);
            if (metadata.producer) pdfDoc.setProducer(metadata.producer);

            return await pdfDoc.save();

        } catch (error) {
            console.error('Error setting PDF metadata:', error);
            throw error;
        }
    }
}

export default PDFPostProcessingService;
