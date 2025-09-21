import express from 'express';
import UserRoute from './users/UserRoute.js';
import InfluencersRoute from './influencers/InfluencersRoute.js';
import ListsRoute from './lists/ListsRoute.js';
import TasksRoute from './tasks/TasksRoute.js';
import AdminRoute from './admin/AdminRoute.js';
import bodyParser from 'body-parser';
import UploadsRoute from './uploads/UploadsRoute.js';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './config/config.js';
import db from './config/db.js';
import ActionsRoute from './actions/ActionsRoute.js';
import CampaingsRoute from './campaigns/CampaignsRoutes.js';
import NotesRoute from './notes/NotesRoute.js';
import helmet from 'helmet';
import fileupload from 'express-fileupload';
import EventsRoute from './events/EventsRoutes.js';
import SubscribeRoute from './subscribe/SubscribeRoute.js';
import path from 'path';
import url from 'url';
import SubscribeStripeScaleRoute from './subscribe-stripe-scale/SubscribeStripeScaleRoute.js';
import SubscribeStripeRoute from './subscribe-stripe/SubscribeStripeRoute.js';
import SubscribeStripeCustomRoute from './subscribe-stripe-custom/SubscribeStripeCustomRoute.js';
import AudiobookRoute from './audiobooks/AudiobookRoute.js';
import ConversionsRoute from './conversions/ConversionsRoute.js';
import LogsRoute from './conversions/LogsRoute.js';
import ApiKeysRoute from './api-keys/ApiKeysRoute.js';
import OrganizationRoute from './organizations/OrganizationRoute.js';
import conversionsController from './conversions/ConversionsController.js';
import apiKeyAuth from './middlewares/apiKeyAuth.js';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Get the directory name of the current module
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Performance optimizations
app.set('trust proxy', 1);
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API endpoints
    crossOriginEmbedderPolicy: false
}));

// Middleware with performance optimizations
app.use(express.json({ 
    limit: '50mb', // Reduced from 1gb for better memory management
    parameterLimit: 50000,
    extended: true
}));
app.use(express.urlencoded({ 
    limit: '50mb', 
    extended: true,
    parameterLimit: 50000
}));
app.use(fileupload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    abortOnLimit: true,
    createParentPath: true
}));

// CORS with performance optimizations
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 
        ['https://picassopdf.com', 'https://www.picassopdf.com'] : 
        true,
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400 // Cache preflight for 24 hours
}));

app.use(bodyParser.json({
    limit: '50mb',
    parameterLimit: 50000
}));

// V1 API Routes - Direct routes to avoid Express router conflicts

app.post('/v1/convert/pdf', apiKeyAuth, async (req, res, next) => {
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                success: false,
                message: 'Request timeout - PDF generation took too long',
                error: 'TIMEOUT'
            });
        }
    }, 60000);

    try {
        await conversionsController.convertHTMLToPDFAPIPublic(req, res, next);
        clearTimeout(timeout);
    } catch (error) {
        clearTimeout(timeout);
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

app.get('/v1/status', async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        let clusterStatus = 'Not initialized';
        if (conversionsController.cluster) {
            clusterStatus = `Active (${conversionsController.cluster.workersByBrowser.size} workers)`;
        }
        
        const cacheStats = {
            size: conversionsController.pdfCache?.size || 0,
            maxSize: conversionsController.maxCacheSize || 0,
            hitRate: 'N/A'
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
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get server status',
            error: error.message
        });
    }
});

app.use('/api/actions', ActionsRoute);
app.use('/api/admin', AdminRoute);
app.use('/api/campaigns', CampaingsRoute);
app.use('/api/users', UserRoute);
app.use('/api/influencers', InfluencersRoute);
app.use('/api/lists', ListsRoute);
app.use('/api/events', EventsRoute);
app.use('/api/tasks', TasksRoute);
app.use('/api/notes', NotesRoute);
app.use('/api/uploads', UploadsRoute);
app.use('/api/subscribe', SubscribeRoute);
app.use('/api/subscribe-stripe-pro', SubscribeStripeRoute);
app.use('/api/subscribe-stripe-scale', SubscribeStripeScaleRoute);
app.use('/api/subscribe-stripe-custom', SubscribeStripeCustomRoute);
app.use('/api/audiobooks', AudiobookRoute);
app.use('/api/conversions', ConversionsRoute);
app.use('/api/v1', ConversionsRoute);
app.use('/api/logs', LogsRoute);
app.use('/api/api-keys', ApiKeysRoute);
app.use('/api/organizations', OrganizationRoute);

// Frontend is deployed separately (Netlify), no static file serving needed

// Connect to the database
db();

// Start the server
const server = app.listen(PORT, () => {
    console.log(`🚀 PicassoPDF API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Process ID: ${process.pid}`);
    console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Check for system Chromium availability
    try {
        const chromiumPath = execSync("which chromium || which chromium-browser").toString().trim();
        console.log("🖥️ System Chromium found at:", chromiumPath);
    } catch (error) {
        console.log("❌ No system Chromium found in container");
        console.log("🔍 Will use Playwright bundled browser");
    }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    
    server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Close database connection
        mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
        console.log('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    
    server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Close database connection
        mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});