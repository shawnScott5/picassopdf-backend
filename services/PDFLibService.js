import { PDFDocument, StandardFonts, rgb, rgbColor } from 'pdf-lib';
import * as cheerio from 'cheerio';

class PDFLibService {
    constructor() {
        this.defaultFont = StandardFonts.Helvetica;
        this.defaultFontBold = StandardFonts.HelveticaBold;
        this.defaultFontSize = 12;
        this.pageMargin = 50;
        this.lineHeight = 1.2;
    }

    async generatePDFFromHTML(htmlContent, options = {}) {
        try {
            console.log('🔧 Generating PDF using pdf-lib...');
            
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
            const font = await pdfDoc.embedFont(this.defaultFont);
            const boldFont = await pdfDoc.embedFont(this.defaultFontBold);
            
            // Parse HTML content
            const $ = cheerio.load(htmlContent);
            
            // Remove script and style tags
            $('script, style').remove();
            
            let yPosition = page.getHeight() - this.pageMargin;
            let currentPage = page;
            
            // Process different HTML elements
            $('*').contents().each((index, element) => {
                if (element.type === 'text') {
                    const text = $(element).text().trim();
                    if (text) {
                        yPosition = this.addTextToPage(currentPage, text, yPosition, font, boldFont);
                        
                        // Check if we need a new page
                        if (yPosition < this.pageMargin) {
                            currentPage = pdfDoc.addPage([595.28, 841.89]);
                            yPosition = currentPage.getHeight() - this.pageMargin;
                        }
                    }
                } else if (element.type === 'tag') {
                    const $el = $(element);
                    const tagName = element.name.toLowerCase();
                    
                    yPosition = this.processHTMLElement(currentPage, $el, tagName, yPosition, font, boldFont);
                    
                    // Check if we need a new page
                    if (yPosition < this.pageMargin) {
                        currentPage = pdfDoc.addPage([595.28, 841.89]);
                        yPosition = currentPage.getHeight() - this.pageMargin;
                    }
                }
            });
            
            const pdfBytes = await pdfDoc.save();
            console.log(`📄 PDF generated: ${pdfBytes.length} bytes`);
            
            return pdfBytes;
        } catch (error) {
            console.error('Error generating PDF with pdf-lib:', error);
            throw error;
        }
    }

    addTextToPage(page, text, yPosition, font, boldFont) {
        const fontSize = this.defaultFontSize;
        const lineHeight = fontSize * this.lineHeight;
        const maxWidth = page.getWidth() - (this.pageMargin * 2);
        
        // Split text into lines if it's too long
        const lines = this.wrapText(text, maxWidth, fontSize, font);
        
        for (const line of lines) {
            if (yPosition < this.pageMargin) {
                break; // Would need new page
            }
            
            page.drawText(line, {
                x: this.pageMargin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0)
            });
            
            yPosition -= lineHeight;
        }
        
        return yPosition;
    }

    processHTMLElement(page, $el, tagName, yPosition, font, boldFont) {
        const fontSize = this.defaultFontSize;
        const lineHeight = fontSize * this.lineHeight;
        
        switch (tagName) {
            case 'h1':
                return this.addTextToPage(page, $el.text(), yPosition - lineHeight, boldFont, boldFont, fontSize * 1.5);
            case 'h2':
                return this.addTextToPage(page, $el.text(), yPosition - lineHeight, boldFont, boldFont, fontSize * 1.3);
            case 'h3':
                return this.addTextToPage(page, $el.text(), yPosition - lineHeight, boldFont, boldFont, fontSize * 1.2);
            case 'p':
                return this.addTextToPage(page, $el.text(), yPosition - lineHeight, font, boldFont);
            case 'br':
                return yPosition - lineHeight;
            case 'div':
                return yPosition - (lineHeight * 0.5);
            default:
                return yPosition;
        }
    }

    wrapText(text, maxWidth, fontSize, font) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    lines.push(word); // Single word is too long
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    async generateSimplePDF(textContent, options = {}) {
        try {
            console.log('🔧 Generating simple PDF using pdf-lib...');
            
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
            const font = await pdfDoc.embedFont(this.defaultFont);
            
            const fontSize = options.fontSize || this.defaultFontSize;
            const lineHeight = fontSize * this.lineHeight;
            let yPosition = page.getHeight() - this.pageMargin;
            
            // Split text into lines
            const lines = textContent.split('\n');
            
            for (const line of lines) {
                if (yPosition < this.pageMargin) {
                    // Add new page if needed
                    const newPage = pdfDoc.addPage([595.28, 841.89]);
                    yPosition = newPage.getHeight() - this.pageMargin;
                }
                
                page.drawText(line, {
                    x: this.pageMargin,
                    y: yPosition,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0)
                });
                
                yPosition -= lineHeight;
            }
            
            const pdfBytes = await pdfDoc.save();
            console.log(`📄 Simple PDF generated: ${pdfBytes.length} bytes`);
            
            return pdfBytes;
        } catch (error) {
            console.error('Error generating simple PDF:', error);
            throw error;
        }
    }
}

export default PDFLibService;
