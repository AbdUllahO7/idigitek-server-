import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import contactService from '../../services/clinet/contact.service';
import { CreateContactDTO, UpdateContactStatusDTO } from '../../types/contact.types';

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

class ContactController {
  // Create new contact message
  async createContact(req: Request, res: Response): Promise<void> {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        };
        res.status(400).json(response);
        return;
      }

      const contactData: CreateContactDTO = req.body;
      const contact = await contactService.createContact(contactData);

      const response: ApiResponse = {
        success: true,
        message: 'Contact message sent successfully',
        data: contact
      };

      res.status(201).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(500).json(response);
    }
  }

  // Get all contacts (admin only)
  async getAllContacts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      
      const result = await contactService.getAllContacts(page, limit, status);

      const response: ApiResponse = {
        success: true,
        message: 'Contacts retrieved successfully',
        data: result
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(500).json(response);
    }
  }

  // Get single contact by ID (admin only)
  async getContactById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const contact = await contactService.getContactById(id);

      const response: ApiResponse = {
        success: true,
        message: 'Contact retrieved successfully',
        data: contact
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(404).json(response);
    }
  }

  // Update contact status (admin only)
  async updateContactStatus(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        };
        res.status(400).json(response);
        return;
      }

      const { id } = req.params;
      const { status }: UpdateContactStatusDTO = req.body;
      
      const updatedContact = await contactService.updateContactStatus(id, status);

      const response: ApiResponse = {
        success: true,
        message: 'Contact status updated successfully',
        data: updatedContact
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(404).json(response);
    }
  }

  // Delete contact (admin only)
  async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await contactService.deleteContact(id);

      const response: ApiResponse = {
        success: true,
        message: 'Contact deleted successfully'
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(404).json(response);
    }
  }

  // Get contacts statistics (admin only)
  async getContactsStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await contactService.getContactsStats();

      const response: ApiResponse = {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        message: error.message
      };
      res.status(500).json(response);
    }
  }
}

export default new ContactController();
