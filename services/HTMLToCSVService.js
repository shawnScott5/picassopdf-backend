import axios from 'axios';
import * as cheerio from 'cheerio';

class HTMLToCSVService {
    constructor() {
        this.defaultOptions = {
            extractTables: true,
            extractLists: false,
            extractText: false,
            includeHeaders: true,
            delimiter: ',',
            encoding: 'utf-8'
        };
    }

    /**
     * Convert HTML content to CSV format
     * @param {string} htmlContent - HTML content to convert
     * @param {Object} options - Conversion options
     * @returns {Object} CSV conversion result
     */
    async convertHTMLToCSV(htmlContent, options = {}) {
        try {
            const opts = { ...this.defaultOptions, ...options };
            const $ = cheerio.load(htmlContent);
            
            let csvData = [];
            let metadata = {
                tablesFound: 0,
                rowsExtracted: 0,
                columnsExtracted: 0
            };

            // Extract tables if enabled
            if (opts.extractTables) {
                const tableResult = this.extractTables($, opts);
                csvData = csvData.concat(tableResult.data);
                metadata.tablesFound = tableResult.tablesFound;
                metadata.rowsExtracted += tableResult.rowsExtracted;
                metadata.columnsExtracted = Math.max(metadata.columnsExtracted, tableResult.columnsExtracted);
            }

            // Extract lists if enabled
            if (opts.extractLists) {
                const listResult = this.extractLists($, opts);
                csvData = csvData.concat(listResult.data);
                metadata.rowsExtracted += listResult.rowsExtracted;
            }

            // Extract text content if enabled
            if (opts.extractText) {
                const textResult = this.extractTextContent($, opts);
                csvData = csvData.concat(textResult.data);
                metadata.rowsExtracted += textResult.rowsExtracted;
            }

            // Convert to CSV string
            const csvString = this.arrayToCSV(csvData, opts.delimiter);

            return {
                success: true,
                csvData: csvString,
                metadata: {
                    ...metadata,
                    totalRows: csvData.length,
                    totalColumns: metadata.columnsExtracted,
                    encoding: opts.encoding,
                    delimiter: opts.delimiter
                },
                rawData: csvData
            };

        } catch (error) {
            console.error('HTML to CSV conversion error:', error);
            return {
                success: false,
                error: error.message,
                csvData: null,
                metadata: null
            };
        }
    }

    /**
     * Extract table data from HTML
     * @param {Object} $ - Cheerio object
     * @param {Object} options - Extraction options
     * @returns {Object} Table extraction result
     */
    extractTables($, options) {
        const tables = $('table');
        let allData = [];
        let tablesFound = 0;
        let rowsExtracted = 0;
        let columnsExtracted = 0;

        tables.each((tableIndex, table) => {
            const $table = $(table);
            const rows = $table.find('tr');
            let tableData = [];

            rows.each((rowIndex, row) => {
                const $row = $(row);
                const cells = $row.find('td, th');
                let rowData = [];

                cells.each((cellIndex, cell) => {
                    const $cell = $(cell);
                    let cellText = $cell.text().trim();
                    
                    // Clean up cell text
                    cellText = this.cleanText(cellText);
                    rowData.push(cellText);
                });

                if (rowData.length > 0) {
                    tableData.push(rowData);
                    rowsExtracted++;
                    columnsExtracted = Math.max(columnsExtracted, rowData.length);
                }
            });

            if (tableData.length > 0) {
                allData = allData.concat(tableData);
                tablesFound++;
            }
        });

        return {
            data: allData,
            tablesFound,
            rowsExtracted,
            columnsExtracted
        };
    }

    /**
     * Extract list data from HTML
     * @param {Object} $ - Cheerio object
     * @param {Object} options - Extraction options
     * @returns {Object} List extraction result
     */
    extractLists($, options) {
        const lists = $('ul, ol');
        let allData = [];
        let rowsExtracted = 0;

        lists.each((listIndex, list) => {
            const $list = $(list);
            const items = $list.find('li');
            
            items.each((itemIndex, item) => {
                const $item = $(item);
                let itemText = $item.text().trim();
                itemText = this.cleanText(itemText);
                
                if (itemText) {
                    allData.push([itemText]);
                    rowsExtracted++;
                }
            });
        });

        return {
            data: allData,
            rowsExtracted
        };
    }

    /**
     * Extract text content from HTML
     * @param {Object} $ - Cheerio object
     * @param {Object} options - Extraction options
     * @returns {Object} Text extraction result
     */
    extractTextContent($, options) {
        const textElements = $('p, h1, h2, h3, h4, h5, h6, div');
        let allData = [];
        let rowsExtracted = 0;

        textElements.each((elementIndex, element) => {
            const $element = $(element);
            let elementText = $element.text().trim();
            elementText = this.cleanText(elementText);
            
            if (elementText && elementText.length > 10) { // Only include substantial text
                allData.push([elementText]);
                rowsExtracted++;
            }
        });

        return {
            data: allData,
            rowsExtracted
        };
    }

    /**
     * Convert array data to CSV string
     * @param {Array} data - Array of rows
     * @param {string} delimiter - CSV delimiter
     * @returns {string} CSV string
     */
    arrayToCSV(data, delimiter = ',') {
        if (!data || data.length === 0) {
            return '';
        }

        return data.map(row => {
            return row.map(cell => {
                // Escape quotes and wrap in quotes if contains delimiter or newline
                let cellStr = String(cell || '');
                cellStr = cellStr.replace(/"/g, '""');
                
                if (cellStr.includes(delimiter) || cellStr.includes('\n') || cellStr.includes('"')) {
                    return `"${cellStr}"`;
                }
                return cellStr;
            }).join(delimiter);
        }).join('\n');
    }

    /**
     * Clean text content
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n+/g, ' ') // Replace newlines with space
            .replace(/\t+/g, ' ') // Replace tabs with space
            .trim();
    }

    /**
     * Convert HTML from URL to CSV
     * @param {string} url - URL to fetch HTML from
     * @param {Object} options - Conversion options
     * @returns {Object} CSV conversion result
     */
    async convertURLToCSV(url, options = {}) {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return await this.convertHTMLToCSV(response.data, options);
        } catch (error) {
            console.error('URL to CSV conversion error:', error);
            return {
                success: false,
                error: `Failed to fetch URL: ${error.message}`,
                csvData: null,
                metadata: null
            };
        }
    }

    /**
     * Get CSV preview (first few rows)
     * @param {string} csvData - CSV data
     * @param {number} rows - Number of preview rows
     * @returns {Object} Preview data
     */
    getCSVPreview(csvData, rows = 5) {
        try {
            const lines = csvData.split('\n');
            const previewLines = lines.slice(0, rows);
            const previewData = previewLines.map(line => line.split(','));
            
            return {
                success: true,
                preview: previewData,
                totalRows: lines.length,
                previewRows: Math.min(rows, lines.length)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                preview: null
            };
        }
    }
}

export default HTMLToCSVService;

