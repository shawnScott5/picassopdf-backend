import { Worker } from 'bullmq';
import Redis from 'ioredis';
import ConversionsController from '../conversions/ConversionsController.js';
import ConversionsSchema from '../conversions/ConversionsSchema.js';
import LogsSchema from '../conversions/LogsSchema.js';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFWorkerService {
    constructor() {
        // Redis connection (same config as QueueService)
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0,
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
            family: 4,
            keepAlive: true,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        this.redis = new Redis(this.redisConfig);
        
        // Initialize conversions controller for PDF generation
        this.conversionsController = new ConversionsController();
        
        // Dynamic worker configuration - AWS controls via resource allocation
        this.concurrency = this.calculateOptimalWorkerCount();
        this.workers = [];
        
        this.initializeWorkers();
    }

    /**
     * Calculate optimal worker count based on available system resources
     * AWS effectively controls this through container sizing
     */
    calculateOptimalWorkerCount() {
        try {
            // Get system memory info
            const totalMemoryGB = process.env.ECS_MEMORY_LIMIT ? 
                parseInt(process.env.ECS_MEMORY_LIMIT) / 1024 : // ECS provides memory limit in MB
                require('os').totalmem() / (1024 * 1024 * 1024); // Convert to GB

            // Get CPU info  
            const cpuCount = process.env.ECS_CPU_LIMIT ?
                parseInt(process.env.ECS_CPU_LIMIT) / 1024 : // ECS CPU units (1024 = 1 vCPU)
                require('os').cpus().length;

            // Each worker needs ~0.5 vCPU and ~500MB RAM (they handle multiple browsers)
            const maxWorkersByMemory = Math.floor((totalMemoryGB * 1024) / 500); // 500MB per worker
            const maxWorkersByCPU = Math.floor(cpuCount / 0.5); // 0.5 CPU per worker
            
            // Take the more conservative limit
            const resourceBasedLimit = Math.min(maxWorkersByMemory, maxWorkersByCPU);
            
            // Apply scaling factor for stability
            const scalingFactor = process.env.NODE_ENV === 'production' ? 0.8 : 0.5;
            const calculatedWorkers = Math.floor(resourceBasedLimit * scalingFactor);
            
            // Allow manual override if specified
            const manualOverride = parseInt(process.env.PDF_WORKERS);
            if (manualOverride && manualOverride > 0) {
                console.log(`🎛️ Manual worker override: ${manualOverride} (calculated: ${calculatedWorkers})`);
                return manualOverride;
            }
            
            // Ensure minimum of 1 worker, reasonable maximum
            const finalWorkerCount = Math.max(1, Math.min(calculatedWorkers, 20));
            
            console.log(`👷 Auto-calculated worker count: ${finalWorkerCount}`);
            console.log(`📊 Based on: ${totalMemoryGB.toFixed(1)}GB RAM, ${cpuCount} vCPU`);
            console.log(`💡 Heroku controls this by sizing your dynos`);
            
            return finalWorkerCount;
            
        } catch (error) {
            console.error('Error calculating optimal worker count:', error);
            // Dynamic fallback based on environment
            const envOverride = parseInt(process.env.PDF_WORKERS);
            if (envOverride) return envOverride;
            
            // Calculate based on available resources  
            const cpuCount = process.env.WEB_CONCURRENCY || os.cpus().length;
            if (process.env.NODE_ENV === 'production') {
                return Math.min(Math.floor(cpuCount * 0.75), 8); // Use 75% of CPUs, max 8
            } else {
                return 1; // Single worker in development
            }
        }
    }

    initializeWorkers() {
        // Create multiple workers for concurrent processing
        for (let i = 0; i < this.concurrency; i++) {
            const worker = new Worker(
                'pdf-generation',
                this.processPDFJob.bind(this),
                {
                    connection: this.redis,
                    concurrency: 1, // Each worker handles 1 job at a time
                    limiter: {
                        max: 10, // Max 10 jobs per worker
                        duration: 60 * 1000, // per minute
                    },
                    settings: {
                        stalledInterval: 30 * 1000, // 30 seconds
                        maxStalledCount: 3,
                    },
                }
            );

            // Worker event listeners
            worker.on('ready', () => {
                console.log(`🔧 PDF Worker ${i + 1} ready`);
            });

            worker.on('error', (error) => {
                console.error(`❌ PDF Worker ${i + 1} error:`, error);
            });

            worker.on('stalled', (jobId) => {
                console.warn(`⚠️ PDF Worker ${i + 1} job ${jobId} stalled`);
            });

            this.workers.push(worker);
        }

        console.log(`🚀 Initialized ${this.concurrency} PDF workers`);
    }

    /**
     * Process PDF generation job
     */
    async processPDFJob(job) {
        const startTime = Date.now();
        let conversionRecord = null;
        let logRecord = null;

        try {
            const { 
                html, 
                css, 
                javascript, 
                url, 
                options = {}, 
                ai_options = {},
                companyId,
                userId,
                apiKeyId,
                fileName,
                filePath,
                conversionId,
                logId
            } = job.data;

            console.log(`🔄 Processing PDF job ${job.id} for user ${userId}`);

            // Update job progress
            await job.updateProgress(10);

            // Find existing records
            if (conversionId) {
                conversionRecord = await ConversionsSchema.findById(conversionId);
            }
            if (logId) {
                logRecord = await LogsSchema.findById(logId);
            }

            // Prepare HTML content
            let htmlContent;
            const hasUrl = !!url;
            const hasHtml = !!html;

            await job.updateProgress(20);

            if (hasUrl) {
                // For URLs, fetch content using cluster
                if (this.conversionsController.cluster) {
                    htmlContent = await this.conversionsController.cluster.execute({ url }, async ({ page, data }) => {
                        await page.goto(data.url, { 
                            waitUntil: 'domcontentloaded',
                            timeout: 20000 
                        });
                        return await page.content();
                    });
                } else {
                    // Fallback to single browser
                    if (!this.conversionsController.browser) {
                        await this.conversionsController.initBrowser();
                    }
                    const page = await this.conversionsController.browser.newPage();
                    try {
                        await page.goto(url, { 
                            waitUntil: 'domcontentloaded',
                            timeout: 20000 
                        });
                        htmlContent = await page.content();
                    } finally {
                        await page.close();
                    }
                }
            } else {
                // Use provided HTML
                htmlContent = html;
                
                // Inject custom CSS if provided
                if (css) {
                    htmlContent = `<style>${css}</style>${htmlContent}`;
                }
                
                // Inject custom JavaScript if provided
                if (javascript) {
                    htmlContent = `${htmlContent}<script>${javascript}</script>`;
                }
            }

            await job.updateProgress(40);

            // Check for AI layout repair
            const layoutRepair = ai_options.layout_repair || false;
            if (layoutRepair === true) {
                console.log(`🤖 Applying AI layout repair for job ${job.id}`);
                htmlContent = await this.conversionsController.checkHTMLWithGemini(htmlContent);
            }

            await job.updateProgress(60);

            // Generate PDF with optimized options
            const pdfOptions = {
                format: options.format || 'A4',
                printBackground: true,
                margin: options.margin || {
                    top: '10px',
                    right: '10px',
                    bottom: '10px',
                    left: '10px'
                },
                scale: options.scale || 0.9,
                displayHeaderFooter: options.displayHeaderFooter || false,
                landscape: options.landscape || false,
                width: options.width,
                height: options.height,
                pageRanges: options.pageRanges || '',
                headerTemplate: options.headerTemplate || '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="title"></span></div>',
                footerTemplate: options.footerTemplate || '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
                isUrl: hasUrl
            };

            // Generate PDF using cluster
            const pdfBuffer = await this.conversionsController.generatePDFWithCluster(htmlContent, pdfOptions);
            
            await job.updateProgress(80);

            // Save PDF to file system
            await fsPromises.writeFile(filePath, pdfBuffer);

            // Handle save to vault (Cloudflare R2) if requested
            let storageInfo = null;
            const saveToVault = options.save_to_vault || false;
            
            if (saveToVault && this.conversionsController.r2Enabled) {
                console.log(`☁️ Saving PDF to R2 for job ${job.id}`);
                const r2Result = await this.conversionsController.uploadToR2(pdfBuffer, fileName);
                storageInfo = {
                    provider: 'cloudflare_r2',
                    url: r2Result.url,
                    key: r2Result.key
                };
            }

            await job.updateProgress(90);

            // Update records
            const generationTime = Date.now() - startTime;
            const fileSize = pdfBuffer.length;

            if (conversionRecord) {
                conversionRecord.status = 'completed';
                conversionRecord.fileSize = fileSize;
                conversionRecord.generationTimeMs = generationTime;
                if (storageInfo) {
                    conversionRecord.storageInfo = storageInfo;
                }
                await conversionRecord.save();
            }

            if (logRecord) {
                logRecord.status = 'completed';
                logRecord.fileSize = fileSize;
                logRecord.generationTimeMs = generationTime;
                logRecord.processingTime = generationTime;
                await logRecord.save();
            }

            await job.updateProgress(100);

            console.log(`✅ PDF job ${job.id} completed in ${generationTime}ms`);

            return {
                success: true,
                fileName: fileName,
                filePath: filePath,
                fileSize: fileSize,
                generationTime: generationTime,
                storageInfo: storageInfo
            };

        } catch (error) {
            console.error(`❌ PDF job ${job.id} failed:`, error);

            const generationTime = Date.now() - startTime;

            // Update records with error
            if (conversionRecord) {
                conversionRecord.status = 'failed';
                conversionRecord.errorMessage = error.message;
                conversionRecord.generationTimeMs = generationTime;
                await conversionRecord.save();
            }

            if (logRecord) {
                logRecord.status = 'failed';
                logRecord.errorMessage = error.message;
                logRecord.generationTimeMs = generationTime;
                logRecord.processingTime = generationTime;
                await logRecord.save();
            }

            throw error;
        }
    }

    /**
     * Get worker statistics
     */
    getWorkerStats() {
        return {
            totalWorkers: this.workers.length,
            concurrency: this.concurrency,
            activeJobs: this.workers.reduce((acc, worker) => acc + (worker.running ? 1 : 0), 0)
        };
    }

    /**
     * Gracefully close all workers
     */
    async close() {
        console.log('🛑 Shutting down PDF workers...');
        
        await Promise.all(this.workers.map(async (worker) => {
            await worker.close();
        }));

        await this.redis.disconnect();
        console.log('✅ All PDF workers shut down');
    }
}

export default PDFWorkerService;
