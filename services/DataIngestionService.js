// import { Client } from '@notionhq/client'; // Disabled for deployment
import Airtable from 'airtable';
import Papa from 'papaparse';
import axios from 'axios';

class DataIngestionService {
    constructor() {
        this.notionClient = null;
        this.airtableBase = null;
        this.initNotionClient();
    }

    initNotionClient() {
        // Initialize Notion client with API key from environment
        const notionApiKey = process.env.NOTION_API_KEY;
        if (notionApiKey) {
            this.notionClient = new Client({ auth: notionApiKey });
        }
    }

    /**
     * Main method to ingest data from various sources
     * @param {Object} params - Ingestion parameters
     * @param {string} params.sourceType - 'notion', 'airtable', 'csv', 'html'
     * @param {string} params.sourceUrl - URL or identifier for the data source
     * @param {Object} params.options - Additional options for specific sources
     * @returns {Object} Structured data ready for the builder
     */
    async ingestData(params) {
        const { sourceType, sourceUrl, options = {} } = params;

        try {
            console.log(`Starting data ingestion for ${sourceType}:`, sourceUrl);

            let structuredData;

            switch (sourceType) {
                case 'notion':
                    structuredData = await this.ingestNotionData(sourceUrl, options);
                    break;
                case 'airtable':
                    structuredData = await this.ingestAirtableData(sourceUrl, options);
                    break;
                case 'csv':
                    structuredData = await this.ingestCSVData(sourceUrl, options);
                    break;
                case 'html':
                    structuredData = await this.ingestHTMLData(sourceUrl, options);
                    break;
                default:
                    throw new Error(`Unsupported source type: ${sourceType}`);
            }

            return {
                success: true,
                sourceType,
                sourceUrl,
                data: structuredData,
                metadata: {
                    ingestedAt: new Date(),
                    blockCount: structuredData.blocks?.length || 0,
                    contentType: structuredData.contentType || 'mixed'
                }
            };

        } catch (error) {
            console.error('Data ingestion error:', error);
            throw new Error(`Failed to ingest ${sourceType} data: ${error.message}`);
        }
    }

    /**
     * Ingest data from Notion pages
     * @param {string} notionUrl - Notion page URL
     * @param {Object} options - Options for Notion ingestion
     * @returns {Object} Structured Notion data
     */
    async ingestNotionData(notionUrl, options = {}) {
        try {
            // Extract page ID from Notion URL
            const pageId = this.extractNotionPageId(notionUrl);
            if (!pageId) {
                throw new Error('Invalid Notion URL format');
            }

            if (!this.notionClient) {
                throw new Error('Notion API key not configured');
            }

            // Fetch page content
            const page = await this.notionClient.pages.retrieve({ page_id: pageId });
            
            // Fetch page blocks
            const blocks = await this.fetchNotionBlocks(pageId);
            
            // Convert to structured format
            const structuredData = this.convertNotionToStructuredData(page, blocks);

            return structuredData;

        } catch (error) {
            console.error('Notion ingestion error:', error);
            throw error;
        }
    }

    /**
     * Extract page ID from Notion URL
     * @param {string} url - Notion page URL
     * @returns {string|null} Page ID
     */
    extractNotionPageId(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            // Handle different Notion URL formats
            if (pathParts.length >= 2) {
                const lastPart = pathParts[pathParts.length - 1];
                // Remove any query parameters or fragments
                return lastPart.split('?')[0].split('#')[0];
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting Notion page ID:', error);
            return null;
        }
    }

    /**
     * Fetch all blocks from a Notion page recursively
     * @param {string} blockId - Block ID to fetch
     * @returns {Array} Array of blocks
     */
    async fetchNotionBlocks(blockId) {
        const blocks = [];
        let hasMore = true;
        let startCursor = undefined;

        while (hasMore) {
            const response = await this.notionClient.blocks.children.list({
                block_id: blockId,
                start_cursor: startCursor,
                page_size: 100
            });

            blocks.push(...response.results);

            hasMore = response.has_more;
            startCursor = response.next_cursor;
        }

        // Recursively fetch children for each block
        for (const block of blocks) {
            if (block.has_children) {
                block.children = await this.fetchNotionBlocks(block.id);
            }
        }

        return blocks;
    }

