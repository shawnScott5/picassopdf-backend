import ApiKeysSchema from "./ApiKeysSchema.js";
import mongoose from "mongoose";
import UserSchema from "../users/UserSchema.js";
import { requireApiKeyOrganizationAccess } from "../middlewares/roleAuth.js";

const fetchAllApiKeys = async(req, res, next) => {
    try {
        console.log('FETCHING ALL API KEYS......')
        console.log('Query params:', req.query);
        const filter = req.query; // Use req.query instead of req.params
        
        // Get companyId and userId from request (same pattern as LogsRoute and ConversionsController)
        const companyId = req.user?.companyId || req.companyId;
        const userId = req.userId || req.user?.id;
        
        if (!companyId && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID or User ID is required to fetch API keys'
            });
        }
        
        const query = { $and: [] }; // Initialize $and operator as an array
        
        // Filter by companyId if available, otherwise use userId
        if (companyId) {
            query.$and.push({ companyId: companyId });
        } else if (userId) {
            query.$and.push({ userId: userId });
        }
        
        // Add userId filter if provided (for backward compatibility)
        if (filter.userId) {
            query.$and.push({ userId: filter.userId });
        }
        
        // Add companyId filter if provided and not empty
        if (filter.companyId && filter.companyId.trim() !== '') {
            query.$and.push({ companyId: filter.companyId });
        }
        
        // Add organizationId filter if provided and not empty (backward compatibility)
        if (filter.organizationId && filter.organizationId.trim() !== '') {
            query.$and.push({ organizationId: filter.organizationId });
        }
        
        // Always exclude deleted records
        query.$and.push({ isDeleted: false });

        console.log('Final query:', JSON.stringify(query, null, 2));

        // Ensure we have a valid query structure for sorting
        let finalQuery = {};
        if (query.$and.length > 0) {
            finalQuery = { $and: query.$and };
        } else {
            // If no filters, just exclude deleted records
            finalQuery = { isDeleted: false };
        }

        const apiKeys = await ApiKeysSchema.find(finalQuery)
            .sort({ createdAt: -1 }) // Sort by creation date, newest first
            .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
            .limit(parseInt(filter.limit));

        // Double-check the sorting worked by manually sorting if needed
        if (apiKeys.length > 1) {
            const firstKey = apiKeys[0];
            const lastKey = apiKeys[apiKeys.length - 1];
            console.log('First key (should be newest):', { name: firstKey.name, createdAt: firstKey.createdAt });
            console.log('Last key (should be oldest):', { name: lastKey.name, createdAt: lastKey.createdAt });
        }

        console.log('Found API keys:', apiKeys?.length || 0);
        console.log('API keys with createdAt timestamps:', apiKeys.map(key => ({ 
            name: key.name, 
            createdAt: key.createdAt,
            createdAtISO: key.createdAt.toISOString(),
            createdAtTime: key.createdAt.getTime()
        })));
        
        // Verify the sorting worked correctly
        const sortedKeys = apiKeys.map(key => ({ 
            name: key.name, 
            createdAt: key.createdAt,
            createdAtTime: key.createdAt.getTime()
        }));
        console.log('Verification - Keys should be sorted by createdAt (newest first):', sortedKeys);

        if(apiKeys?.length) {
            return res.status(200).json({
                success: true,
                data: apiKeys
            });
        };
    
        return res.status(200).json({
            success: true,
            data: []
        });

    } catch(error) {
        console.log(error)
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const createApiKey = async(req, res, next) => {
    try {

        console.log('CREATING API KEY..........')
        console.log(req.body)
        
        const { 
            userId, 
            organizationId,
            name, 
            description, 
            permissions, 
            scopes, 
            rateLimits, 
            keyPrefix, 
            status, 
            isActive 
        } = req.body;

        const currentUserId = req.userId; // From auth middleware

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'API key name is required'
            });
        }

        // Get current user
        const currentUser = await UserSchema.findById(currentUserId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get companyId and organizationId from user
        const companyId = currentUser.companyId;
        const userOrganizationId = currentUser.organizationId;
        const finalUserId = currentUserId;

        // Convert userId to ObjectId if it's a string
        const userIdObjectId = typeof finalUserId === 'string' ? new mongoose.Types.ObjectId(finalUserId) : finalUserId;
        
        // Check if API key name already exists for this user/company (only active, non-deleted keys)
        const existingApiKeyQuery = {
            name: name.trim(),
            isDeleted: false
        };

        if (companyId) {
            existingApiKeyQuery.companyId = companyId;
        } else if (userOrganizationId) {
            existingApiKeyQuery.organizationId = userOrganizationId;
        } else {
            existingApiKeyQuery.userId = userIdObjectId;
        }

        const existingApiKey = await ApiKeysSchema.findOne(existingApiKeyQuery);

        console.log('existingApiKey:', existingApiKey);

        if (existingApiKey) {
            console.log('BOOM!!!!!!!!!')
            return res.status(400).json({
                success: false,
                message: 'An API key with this name already exists for your account'
            });
        }

        // Create new API key document
        const newApiKey = new ApiKeysSchema({
            name: name.trim(),
            description: description ? description.trim() : '',
            permissions: permissions || ['pdf_conversion', 'html_to_pdf'],
            scopes: scopes || ['read', 'write'],
            rateLimits: {
                requestsPerMinute: rateLimits?.requestsPerMinute || 300, // Tripled
                requestsPerHour: rateLimits?.requestsPerHour || 3000, // Tripled
                requestsPerDay: rateLimits?.requestsPerDay || 30000, // Tripled
                burstLimit: rateLimits?.burstLimit || 150 // Tripled
            },
            keyPrefix: keyPrefix || 'sk_live_',
            userId: userIdObjectId,
            companyId: companyId,
            organizationId: userOrganizationId,
            status: status || 'active',
            isActive: isActive !== undefined ? isActive : true,
            createdBy: userIdObjectId,
            usage: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                lastUsed: null,
                lastUsedIP: null,
                lastUsedUserAgent: null,
                dailyUsage: [],
                monthlyUsage: []
            }
        });

        // Generate secure key pair (will be handled by pre-save middleware)
        // The middleware will generate keyHash, keyId, and salt automatically

        // Save to database
        const savedApiKey = await newApiKey.save();
        
        // Get the raw key from the temporary storage (only available immediately after creation)
        const rawKey = savedApiKey._tempRawKey;
        const fullKey = savedApiKey.keyPrefix + rawKey;
        
        console.log('Generated secure API key pair:', {
            _id: savedApiKey._id,
            keyId: savedApiKey.keyId,
            keyHash: savedApiKey.keyHash ? savedApiKey.keyHash.substring(0, 16) + '...' : 'legacy',
            fullKey: fullKey.substring(0, 20) + '...', // Only show first 20 chars for security
            keyPrefix: savedApiKey.keyPrefix
        });

        // Return success response with the created API key
        return res.status(201).json({
            success: true,
            message: 'API key created successfully',
            data: {
                _id: savedApiKey._id,
                name: savedApiKey.name,
                description: savedApiKey.description,
                key: rawKey, // Raw key (only shown once during creation)
                fullKey: fullKey, // Full key with prefix (only shown once during creation)
                keyId: savedApiKey.keyId, // Public key identifier
                keyPrefix: savedApiKey.keyPrefix,
                keyVersion: savedApiKey.keyVersion || 1,
                permissions: savedApiKey.permissions,
                scopes: savedApiKey.scopes,
                rateLimits: savedApiKey.rateLimits,
                status: savedApiKey.status,
                isActive: savedApiKey.isActive,
                userId: savedApiKey.userId,
                organizationId: savedApiKey.organizationId,
                createdAt: savedApiKey.createdAt,
                updatedAt: savedApiKey.updatedAt,
                usage: savedApiKey.usage,
                securityMetadata: savedApiKey.securityMetadata || {}
            }
        });

    } catch(error) {
        console.log('Error creating API key:', error);
        
        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'API key with this name already exists'
            });
        }
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Something went wrong while creating the API key'
        });
    }
}

