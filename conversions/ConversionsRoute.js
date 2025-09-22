import express from 'express';
import conversionsController, { fetchAllConvertedPDFs } from './ConversionsController.js';
import authenticate from '../middlewares/authenticate.js';
import apiKeyAuth from '../middlewares/apiKeyAuth.js';

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
        
        // Enhanced error handling
        if (error.name === 'TimeoutError') {
            if (!res.headersSent) {
                return res.status(408).json({
                    success: false,
                    message: 'PDF generation timed out',
                    error: 'TIMEOUT'
                });
            }
        } else if (error.message && error.message.includes('memory')) {
            if (!res.headersSent) {
                return res.status(507).json({
                    success: false,
                    message: 'Insufficient memory to process request',
                    error: 'MEMORY_ERROR'
                });
            }
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