    /**
     * Convert Notion blocks to structured data for the builder
     * @param {Object} page - Notion page object
     * @param {Array} blocks - Notion blocks
     * @returns {Object} Structured data
     */
    convertNotionToStructuredData(page, blocks) {
        const structuredBlocks = [];
        let contentBlocks = [];

        // Convert page properties
        if (page.properties?.title?.title) {
            const title = page.properties.title.title[0]?.plain_text || 'Untitled';
            structuredBlocks.push({
                id: `title-${Date.now()}`,
                type: 'heading',
                content: title,
                level: 1,
                styles: {
                    fontSize: '32px',
                    fontWeight: 'bold',
                    marginBottom: '20px'
                }
            });
        }

        // Convert blocks to structured format
        for (const block of blocks) {
            const convertedBlock = this.convertNotionBlock(block);
            if (convertedBlock) {
                structuredBlocks.push(convertedBlock);
            }
        }

        return {
            contentType: 'notion',
            blocks: structuredBlocks,
            metadata: {
                pageId: page.id,
                createdTime: page.created_time,
                lastEditedTime: page.last_edited_time,
                url: page.url
            }
        };
    }

    /**
     * Convert individual Notion block to structured format
     * @param {Object} block - Notion block
     * @returns {Object|null} Structured block
     */
    convertNotionBlock(block) {
        const blockId = `notion-${block.id}`;
        const baseBlock = {
            id: blockId,
            source: 'notion',
            sourceId: block.id
        };

        switch (block.type) {
            case 'paragraph':
                return {
                    ...baseBlock,
                    type: 'text',
                    content: this.extractTextContent(block.paragraph.rich_text),
                    styles: {
                        fontSize: '16px',
                        lineHeight: '1.6',
                        marginBottom: '12px'
                    }
                };

            case 'heading_1':
                return {
                    ...baseBlock,
                    type: 'heading',
                    content: this.extractTextContent(block.heading_1.rich_text),
                    level: 1,
                    styles: {
                        fontSize: '32px',
                        fontWeight: 'bold',
                        marginBottom: '20px'
                    }
                };

            case 'heading_2':
                return {
                    ...baseBlock,
                    type: 'heading',
                    content: this.extractTextContent(block.heading_2.rich_text),
                    level: 2,
                    styles: {
                        fontSize: '24px',
                        fontWeight: 'bold',
                        marginBottom: '16px'
                    }
                };

            case 'heading_3':
                return {
                    ...baseBlock,
                    type: 'heading',
                    content: this.extractTextContent(block.heading_3.rich_text),
                    level: 3,
                    styles: {
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '14px'
                    }
                };

            case 'bulleted_list_item':
                return {
                    ...baseBlock,
                    type: 'list',
                    content: this.extractTextContent(block.bulleted_list_item.rich_text),
                    listType: 'bullet',
                    styles: {
                        fontSize: '16px',
                        marginBottom: '8px',
                        paddingLeft: '20px'
                    }
                };

            case 'numbered_list_item':
                return {
                    ...baseBlock,
                    type: 'list',
                    content: this.extractTextContent(block.numbered_list_item.rich_text),
                    listType: 'number',
                    styles: {
                        fontSize: '16px',
                        marginBottom: '8px',
                        paddingLeft: '20px'
                    }
                };

            case 'image':
                return {
                    ...baseBlock,
                    type: 'image',
                    content: block.image.external?.url || block.image.file?.url,
                    alt: block.image.caption?.[0]?.plain_text || '',
                    styles: {
                        maxWidth: '100%',
                        height: 'auto',
                        marginBottom: '16px'
                    }
                };

            case 'code':
                return {
                    ...baseBlock,
                    type: 'code',
                    content: this.extractTextContent(block.code.rich_text),
                    language: block.code.language,
                    styles: {
                        backgroundColor: '#f6f8fa',
                        border: '1px solid #e1e4e8',
                        borderRadius: '6px',
                        padding: '16px',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        marginBottom: '16px'
                    }
                };

            case 'table_of_contents':
                return {
                    ...baseBlock,
                    type: 'toc',
                    content: 'Table of Contents',
                    styles: {
                        backgroundColor: '#f6f8fa',
                        border: '1px solid #e1e4e8',
                        borderRadius: '6px',
                        padding: '16px',
                        marginBottom: '16px'
                    }
                };

            case 'divider':
                return {
                    ...baseBlock,
                    type: 'divider',
                    content: '',
                    styles: {
                        borderTop: '1px solid #e1e4e8',
                        margin: '20px 0'
                    }
                };

            default:
                console.log(`Unsupported Notion block type: ${block.type}`);
                return null;
        }
    }