const deactivateApiKey = async(req, res, next) => {
    try {
        console.log('DEACTIVATING API KEY......')
        const { apiKeyId } = req.params;
        const { userId } = req.body;

        // Validate required fields
        if (!apiKeyId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'API Key ID and User ID are required'
            });
        }

        // Find the API key and verify ownership
        const apiKey = await ApiKeysSchema.findOne({
            _id: apiKeyId,
            userId: userId,
            isDeleted: false
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or you do not have permission to modify it'
            });
        }

        // Deactivate the API key
        apiKey.isActive = false;
        apiKey.status = 'inactive';
        apiKey.lastModifiedBy = userId;
        await apiKey.save();

        return res.status(200).json({
            success: true,
            message: 'API key deactivated successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                status: apiKey.status,
                isActive: apiKey.isActive,
                deactivatedAt: new Date()
            }
        });

    } catch(error) {
        console.log('Error deactivating API key:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while deactivating the API key'
        });
    }
}

const activateApiKey = async(req, res, next) => {
    try {
        console.log('ACTIVATING API KEY......')
        const { apiKeyId } = req.params;
        const { userId } = req.body;

        // Validate required fields
        if (!apiKeyId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'API Key ID and User ID are required'
            });
        }

        // Find the API key and verify ownership
        const apiKey = await ApiKeysSchema.findOne({
            _id: apiKeyId,
            userId: userId,
            isDeleted: false
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or you do not have permission to modify it'
            });
        }

        // Activate the API key
        apiKey.isActive = true;
        apiKey.status = 'active';
        apiKey.lastModifiedBy = userId;
        await apiKey.save();

        return res.status(200).json({
            success: true,
            message: 'API key activated successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                status: apiKey.status,
                isActive: apiKey.isActive,
                activatedAt: new Date()
            }
        });

    } catch(error) {
        console.log('Error activating API key:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while activating the API key'
        });
    }
}

