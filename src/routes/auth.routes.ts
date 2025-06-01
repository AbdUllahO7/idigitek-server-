import express from 'express';
import authController from '../controllers/auth.controller';


// Import the controller functions directly to check if they exist

const router = express.Router();



router.post('/login', authController.login);
router.post('/refreshToken', authController.refreshToken);
router.post('/logout', authController.logout);

// Export the router
export default router;