import mongoose from "mongoose";

const ConversionsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow anonymous conversions
  },
  
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false,
    index: true
  },
  dataType: {
    type: String,
    required: true,
    enum: ['html', 'grapesjs', 'raw'] // Simplified to focus on raw content
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: false
  },
  // Removed sourceUrl since we're focusing on raw HTML/CSS/JS uploads
  sourceType: {
    type: String,
    enum: ['raw', 'grapesjs', 'upload'], // Simplified source types
    required: true
  },
  // Add fields for raw content
  htmlContent: {
    type: String,
    required: false // Raw HTML content
  },
  cssContent: {
    type: String,
    required: false // Raw CSS content
  },
  jsContent: {
    type: String,
    required: false // Raw JavaScript content
  },
  linkUrl: {
    type: String,
    required: false // Website URL to scrape
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  fileSize: {
    type: Number,
    required: false // in bytes
  },
  filePath: {
    type: String,
    required: false // Path to stored PDF file
  },
  originalFilePath: {
    type: String,
    required: false // Path to original uploaded file
  },
  storageInfo: {
    type: Object,
    required: false, // Storage information (local, R2, etc.)
    default: null
  },
  supabaseFileId: {
    type: String,
    required: false // Supabase storage file ID
  },
  processingTime: {
    type: Number,
    required: false // in milliseconds
  },
  errorMessage: {
    type: String,
    required: false
  },
  errorDetails: {
    type: Object,
    required: false // Additional error information
  },
  processingProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  conversionOptions: {
    type: Object,
    required: false // Store conversion settings/preferences
  },
  metadata: {
    type: Object,
    required: false // Additional file metadata
  },
  tags: {
    type: Array,
    default: []
  },
  description: {
    type: String,
    required: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date,
    required: false
  },
  creditsUsed: {
    type: Number,
    required: false // Number of credits used for this conversion
  },
  expiresAt: {
    type: Date,
    required: false // For temporary files
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    required: false
  },
  startedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ConversionsSchema.index({ userId: 1, createdAt: -1 });
ConversionsSchema.index({ status: 1, createdAt: -1 });
ConversionsSchema.index({ dataType: 1, createdAt: -1 });
ConversionsSchema.index({ fileName: 1 });
// Removed sourceUrl index since we're not using URLs
ConversionsSchema.index({ isArchived: 1, createdAt: -1 });
ConversionsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Virtual for formatted file size
ConversionsSchema.virtual('formattedFileSize').get(function() {
  if (!this.fileSize) return 'Unknown';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(k));
  return parseFloat((this.fileSize / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
});

// Virtual for download URL
ConversionsSchema.virtual('downloadUrl').get(function() {
  if (this.status === 'completed' && this.filePath) {
    return `/api/conversions/download/${this._id}`;
  }
  return null;
});

// Virtual for processing duration
ConversionsSchema.virtual('processingDuration').get(function() {
  if (this.startedAt && this.completedAt) {
    return this.completedAt.getTime() - this.startedAt.getTime();
  }
  return null;
});

// Pre-save middleware to update timestamps
ConversionsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set startedAt when status changes to processing
  if (this.isModified('status') && this.status === 'processing' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Set completedAt when status changes to completed or failed
  if (this.isModified('status') && (this.status === 'completed' || this.status === 'failed') && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Static method to get user's conversion stats
ConversionsSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        totalFileSize: { $sum: '$fileSize' },
        totalProcessingTime: { $sum: '$processingTime' }
      }
    }
  ]);
};

// Instance method to increment download count
ConversionsSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Instance method to archive conversion
ConversionsSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Instance method to restore from archive
ConversionsSchema.methods.restore = function() {
  this.isArchived = false;
  this.archivedAt = undefined;
  return this.save();
};

export default mongoose.model('Conversion', ConversionsSchema);
