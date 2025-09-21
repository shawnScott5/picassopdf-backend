import authenticate from './authenticate.js';

// Export the authenticate function with the name authenticateToken for backward compatibility
export const authenticateToken = authenticate;

// Also export as default
export default authenticate;
