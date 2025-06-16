import { Router } from 'express';
import { 
  validateCreateContact, 
  validateUpdateContactStatus, 
  validateContactId 
} from '../middleware/validation';
import contactController from '../controllers/client/contact.controller';

const router: Router = Router();

// Public routes
router.post('/', validateCreateContact, contactController.createContact);

// Admin routes (you would typically add authentication middleware here)
router.get('/', contactController.getAllContacts);
router.get('/stats', contactController.getContactsStats);
router.get('/:id', validateContactId, contactController.getContactById);
router.patch('/:id/status', validateUpdateContactStatus, contactController.updateContactStatus);
router.delete('/:id', validateContactId, contactController.deleteContact);

export default router;
