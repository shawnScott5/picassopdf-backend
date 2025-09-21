import mongoose from 'mongoose';

const AudiobookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    originalFile: {
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    },
    extractedText: {
        type: String,
        default: ''
    },
    chapters: [{
        title: String,
        content: String,
        startTime: Number,
        endTime: Number,
        audioFile: String,
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        },
        processingProgress: {
            type: Number,
            default: 0
        }
    }],
    voiceSettings: {
        voiceId: String,
        speed: {
            type: Number,
            default: 1.0
        },
        pitch: {
            type: Number,
            default: 0
        },
        volume: {
            type: Number,
            default: 1.0
        }
    },
    audioSettings: {
        format: {
            type: String,
            enum: ['mp3', 'wav', 'm4b'],
            default: 'mp3'
        },
        quality: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        sampleRate: {
            type: Number,
            default: 22050
        }
    },
    finalAudioFile: {
        path: String,
        size: Number,
        duration: Number
    },
    status: {
        type: String,
        enum: ['uploaded', 'extracting', 'editing', 'processing', 'completed', 'failed'],
        default: 'uploaded'
    },
    processingProgress: {
        type: Number,
        default: 0
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
AudiobookSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Audiobook', AudiobookSchema);

