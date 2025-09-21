class DataPreprocessorService {
    constructor() {
        this.blockTemplates = this.initializeBlockTemplates();
    }

    /**
     * Initialize block templates for different content types
     * @returns {Object} Block templates
     */
    initializeBlockTemplates() {
        return {
            heading: {
                html: (block) => `<h${block.level} id="${block.id}" class="content-block heading-block">${block.content}</h${block.level}>`,
                css: (block) => this.generateCSS(block.styles)
            },
            text: {
                html: (block) => `<p id="${block.id}" class="content-block text-block">${block.content}</p>`,
                css: (block) => this.generateCSS(block.styles)
            },
            list: {
                html: (block) => {
                    const tag = block.listType === 'number' ? 'ol' : 'ul';
                    return `<${tag} id="${block.id}" class="content-block list-block">
                        <li>${block.content}</li>
                    </${tag}>`;
                },
                css: (block) => this.generateCSS(block.styles)
            },
            image: {
                html: (block) => `<img id="${block.id}" class="content-block image-block" src="${block.content}" alt="${block.alt || ''}" />`,
                css: (block) => this.generateCSS(block.styles)
            },
            code: {
                html: (block) => `<pre id="${block.id}" class="content-block code-block"><code class="language-${block.language || 'text'}">${this.escapeHtml(block.content)}</code></pre>`,
                css: (block) => this.generateCSS(block.styles)
            },
            table: {
                html: (block) => this.generateTableHTML(block),
                css: (block) => this.generateTableCSS(block)
            },
            toc: {
                html: (block) => `<div id="${block.id}" class="content-block toc-block">${block.content}</div>`,
                css: (block) => this.generateCSS(block.styles)
            },
            divider: {
                html: (block) => `<hr id="${block.id}" class="content-block divider-block" />`,
                css: (block) => this.generateCSS(block.styles)
            },
            html: {
                html: (block) => `<div id="${block.id}" class="content-block html-block">${block.content}</div>`,
                css: (block) => this.generateCSS(block.styles)
            }
        };
    }

    /**
     * Main method to preprocess structured data into HTML/CSS for GrapesJS
     * @param {Object} structuredData - Data from DataIngestionService
     * @param {Object} options - Preprocessing options
     * @returns {Object} HTML and CSS ready for GrapesJS
     */
    async preprocessData(structuredData, options = {}) {
        try {
            console.log('Preprocessing structured data:', structuredData.contentType);

            const { blocks = [], metadata = {} } = structuredData;
            const htmlBlocks = [];
            const cssBlocks = [];
            const grapesJSComponents = [];

            // Process each block
            for (const block of blocks) {
                const processedBlock = this.processBlock(block, options);
                if (processedBlock) {
                    htmlBlocks.push(processedBlock.html);
                    cssBlocks.push(processedBlock.css);
                    grapesJSComponents.push(processedBlock.component);
                }
            }

            // Generate final HTML and CSS
            const html = this.generateFinalHTML(htmlBlocks, options);
            const css = this.generateFinalCSS(cssBlocks, options);

            return {
                success: true,
                html,
                css,
                components: grapesJSComponents,
                metadata: {
                    ...metadata,
                    blockCount: blocks.length,
                    processedAt: new Date()
                }
            };

        } catch (error) {
            console.error('Data preprocessing error:', error);
            throw new Error(`Failed to preprocess data: ${error.message}`);
        }
    }

    /**
     * Process individual block
     * @param {Object} block - Structured block
     * @param {Object} options - Processing options
     * @returns {Object} Processed block with HTML, CSS, and GrapesJS component
     */
    processBlock(block, options = {}) {
        const template = this.blockTemplates[block.type];
        if (!template) {
            console.warn(`No template found for block type: ${block.type}`);
            return null;
        }

        try {
            const html = template.html(block);
            const css = template.css(block);
            const component = this.createGrapesJSComponent(block, html, css);

            return {
                html,
                css,
                component
            };

        } catch (error) {
            console.error(`Error processing block ${block.id}:`, error);
            return null;
        }
    }

    /**
     * Generate table HTML
     * @param {Object} block - Table block
     * @returns {string} Table HTML
     */
    generateTableHTML(block) {
        const { headers = [], rows = [] } = block.content;
        
        let tableHTML = `<table id="${block.id}" class="content-block table-block">`;
        
        // Generate header
        if (headers.length > 0) {
            tableHTML += '<thead><tr>';
            headers.forEach(header => {
                tableHTML += `<th>${header.content}</th>`;
            });
            tableHTML += '</tr></thead>';
        }
        
        // Generate body
        if (rows.length > 0) {
            tableHTML += '<tbody>';
            rows.forEach(row => {
                tableHTML += '<tr>';
                row.forEach(cell => {
                    tableHTML += `<td>${cell.content}</td>`;
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody>';
        }
        
        tableHTML += '</table>';
        return tableHTML;
    }

    /**
     * Generate table CSS
     * @param {Object} block - Table block
     * @returns {string} Table CSS
     */
    generateTableCSS(block) {
        const baseCSS = this.generateCSS(block.styles);
        const tableCSS = `
            .table-block th {
                background-color: #f6f8fa;
                font-weight: bold;
                padding: 12px;
                border: 1px solid #e1e4e8;
                text-align: left;
            }
            .table-block td {
                padding: 12px;
                border: 1px solid #e1e4e8;
            }
            .table-block tr:nth-child(even) {
                background-color: #fafbfc;
            }
        `;
        
        return baseCSS + tableCSS;
    }

    /**
     * Generate CSS from styles object
     * @param {Object} styles - CSS styles object
     * @returns {string} CSS string
     */
    generateCSS(styles = {}) {
        if (!styles || Object.keys(styles).length === 0) {
            return '';
        }

        const cssProperties = Object.entries(styles)
            .map(([property, value]) => {
                // Convert camelCase to kebab-case
                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssProperty}: ${value};`;
            })
            .join(' ');

        return cssProperties;
    }

    /**
     * Create GrapesJS component from block
     * @param {Object} block - Structured block
     * @param {string} html - Block HTML
     * @param {string} css - Block CSS
     * @returns {Object} GrapesJS component definition
     */
    createGrapesJSComponent(block, html, css) {
        return {
            type: 'default',
            tagName: 'div',
            content: html,
            style: css,
            attributes: {
                'data-block-id': block.id,
                'data-source': block.source || 'unknown',
                'data-source-id': block.sourceId || '',
                'data-block-type': block.type
            },
            components: [],
            traits: [
                {
                    type: 'text',
                    name: 'block-id',
                    label: 'Block ID',
                    default: block.id
                },
                {
                    type: 'text',
                    name: 'source',
                    label: 'Source',
                    default: block.source || 'unknown'
                }
            ]
        };
    }

    /**
     * Generate final HTML document
     * @param {Array} htmlBlocks - Array of HTML blocks
     * @param {Object} options - Options
     * @returns {string} Complete HTML document
     */
    generateFinalHTML(htmlBlocks, options = {}) {
        const title = options.title || 'Generated Document';
        const blocksHTML = htmlBlocks.join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .content-block {
            margin-bottom: 16px;
        }
        .content-block:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
    ${blocksHTML}
</body>
</html>`;
    }

    /**
     * Generate final CSS
     * @param {Array} cssBlocks - Array of CSS blocks
     * @param {Object} options - Options
     * @returns {string} Complete CSS
     */
    generateFinalCSS(cssBlocks, options = {}) {
        const baseCSS = `
            /* Base styles for content blocks */
            .content-block {
                position: relative;
                margin-bottom: 16px;
            }
            
            .content-block:last-child {
                margin-bottom: 0;
            }
            
            /* Heading styles */
            .heading-block {
                color: #24292e;
                margin-top: 24px;
                margin-bottom: 16px;
                font-weight: 600;
                line-height: 1.25;
            }
            
            /* Text styles */
            .text-block {
                margin-bottom: 16px;
                line-height: 1.6;
            }
            
            /* List styles */
            .list-block {
                margin-bottom: 16px;
                padding-left: 2em;
            }
            
            .list-block li {
                margin-bottom: 0.25em;
            }
            
            /* Image styles */
            .image-block {
                display: block;
                max-width: 100%;
                height: auto;
                margin: 16px 0;
            }
            
            /* Code styles */
            .code-block {
                background-color: #f6f8fa;
                border: 1px solid #e1e4e8;
                border-radius: 6px;
                padding: 16px;
                overflow-x: auto;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 14px;
                line-height: 1.45;
            }
            
            /* Table styles */
            .table-block {
                border-collapse: collapse;
                width: 100%;
                margin: 16px 0;
            }
            
            .table-block th,
            .table-block td {
                border: 1px solid #e1e4e8;
                padding: 12px;
                text-align: left;
            }
            
            .table-block th {
                background-color: #f6f8fa;
                font-weight: 600;
            }
            
            /* TOC styles */
            .toc-block {
                background-color: #f6f8fa;
                border: 1px solid #e1e4e8;
                border-radius: 6px;
                padding: 16px;
                margin: 16px 0;
            }
            
            /* Divider styles */
            .divider-block {
                border: none;
                border-top: 1px solid #e1e4e8;
                margin: 20px 0;
            }
            
            /* HTML block styles */
            .html-block {
                margin: 16px 0;
            }
        `;

        const blockCSS = cssBlocks.join('\n');
        
        return baseCSS + '\n' + blockCSS;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * Create GrapesJS initial content from structured data
     * @param {Object} structuredData - Structured data
     * @param {Object} options - Options
     * @returns {Object} GrapesJS initial content
     */
    createGrapesJSContent(structuredData, options = {}) {
        const { blocks = [] } = structuredData;
        const components = [];

        for (const block of blocks) {
            const processedBlock = this.processBlock(block, options);
            if (processedBlock) {
                components.push(processedBlock.component);
            }
        }

        return {
            html: this.generateFinalHTML([], options),
            css: this.generateFinalCSS([], options),
            components
        };
    }

    /**
     * Convert GrapesJS content back to structured format
     * @param {Object} grapesJSContent - GrapesJS content
     * @returns {Object} Structured data
     */
    convertGrapesJSToStructured(grapesJSContent) {
        const { components = [] } = grapesJSContent;
        const blocks = [];

        for (const component of components) {
            const block = this.convertComponentToBlock(component);
            if (block) {
                blocks.push(block);
            }
        }

        return {
            contentType: 'grapesjs',
            blocks,
            metadata: {
                convertedAt: new Date(),
                blockCount: blocks.length
            }
        };
    }

    /**
     * Convert GrapesJS component to structured block
     * @param {Object} component - GrapesJS component
     * @returns {Object|null} Structured block
     */
    convertComponentToBlock(component) {
        const attributes = component.attributes || {};
        const blockId = attributes['data-block-id'] || `block-${Date.now()}`;
        const source = attributes['data-source'] || 'grapesjs';
        const sourceId = attributes['data-source-id'] || '';
        const blockType = attributes['data-block-type'] || 'text';

        // Extract content from component
        let content = '';
        if (component.content) {
            // Remove HTML tags to get plain text content
            content = component.content.replace(/<[^>]*>/g, '');
        }

        // Extract styles from component
        const styles = component.style || {};

        return {
            id: blockId,
            type: blockType,
            content,
            source,
            sourceId,
            styles
        };
    }
}

export default DataPreprocessorService;
