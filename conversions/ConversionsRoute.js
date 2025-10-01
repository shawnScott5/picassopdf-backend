import express from 'express';
import multer from 'multer';
import conversionsController, { fetchAllConvertedPDFs } from './ConversionsController.js';
import authenticate from '../middlewares/authenticate.js';
import apiKeyAuth from '../middlewares/apiKeyAuth.js';

// Configure multer for multipart/form-data
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        fieldSize: 10 * 1024 * 1024  // 10MB limit for text fields
    }
});

const ConversionsRoute = express.Router();

ConversionsRoute.get('/', authenticate, fetchAllConvertedPDFs);

// Download PDF endpoint
ConversionsRoute.get('/download/:id', authenticate, async (req, res, next) => {
    try {
        await conversionsController.downloadPDF(req, res, next);
    } catch (error) {
        next(error);
    }
});

// HTML to PDF conversion endpoint (calls convertHTMLToPDFAPI)
ConversionsRoute.post('/convert-html-to-pdf', authenticate, async (req, res, next) => {
    try {
        await conversionsController.convertHTMLToPDFAPI(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Get page break options endpoint
ConversionsRoute.get('/page-break-options', async (req, res, next) => {
    try {
        await conversionsController.getPageBreakOptionsAPI(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Delete PDF endpoint
ConversionsRoute.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await conversionsController.deletePDF(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Multipart/form-data endpoint for HTML file uploads
// POST /convert/pdf/multipart - Convert HTML file to PDF with API key authentication
ConversionsRoute.post('/convert/pdf/multipart', apiKeyAuth, upload.single('html_file'), async (req, res, next) => {
    try {
        // Handle multipart/form-data request
        const { html, css, javascript, url, options, ai_options } = req.body;
        const htmlFile = req.file;
        
        let htmlContent = html;
        
        // If HTML file is uploaded, read its content
        if (htmlFile) {
            htmlContent = htmlFile.buffer.toString('utf8');
            console.log('HTML file uploaded:', htmlFile.originalname, 'Size:', htmlFile.size);
        }
        
        // Parse JSON strings if they exist
        const parsedOptions = options ? JSON.parse(options) : {};
        const parsedAiOptions = ai_options ? JSON.parse(ai_options) : {};
        
        // Create a new request body for the existing API
        req.body = {
            html: htmlContent,
            css: css || '',
            javascript: javascript || '',
            url: url || null,
            options: parsedOptions,
            ai_options: parsedAiOptions
        };
        
        // Call the existing public API handler
        await conversionsController.convertHTMLToPDFAPIPublic(req, res, next);
        
    } catch (error) {
        console.error('Multipart conversion error:', error);
        res.status(400).json({
            success: false,
            message: 'Invalid multipart/form-data request',
            error: error.message
        });
    }
});

// Public API v1 endpoint for external developers
// POST /v1/convert/pdf - Convert HTML to PDF with API key authentication
ConversionsRoute.post('/convert/pdf', apiKeyAuth, async (req, res, next) => {
    // Set timeout for the request (5 minutes for large documents)
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                success: false,
                message: 'Request timeout - PDF generation took too long (5+ minutes)',
                error: 'TIMEOUT'
            });
        }
    }, 300000);

    try {
        await conversionsController.convertHTMLToPDFAPIPublic(req, res, next);
        clearTimeout(timeout);
    } catch (error) {
        clearTimeout(timeout);
        
        // Enhanced error handling with detailed categorization
        if (!res.headersSent) {
            // Determine error code and status
            let errorCode = error.code || 'CONVERSION_FAILED';
            let statusCode = error.statusCode || 500;
            let message = error.message || 'PDF generation failed';
            let suggestion = error.suggestion;
            
            // Special handling for specific error types
            if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
                errorCode = 'TIMEOUT';
                statusCode = 408;
                message = 'PDF generation timed out';
                suggestion = 'Try simplifying your content or reducing complexity';
            } else if (error.message?.includes('memory')) {
                errorCode = 'OUT_OF_MEMORY';
                statusCode = 507;
                message = 'Insufficient memory to process request';
                suggestion = 'Reduce the size or complexity of your HTML content';
            }
            
            return res.status(statusCode).json({
                success: false,
                error: {
                    code: errorCode,
                    message: message,
                    ...(suggestion && { suggestion }),
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        next(error);
    }
});

// Async PDF generation endpoint (returns job ID)
ConversionsRoute.post('/convert/pdf/async', apiKeyAuth, async (req, res, next) => {
    try {
        await conversionsController.convertHTMLToPDFAsync(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Job status endpoint
ConversionsRoute.get('/jobs/:jobId', async (req, res, next) => {
    try {
        await conversionsController.getJobStatus(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Queue statistics endpoint
ConversionsRoute.get('/queue/stats', async (req, res, next) => {
    try {
        await conversionsController.getQueueStats(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Performance monitoring endpoint
ConversionsRoute.get('/status', async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        // Get cluster status if available
        let clusterStatus = 'Not initialized';
        if (conversionsController.cluster) {
            clusterStatus = `Active (${conversionsController.cluster.workersByBrowser.size} workers)`;
        }
        
        // Get cache stats
        const cacheStats = {
            size: conversionsController.pdfCache?.size || 0,
            maxSize: conversionsController.maxCacheSize || 0,
            hitRate: 'N/A' // Would need to track hits/misses for actual rate
        };
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
            memory: {
                used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
                rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
            },
            cluster: clusterStatus,
            cache: cacheStats,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            pid: process.pid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get system status',
            error: error.message
        });
    }
});

export default ConversionsRoute;