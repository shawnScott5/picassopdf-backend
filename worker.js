import PDFWorkerService from './services/PDFWorkerService.js';
import db from './config/db.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting PDF Worker Service...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Process ID: ${process.pid}`);
console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

// Connect to database
db();

// Initialize worker service
let workerService;

async function startWorkers() {
    try {
        workerService = new PDFWorkerService();
        console.log('✅ PDF Worker Service started successfully');
        
        // Log worker stats every 60 seconds
        setInterval(() => {
            const stats = workerService.getWorkerStats();
            const memUsage = process.memoryUsage();
            console.log(`📊 Worker Stats: ${stats.activeJobs}/${stats.totalWorkers} active | Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        }, 60000);
        
    } catch (error) {
        console.error('❌ Failed to start PDF Worker Service:', error);
        process.exit(1);
    }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down workers gracefully...');
    
    if (workerService) {
        await workerService.close();
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down workers gracefully...');
    
    if (workerService) {
        await workerService.close();
    }
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception in worker:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection in worker at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the workers
startWorkers();
