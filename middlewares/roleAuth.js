import UserSchema from '../users/UserSchema.js';
import OrganizationSchema from '../organizations/OrganizationSchema.js';

// Role-based access control middleware
export const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const userId = req.userId;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Get user with organization info
            const user = await UserSchema.findById(userId)
                .populate('organizationId', 'name status');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if user has required role
            if (!user.role || !allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
                });
            }

            // Add user info to request for use in controllers
            req.user = user;
            req.userRole = user.role;
            req.organizationId = user.organizationId?._id;

            next();
        } catch (error) {
            console.error('Role auth error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};

// Organization access control middleware
export const requireOrganizationAccess = async (req, res, next) => {
    try {
        const userId = req.userId;
        const organizationId = req.params.organizationId || req.body.organizationId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get user
        const user = await UserSchema.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user belongs to the organization
        if (!user.organizationId || user.organizationId.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not a member of this organization'
            });
        }

        // Get organization
        const organization = await OrganizationSchema.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check organization status
        if (organization.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Organization is suspended'
            });
        }

        // Add organization info to request
        req.organization = organization;
        req.userRole = user.role;

        next();
    } catch (error) {
        console.error('Organization access error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// API key organization scope middleware
export const requireApiKeyOrganizationAccess = async (req, res, next) => {
    try {
        const userId = req.userId;
        const organizationId = req.params.organizationId || req.body.organizationId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get user
        const user = await UserSchema.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // For personal accounts, allow access to their own API keys
        if (user.accountType === 'personal' && !organizationId) {
            req.userRole = 'owner'; // Personal accounts are owners of their own resources
            return next();
        }

        // For company accounts, require organization access
        if (user.accountType === 'company' || organizationId) {
            if (!user.organizationId) {
                return res.status(403).json({
                    success: false,
                    message: 'Organization membership required'
                });
            }

            // Check if accessing organization's API keys
            if (organizationId && user.organizationId.toString() !== organizationId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only access your organization\'s API keys'
                });
            }

            // Check user role for API key management
            if (!['owner', 'admin'].includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin or owner role required for API key management'
                });
            }
        }

        req.userRole = user.role;
        req.organizationId = user.organizationId;

        next();
    } catch (error) {
        console.error('API key organization access error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Resource ownership middleware
export const requireResourceOwnership = (resourceField = 'userId') => {
    return async (req, res, next) => {
        try {
            const userId = req.userId;
            const resourceId = req.params.id || req.params.userId;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Get user
            const user = await UserSchema.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if user is admin or owner (can access any resource in their organization)
            if (['owner', 'admin'].includes(user.role) && user.organizationId) {
                // Admin/owner can access any resource in their organization
                req.userRole = user.role;
                req.organizationId = user.organizationId;
                return next();
            }

            // For personal accounts or members, check resource ownership
            if (resourceId && resourceId !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only access your own resources'
                });
            }

            req.userRole = user.role;
            req.organizationId = user.organizationId;

            next();
        } catch (error) {
            console.error('Resource ownership error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    };
};