const deleteApiKey = async(req, res, next) => {
    try {
        console.log('DELETING API KEY......')
        const { apiKeyId } = req.params;
        const { userId } = req.body;

        // Validate required fields
        if (!apiKeyId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'API Key ID and User ID are required'
            });
        }

        // Find the API key and verify ownership
        const apiKey = await ApiKeysSchema.findOne({
            _id: apiKeyId,
            userId: userId,
            isDeleted: false
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or you do not have permission to delete it'
            });
        }

        // Soft delete the API key
        apiKey.isDeleted = true;
        apiKey.deletedAt = new Date();
        apiKey.deletedBy = userId;
        apiKey.isActive = false;
        apiKey.status = 'revoked';
        await apiKey.save();

        return res.status(200).json({
            success: true,
            message: 'API key deleted successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                deletedAt: apiKey.deletedAt
            }
        });

    } catch(error) {
        console.log('Error deleting API key:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while deleting the API key'
        });
    }
}

const checkApiKeyNameAvailability = async(req, res, next) => {
    try {
        const { userId, name } = req.query;

        // Validate required fields
        if (!userId || !name) {
            return res.status(400).json({
                success: false,
                message: 'User ID and name are required'
            });
        }

        // Get companyId and userId from request (same pattern as other methods)
        const companyId = req.user?.companyId || req.companyId;
        const requestUserId = req.userId || req.user?.id;

        // Build query to check for existing API key with same name
        const query = { 
            name: name.trim(),
            isDeleted: false
        };

        // Filter by companyId if available, otherwise use userId (same logic as fetchAllApiKeys)
        if (companyId) {
            query.companyId = companyId;
        } else if (requestUserId) {
            query.userId = requestUserId;
        } else {
            // Fallback to the userId from query params for backward compatibility
            query.userId = userId;
        }

        // Check if API key name already exists
        const existingApiKey = await ApiKeysSchema.findOne(query);

        return res.status(200).json({
            success: true,
            available: !existingApiKey,
            message: existingApiKey ? 'Name already exists' : 'Name is available'
        });

    } catch(error) {
        console.log('Error checking API key name availability:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while checking name availability'
        });
    }
}

