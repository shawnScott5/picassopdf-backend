import OrganizationSchema from './OrganizationSchema.js';
import UserSchema from '../users/UserSchema.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Create a new organization
const createOrganization = async (req, res) => {
    try {
        const {
            name,
            description,
            website,
            companySize,
            industry,
            contactEmail,
            phone,
            address,
            accountType
        } = req.body;

        const userId = req.userId; // From auth middleware

        // Validate required fields
        if (!name || !contactEmail) {
            return res.status(400).json({
                success: false,
                message: 'Organization name and contact email are required'
            });
        }

        // Check if organization name already exists
        const existingOrg = await OrganizationSchema.findOne({
            $or: [
                { name: { $regex: new RegExp(`^${name}$`, 'i') } },
                { contactEmail: contactEmail.toLowerCase() }
            ]
        });

        if (existingOrg) {
            return res.status(400).json({
                success: false,
                message: 'An organization with this name or email already exists'
            });
        }

        // Create organization
        const organization = new OrganizationSchema({
            name,
            description,
            website,
            companySize,
            industry,
            contactEmail: contactEmail.toLowerCase(),
            phone,
            address,
            createdBy: userId,
            lastModifiedBy: userId
        });

        await organization.save();

        // Update the user to be the owner of this organization
        await UserSchema.findByIdAndUpdate(userId, {
            organizationId: organization._id,
            role: 'owner',
            accountType: accountType || 'company',
            companyName: name,
            companyWebsite: website,
            companySize: companySize
        });

        return res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            data: {
                organization: {
                    _id: organization._id,
                    name: organization.name,
                    slug: organization.slug,
                    contactEmail: organization.contactEmail,
                    status: organization.status
                }
            }
        });

    } catch (error) {
        console.error('Error creating organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get organization details
const getOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const userId = req.userId;

        // Find organization and verify user has access
        const organization = await OrganizationSchema.findById(organizationId)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Check if user has access to this organization
        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get member count
        const memberCount = await UserSchema.countDocuments({
            organizationId: organizationId,
            status: 'active'
        });

        return res.status(200).json({
            success: true,
            data: {
                organization: {
                    ...organization.toObject(),
                    memberCount
                }
            }
        });

    } catch (error) {
        console.error('Error fetching organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update organization
const updateOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const userId = req.userId;
        const updateData = req.body;

        // Find organization and verify user has admin/owner access
        const organization = await OrganizationSchema.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId || !['owner', 'admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin or owner role required.'
            });
        }

        // Update organization
        const updatedOrganization = await OrganizationSchema.findByIdAndUpdate(
            organizationId,
            {
                ...updateData,
                lastModifiedBy: userId,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Organization updated successfully',
            data: { organization: updatedOrganization }
        });

    } catch (error) {
        console.error('Error updating organization:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get organization members
const getOrganizationMembers = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const userId = req.userId;

        // Verify user has access to this organization
        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get all members
        const members = await UserSchema.find({
            organizationId: organizationId,
            status: { $ne: 'suspended' }
        })
        .select('name email role status joinedAt lastActiveAt')
        .sort({ joinedAt: -1 });

        return res.status(200).json({
            success: true,
            data: { members }
        });

    } catch (error) {
        console.error('Error fetching organization members:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Invite user to organization
const inviteUser = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { email, role = 'member' } = req.body;
        const userId = req.userId;

        // Verify user has admin/owner access
        const user = await UserSchema.findById(userId);
        const userOrgId = user?.organizationId || user?.companyId;
        if (!user || userOrgId?.toString() !== organizationId || !['owner', 'admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin or owner role required.'
            });
        }

        // Check if user already exists
        const existingUser = await UserSchema.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            if (existingUser.organizationId || existingUser.companyId) {
                return res.status(400).json({
                    success: false,
                    message: 'User is already part of an organization'
                });
            }
            
            // Add user to organization
            await UserSchema.findByIdAndUpdate(existingUser._id, {
                organizationId: organizationId,
                companyId: organizationId, // Also set companyId for consistency
                role: role,
                invitedBy: userId,
                joinedAt: new Date()
            });

            return res.status(200).json({
                success: true,
                message: 'User added to organization successfully',
                data: { user: existingUser }
            });
        }

        // TODO: Send invitation email for new users
        // For now, return success message
        return res.status(200).json({
            success: true,
            message: 'Invitation sent successfully'
        });

    } catch (error) {
        console.error('Error inviting user:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Remove user from organization
const removeUser = async (req, res) => {
    try {
        const { organizationId, userId: targetUserId } = req.params;
        const userId = req.userId;

        // Verify user has admin/owner access
        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId || !['owner', 'admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin or owner role required.'
            });
        }

        // Prevent removing the owner
        const targetUser = await UserSchema.findById(targetUserId);
        if (targetUser.role === 'owner') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove organization owner'
            });
        }

        // Remove user from organization
        await UserSchema.findByIdAndUpdate(targetUserId, {
            $unset: {
                organizationId: 1,
                role: 1,
                invitedBy: 1
            }
        });

        return res.status(200).json({
            success: true,
            message: 'User removed from organization successfully'
        });

    } catch (error) {
        console.error('Error removing user:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update user role in organization
const updateUserRole = async (req, res) => {
    try {
        const { organizationId, userId: targetUserId } = req.params;
        const { role } = req.body;
        const userId = req.userId;

        // Verify user has owner access (only owners can change roles)
        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId || user.role !== 'owner') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Owner role required.'
            });
        }

        // Prevent changing owner role
        if (role === 'owner') {
            return res.status(400).json({
                success: false,
                message: 'Cannot change user to owner role'
            });
        }

        // Update user role
        await UserSchema.findByIdAndUpdate(targetUserId, {
            role: role,
            lastModifiedBy: userId
        });

        return res.status(200).json({
            success: true,
            message: 'User role updated successfully'
        });

    } catch (error) {
        console.error('Error updating user role:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get organization usage statistics
const getOrganizationUsage = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const userId = req.userId;

        // Verify user has access
        const user = await UserSchema.findById(userId);
        if (!user || user.organizationId?.toString() !== organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const organization = await OrganizationSchema.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const usage = organization.checkUsageLimits();

        return res.status(200).json({
            success: true,
            data: { usage }
        });

    } catch (error) {
        console.error('Error fetching organization usage:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create organization for existing user
const createOrganizationForUser = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.userId; // From auth middleware

        // Validate required fields
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Organization name is required'
            });
        }

        // Check if user already has an organization
        const currentUser = await UserSchema.findById(userId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (currentUser.organizationId) {
            return res.status(400).json({
                success: false,
                message: 'User already belongs to an organization'
            });
        }

        // Create organization (always create new, even if name exists)
        const organization = new OrganizationSchema({
            name: name.trim(),
            description: description?.trim() || `Organization for ${name.trim()}`,
            contactEmail: currentUser.email,
            createdBy: userId,
            lastModifiedBy: userId,
            members: [{
                userId: userId,
                role: 'owner',
                joinedAt: new Date(),
                status: 'active'
            }]
        });

        await organization.save();

        // Update user with organization ID and owner role
        await UserSchema.findByIdAndUpdate(userId, {
            organizationId: organization._id,
            role: 'owner',
            accountType: 'company'
        });

        return res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            data: {
                _id: organization._id,
                name: organization.name,
                description: organization.description,
                role: 'owner'
            }
        });

    } catch (error) {
        console.error('Error creating organization for user:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while creating the organization'
        });
    }
};

export {
    createOrganization,
    createOrganizationForUser,
    getOrganization,
    updateOrganization,
    getOrganizationMembers,
    inviteUser,
    removeUser,
    updateUserRole,
    getOrganizationUsage
};