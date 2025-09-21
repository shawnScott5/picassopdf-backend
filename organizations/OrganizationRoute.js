import express from 'express';
import {
    createOrganization,
    createOrganizationForUser,
    getOrganization,
    updateOrganization,
    getOrganizationMembers,
    inviteUser,
    removeUser,
    updateUserRole,
    getOrganizationUsage
} from './OrganizationController.js';
import authenticate from '../middlewares/authenticate.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Organization CRUD routes
router.post('/', createOrganization);
router.post('/create-for-user', createOrganizationForUser);
router.get('/:organizationId', getOrganization);
router.put('/:organizationId', updateOrganization);

// Member management routes
router.get('/:organizationId/members', getOrganizationMembers);
router.post('/:organizationId/invite', inviteUser);
router.delete('/:organizationId/members/:userId', removeUser);
router.put('/:organizationId/members/:userId/role', updateUserRole);

// Usage and analytics routes
router.get('/:organizationId/usage', getOrganizationUsage);

export default router;