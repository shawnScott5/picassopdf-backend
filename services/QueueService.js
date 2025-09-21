import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

class QueueService {
    constructor() {
        // Redis connection configuration
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0,
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
            // AWS ElastiCache compatibility
            family: 4,
            keepAlive: true,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        // Initialize Redis connection
        this.redis = new Redis(this.redisConfig);
        
        // Initialize queues
        this.pdfQueue = new Queue('pdf-generation', {
            connection: this.redis,
            defaultJobOptions: {
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 50,      // Keep last 50 failed jobs
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            },
        });

        // Queue event listeners
        this.setupQueueEvents();
    }

    setupQueueEvents() {
        this.pdfQueue.on('error', (error) => {
            console.error('❌ PDF Queue Error:', error);
        });

        this.pdfQueue.on('waiting', (jobId) => {
            console.log(`⏳ Job ${jobId} is waiting`);
        });

        this.pdfQueue.on('active', (job) => {
            console.log(`🔄 Job ${job.id} started processing`);
        });

        this.pdfQueue.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed in ${Date.now() - job.processedOn}ms`);
        });

        this.pdfQueue.on('failed', (job, error) => {
            console.error(`❌ Job ${job?.id} failed:`, error.message);
        });
    }

    /**
     * Add PDF generation job to queue
     */
    async addPDFJob(jobData, options = {}) {
        const jobOptions = {
            priority: options.priority || 0,
            delay: options.delay || 0,
            removeOnComplete: options.removeOnComplete !== undefined ? options.removeOnComplete : 10,
            removeOnFail: options.removeOnFail !== undefined ? options.removeOnFail : 5,
            ...options
        };

        try {
            const job = await this.pdfQueue.add('generate-pdf', jobData, jobOptions);
            
            console.log(`📋 PDF job queued: ${job.id}`);
            return {
                jobId: job.id,
                status: 'queued',
                estimatedWaitTime: await this.getEstimatedWaitTime()
            };
        } catch (error) {
            console.error('Failed to add PDF job to queue:', error);
            throw error;
        }
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId) {
        try {
            const job = await this.pdfQueue.getJob(jobId);
            
            if (!job) {
                return { status: 'not_found' };
            }

            const state = await job.getState();
            const progress = job.progress;

            return {
                id: job.id,
                status: state,
                progress: progress,
                data: job.data,
                result: job.returnvalue,
                failedReason: job.failedReason,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                createdAt: new Date(job.timestamp),
                attempts: job.attemptsMade,
                maxAttempts: job.opts.attempts
            };
        } catch (error) {
            console.error('Failed to get job status:', error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                this.pdfQueue.getWaiting(),
                this.pdfQueue.getActive(),
                this.pdfQueue.getCompleted(),
                this.pdfQueue.getFailed(),
                this.pdfQueue.getDelayed()
            ]);

            return {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
                delayed: delayed.length,
                total: waiting.length + active.length + completed.length + failed.length + delayed.length
            };
        } catch (error) {
            console.error('Failed to get queue stats:', error);
            return {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
                total: 0,
                error: error.message
            };
        }
    }

    /**
     * Estimate wait time based on queue length and processing rate
     */
    async getEstimatedWaitTime() {
        try {
            const stats = await this.getQueueStats();
            const avgProcessingTime = 30; // seconds (estimate)
            // Dynamic worker calculation for Heroku
            const concurrentWorkers = process.env.PDF_WORKERS || 
                (process.env.WEB_CONCURRENCY ? Math.floor(process.env.WEB_CONCURRENCY * 0.75) : 1);
            
            const waitingJobs = stats.waiting + stats.active;
            const estimatedSeconds = Math.ceil(waitingJobs * avgProcessingTime / concurrentWorkers);
            
            return Math.min(estimatedSeconds, 300); // Cap at 5 minutes
        } catch (error) {
            return 60; // Default to 1 minute if calculation fails
        }
    }

    /**
     * Clean old jobs
     */
    async cleanQueue() {
        try {
            await this.pdfQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // Clean completed jobs older than 24h
            await this.pdfQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // Clean failed jobs older than 7 days
            console.log('🧹 Queue cleaned successfully');
        } catch (error) {
            console.error('Failed to clean queue:', error);
        }
    }

    /**
     * Pause queue processing
     */
    async pauseQueue() {
        await this.pdfQueue.pause();
        console.log('⏸️ PDF queue paused');
    }

    /**
     * Resume queue processing
     */
    async resumeQueue() {
        await this.pdfQueue.resume();
        console.log('▶️ PDF queue resumed');
    }

    /**
     * Close connections
     */
    async close() {
        await this.pdfQueue.close();
        await this.redis.disconnect();
        console.log('🔌 Queue service connections closed');
    }
}

export default QueueService;
