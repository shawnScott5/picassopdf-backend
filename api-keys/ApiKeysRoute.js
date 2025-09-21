import express from 'express';
import { fetchAllApiKeys, createApiKey, deactivateApiKey, activateApiKey, deleteApiKey, checkApiKeyNameAvailability, editApiKey, regenerateApiKey } from './ApiKeysController.js';
import authenticate from '../middlewares/authenticate.js';

const ApiKeysRoute = express.Router();

ApiKeysRoute.get('/', authenticate, fetchAllApiKeys);
ApiKeysRoute.get('/check-name', authenticate, checkApiKeyNameAvailability);
ApiKeysRoute.post('/create', authenticate, createApiKey);
ApiKeysRoute.put('/edit/:apiKeyId', authenticate, editApiKey);
ApiKeysRoute.put('/regenerate/:apiKeyId', authenticate, regenerateApiKey);
ApiKeysRoute.put('/deactivate/:apiKeyId', authenticate, deactivateApiKey);
ApiKeysRoute.put('/activate/:apiKeyId', authenticate, activateApiKey);
ApiKeysRoute.delete('/delete/:apiKeyId', authenticate, deleteApiKey);

export default ApiKeysRoute;