const editApiKey = async(req, res, next) => {
    try {
        console.log('EDITING API KEY......')
        const { apiKeyId } = req.params;
        const { userId, name, description } = req.body;

        // Validate required fields
        if (!apiKeyId || !userId || !name) {
            return res.status(400).json({
                success: false,
                message: 'API Key ID, User ID, and name are required'
            });
        }

        // Find the API key and verify ownership
        const apiKey = await ApiKeysSchema.findOne({
            _id: apiKeyId,
            userId: userId,
            isDeleted: false
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or you do not have permission to modify it'
            });
        }

        // Check if the new name already exists for this user (excluding current key)
        if (name.trim() !== apiKey.name) {
            const existingApiKey = await ApiKeysSchema.findOne({
                userId: userId,
                name: name.trim(),
                _id: { $ne: apiKeyId },
                isDeleted: false
            });

            if (existingApiKey) {
                return res.status(400).json({
                    success: false,
                    message: 'An API key with this name already exists for your account'
                });
            }
        }

        // Update the API key
        apiKey.name = name.trim();
        if (description !== undefined) {
            apiKey.description = description ? description.trim() : '';
        }
        apiKey.lastModifiedBy = userId;
        apiKey.lastModifiedAt = new Date();
        await apiKey.save();

        return res.status(200).json({
            success: true,
            message: 'API key updated successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                description: apiKey.description,
                lastModifiedAt: apiKey.lastModifiedAt
            }
        });

    } catch(error) {
        console.log('Error editing API key:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while updating the API key'
        });
    }
}

const regenerateApiKey = async(req, res, next) => {
    try {
        console.log('REGENERATING API KEY......')
        const { apiKeyId } = req.params;
        const { userId, name } = req.body;

        // Validate required fields
        if (!apiKeyId || !userId || !name) {
            return res.status(400).json({
                success: false,
                message: 'API Key ID, User ID, and name are required'
            });
        }

        // Find the API key and verify ownership
        const apiKey = await ApiKeysSchema.findOne({
            _id: apiKeyId,
            userId: userId,
            isDeleted: false
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API key not found or you do not have permission to modify it'
            });
        }

        // Check if the new name already exists for this user (excluding current key)
        if (name.trim() !== apiKey.name) {
            const existingApiKey = await ApiKeysSchema.findOne({
                userId: userId,
                name: name.trim(),
                _id: { $ne: apiKeyId },
                isDeleted: false
            });

            if (existingApiKey) {
                return res.status(400).json({
                    success: false,
                    message: 'An API key with this name already exists for your account'
                });
            }
        }

        // Generate new secure key pair using the schema method
        const newKeyPair = await ApiKeysSchema.prototype.generateSecureKeyPair();
        
        // Update the API key with new secure values
        apiKey.name = name.trim();
        apiKey.keyHash = newKeyPair.keyHash;
        apiKey.keyId = newKeyPair.keyId;
        apiKey.salt = newKeyPair.salt;
        apiKey.key = undefined; // Remove legacy key for security
        apiKey.lastUsed = null;
        apiKey.lastModifiedBy = userId;
        apiKey.lastModifiedAt = new Date();
        
        // Update security metadata
        if (!apiKey.securityMetadata) {
            apiKey.securityMetadata = {};
        }
        apiKey.securityMetadata.lastRotated = new Date();
        apiKey.securityMetadata.rotationCount = (apiKey.securityMetadata.rotationCount || 0) + 1;
        
        await apiKey.save();

        return res.status(200).json({
            success: true,
            message: 'API key regenerated successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                keyId: apiKey.keyId,
                keyPrefix: apiKey.keyPrefix,
                lastModifiedAt: apiKey.lastModifiedAt,
                securityMetadata: apiKey.securityMetadata
            }
        });

    } catch(error) {
        console.log('Error regenerating API key:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while regenerating the API key'
        });
    }
}

export { fetchAllApiKeys, createApiKey, deactivateApiKey, activateApiKey, deleteApiKey, checkApiKeyNameAvailability, editApiKey, regenerateApiKey };