    /**
     * Extract text content from Notion rich text array
     * @param {Array} richText - Notion rich text array
     * @returns {string} Plain text content
     */
    extractTextContent(richText) {
        if (!richText || !Array.isArray(richText)) {
            return '';
        }
        return richText.map(text => text.plain_text).join('');
    }

    /**
     * Ingest data from Airtable
     * @param {string} airtableUrl - Airtable URL or base ID
     * @param {Object} options - Options for Airtable ingestion
     * @returns {Object} Structured Airtable data
     */
    async ingestAirtableData(airtableUrl, options = {}) {
        try {
            const { apiKey, baseId, tableName } = this.parseAirtableUrl(airtableUrl, options);
            
            if (!apiKey) {
                throw new Error('Airtable API key required');
            }

            const base = new Airtable({ apiKey }).base(baseId);
            const table = base(tableName);

            const records = await table.select().all();
            
            return this.convertAirtableToStructuredData(records, options);

        } catch (error) {
            console.error('Airtable ingestion error:', error);
            throw error;
        }
    }

    /**
     * Parse Airtable URL or extract parameters from options
     * @param {string} airtableUrl - Airtable URL
     * @param {Object} options - Options containing API key, base ID, etc.
     * @returns {Object} Parsed parameters
     */
    parseAirtableUrl(airtableUrl, options) {
        // If options contain the necessary parameters, use them
        if (options.apiKey && options.baseId && options.tableName) {
            return {
                apiKey: options.apiKey,
                baseId: options.baseId,
                tableName: options.tableName
            };
        }

        // Try to parse from URL
        try {
            const url = new URL(airtableUrl);
            const pathParts = url.pathname.split('/').filter(part => part);
            
            if (pathParts.length >= 3) {
                return {
                    apiKey: options.apiKey || process.env.AIRTABLE_API_KEY,
                    baseId: pathParts[1],
                    tableName: pathParts[2]
                };
            }
        } catch (error) {
            console.error('Error parsing Airtable URL:', error);
        }

        throw new Error('Invalid Airtable URL or missing parameters');
    }

    /**
     * Convert Airtable records to structured data
     * @param {Array} records - Airtable records
     * @param {Object} options - Options for conversion
     * @returns {Object} Structured data
     */
    convertAirtableToStructuredData(records, options = {}) {
        const blocks = [];
        
        // Add title
        blocks.push({
            id: `airtable-title-${Date.now()}`,
            type: 'heading',
            content: options.title || 'Airtable Data',
            level: 1,
            styles: {
                fontSize: '32px',
                fontWeight: 'bold',
                marginBottom: '20px'
            }
        });

        // Convert records to table
        if (records.length > 0) {
            const fields = Object.keys(records[0].fields);
            
            // Create table header
            const headerRow = fields.map(field => ({
                content: field,
                styles: { fontWeight: 'bold', backgroundColor: '#f6f8fa' }
            }));

            // Create table rows
            const tableRows = records.map(record => 
                fields.map(field => ({
                    content: this.formatAirtableValue(record.fields[field]),
                    styles: {}
                }))
            );

            blocks.push({
                id: `airtable-table-${Date.now()}`,
                type: 'table',
                content: {
                    headers: headerRow,
                    rows: tableRows
                },
                styles: {
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '20px'
                }
            });
        }

        return {
            contentType: 'airtable',
            blocks,
            metadata: {
                recordCount: records.length,
                fields: records.length > 0 ? Object.keys(records[0].fields) : []
            }
        };
    }

