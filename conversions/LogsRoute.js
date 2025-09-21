import express from 'express';
import LogsSchema from './LogsSchema.js';
import authenticate from '../middlewares/authenticate.js';

const router = express.Router();

// Get logs with pagination and filtering
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch logs'
            });
        }
        
        // Build filters - use companyId if available, otherwise use userId
        const filters = {};
        if (companyId) {
            filters.companyId = companyId;
        } else if (userId) {
            filters.userId = userId;
        }
        if (status && status !== 'all') {
            filters.status = status;
        }
        
        if (search) {
            filters.$or = [
                { requestId: { $regex: search, $options: 'i' } },
                { apiEndpoint: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Get logs with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [logs, total] = await Promise.all([
            LogsSchema.find(filters)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            LogsSchema.countDocuments(filters)
        ]);
        
        const result = {
            logs,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        };
        
        res.json({
            success: true,
            message: 'Logs retrieved successfully',
            data: result.logs,
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
        
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs',
            error: error.message
        });
    }
});

// Get log by ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch log'
            });
        }
        
        const query = { _id: id };
        if (companyId) {
            query.companyId = companyId;
        } else if (userId) {
            query.userId = userId;
        }
        
        const log = await LogsSchema.findOne(query);
        
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Log not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Log retrieved successfully',
            data: log
        });
        
    } catch (error) {
        console.error('Error fetching log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch log',
            error: error.message
        });
    }
});

// Get logs statistics
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch log statistics'
            });
        }
        
        const matchQuery = {};
        if (companyId) {
            matchQuery.companyId = companyId;
        } else if (userId) {
            matchQuery.userId = userId;
        }
        
        const stats = await LogsSchema.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalLogs: { $sum: 1 },
                    successfulConversions: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    failedConversions: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                    totalCreditsUsed: { $sum: '$creditUsed' },
                    totalInputSize: { $sum: '$inputSizeBytes' },
                    totalOutputSize: { $sum: { $cond: ['$outputSizeBytes', '$outputSizeBytes', 0] } },
                    avgGenerationTime: { $avg: '$generationTimeMs' }
                }
            }
        ]);
        
        const result = stats[0] || {
            totalLogs: 0,
            successfulConversions: 0,
            failedConversions: 0,
            totalCreditsUsed: 0,
            totalInputSize: 0,
            totalOutputSize: 0,
            avgGenerationTime: 0
        };
        
        res.json({
            success: true,
            message: 'Log statistics retrieved successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Error fetching log statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch log statistics',
            error: error.message
        });
    }
});

// Get logs by date range
router.get('/date-range', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch logs by date range'
            });
        }
        
        const filters = {};
        if (companyId) {
            filters.companyId = companyId;
        } else if (userId) {
            filters.userId = userId;
        }
        
        if (startDate && endDate) {
            filters.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [logs, total] = await Promise.all([
            LogsSchema.find(filters)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            LogsSchema.countDocuments(filters)
        ]);
        
        const result = {
            logs,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        };
        
        res.json({
            success: true,
            message: 'Logs retrieved successfully',
            data: result.logs,
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
        
    } catch (error) {
        console.error('Error fetching logs by date range:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs by date range',
            error: error.message
        });
    }
});

// Delete log by ID
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to delete log'
            });
        }
        
        const query = { _id: id };
        if (companyId) {
            query.companyId = companyId;
        } else if (userId) {
            query.userId = userId;
        }
        
        const log = await LogsSchema.findOneAndDelete(query);
        
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Log not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Log deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete log',
            error: error.message
        });
    }
});

export default router;
