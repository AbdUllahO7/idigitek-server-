import express from 'express';
import { WebSiteController } from '../controllers/WebSite.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';
import clientWebSiteController from '../controllers/client/clientWebSite.controller';

const router = express.Router();
const webSiteController = new WebSiteController();
const upload = multer({ dest: 'uploads/' });


// Logo upload route
router.post('/:id/logo', upload.single('logo'), webSiteController.uploadWebSiteLogo);

// Website routes
router.route('/')
  .get(webSiteController.getAllWebSites)
  .post( authenticate, webSiteController.createWebSite);

// Get all websites for the current user
router.get('/my',  authenticate, webSiteController.getMyWebSites);

// Website by ID routes
router.route('/:id')
  .get(webSiteController.getWebSiteById)
  .patch( authenticate, webSiteController.updateWebSite)
  .delete( authenticate,webSiteController.deleteWebSite);

// Website users management
router.route('/:id/users')
  .get(authenticate,webSiteController.getWebSiteUsers)
  .post(authenticate, webSiteController.addUserToWebSite);

router.delete('/:id/users/:userId', authenticate,webSiteController.removeUserFromWebSite);


// New special route for getting websites by user ID with sections and languages
router.get('/client/user/:userId', clientWebSiteController.getWebSitesByUserIdWithDetails);
export default router;