import mongoose from 'mongoose';

const LogsSchema = new mongoose.Schema({
    // Core identification
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true
    },
    
    // Company and user identification
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for API calls without user context
    },
    
    // Request tracking
    requestId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Conversion details
    inputType: {
        type: String,
        required: true,
        enum: ['html', 'url', 'file', 'text'],
        default: 'html'
    },
    
    inputSizeBytes: {
        type: Number,
        required: true,
        min: 0
    },
    
    outputSizeBytes: {
        type: Number,
        required: false,
        min: 0
    },
    
    // Performance metrics
    generationTimeMs: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Business logic
    creditUsed: {
        type: Number,
        required: true,
        min: 0,
        default: 1
    },
    
    saveToVault: {
        type: Boolean,
        required: true,
        default: false
    },
    
    storageRef: {
        type: String,
        required: false // Only if saveToVault is true
    },
    
    // API information
    apiEndpoint: {
        type: String,
        required: true,
        default: '/api/v1/pdf/convert'
    },
    
    // Status and results
    status: {
        type: String,
        required: true,
        enum: ['success', 'failed', 'processing'],
        default: 'processing'
    },
    
    errorMessage: {
        type: String,
        required: false // Only if status is 'failed'
    },
    
    // Timestamps
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    
    // Additional metadata
    userAgent: {
        type: String,
        required: false
    },
    
    ipAddress: {
        type: String,
        required: false
    },
    
    // Conversion options used
    conversionOptions: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'logs' // Explicitly name the collection
});

// Indexes for better query performance
LogsSchema.index({ companyId: 1, timestamp: -1 });
LogsSchema.index({ status: 1, timestamp: -1 });
LogsSchema.index({ requestId: 1 });
LogsSchema.index({ timestamp: -1 });

// Virtual for formatted file sizes
LogsSchema.virtual('inputSizeFormatted').get(function() {
    return this.formatFileSize(this.inputSizeBytes);
});

LogsSchema.virtual('outputSizeFormatted').get(function() {
    return this.outputSizeBytes ? this.formatFileSize(this.outputSizeBytes) : null;
});

// Instance method to format file size
LogsSchema.methods.formatFileSize = function(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Static method to get logs with pagination
LogsSchema.statics.getLogsWithPagination = async function(companyId, page = 1, limit = 10, filters = {}) {
    const skip = (page - 1) * limit;
    
    const query = { companyId, ...filters };
    
    const [logs, total] = await Promise.all([
        this.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        this.countDocuments(query)
    ]);
    
    return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
};

export default mongoose.model('Logs', LogsSchema);