    /**
     * Format Airtable field value for display
     * @param {any} value - Field value
     * @returns {string} Formatted value
     */
    formatAirtableValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Ingest CSV data
     * @param {string} csvData - CSV data as string or URL
     * @param {Object} options - Options for CSV parsing
     * @returns {Object} Structured CSV data
     */
    async ingestCSVData(csvData, options = {}) {
        try {
            let csvString = csvData;

            // If it's a URL, fetch the CSV content
            if (csvData.startsWith('http')) {
                const response = await axios.get(csvData);
                csvString = response.data;
            }

            return new Promise((resolve, reject) => {
                Papa.parse(csvString, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        try {
                            const structuredData = this.convertCSVToStructuredData(results.data, options);
                            resolve(structuredData);
                        } catch (error) {
                            reject(error);
                        }
                    },
                    error: (error) => {
                        reject(new Error(`CSV parsing error: ${error.message}`));
                    }
                });
            });

        } catch (error) {
            console.error('CSV ingestion error:', error);
            throw error;
        }
    }

    /**
     * Convert CSV data to structured format
     * @param {Array} csvData - Parsed CSV data
     * @param {Object} options - Options for conversion
     * @returns {Object} Structured data
     */
    convertCSVToStructuredData(csvData, options = {}) {
        const blocks = [];

        // Add title
        blocks.push({
            id: `csv-title-${Date.now()}`,
            type: 'heading',
            content: options.title || 'CSV Data',
            level: 1,
            styles: {
                fontSize: '32px',
                fontWeight: 'bold',
                marginBottom: '20px'
            }
        });

        // Convert to table
        if (csvData.length > 0) {
            const headers = Object.keys(csvData[0]);
            
            // Create table header
            const headerRow = headers.map(header => ({
                content: header,
                styles: { fontWeight: 'bold', backgroundColor: '#f6f8fa' }
            }));

            // Create table rows
            const tableRows = csvData.map(row => 
                headers.map(header => ({
                    content: row[header] || '',
                    styles: {}
                }))
            );

            blocks.push({
                id: `csv-table-${Date.now()}`,
                type: 'table',
                content: {
                    headers: headerRow,
                    rows: tableRows
                },
                styles: {
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '20px'
                }
            });
        }

        return {
            contentType: 'csv',
            blocks,
            metadata: {
                rowCount: csvData.length,
                columns: csvData.length > 0 ? Object.keys(csvData[0]) : []
            }
        };
    }

    /**
     * Ingest HTML data
     * @param {string} htmlData - HTML data as string or URL
     * @param {Object} options - Options for HTML parsing
     * @returns {Object} Structured HTML data
     */
    async ingestHTMLData(htmlData, options = {}) {
        try {
            let htmlString = htmlData;

            // If it's a URL, fetch the HTML content
            if (htmlData.startsWith('http')) {
                const response = await axios.get(htmlData);
                htmlString = response.data;
            }

            return this.convertHTMLToStructuredData(htmlString, options);

        } catch (error) {
            console.error('HTML ingestion error:', error);
            throw error;
        }
    }

    /**
     * Convert HTML to structured format
     * @param {string} htmlString - HTML content
     * @param {Object} options - Options for conversion
     * @returns {Object} Structured data
     */
    convertHTMLToStructuredData(htmlString, options = {}) {
        // For now, return a simple text block with the HTML content
        // In a full implementation, you'd want to parse the HTML and convert to structured blocks
        const blocks = [
            {
                id: `html-content-${Date.now()}`,
                type: 'html',
                content: htmlString,
                styles: {
                    fontSize: '16px',
                    lineHeight: '1.6',
                    marginBottom: '12px'
                }
            }
        ];

        return {
            contentType: 'html',
            blocks,
            metadata: {
                contentLength: htmlString.length
            }
        };
    }
}

export default DataIngestionService;
