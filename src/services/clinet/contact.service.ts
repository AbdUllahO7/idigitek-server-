import ContactModel from "../../models/Contact.model";
import { ContactsResponse, ContactStats, CreateContactDTO, IContact } from "../../types/contact.types";

class ContactService {
  // Create a new contact message
  async createContact(contactData: CreateContactDTO): Promise<IContact> {
    try {
      const contact = new ContactModel(contactData);
      const savedContact = await contact.save();
      return savedContact.toObject();
    } catch (error: any) {
      throw new Error(`Error creating contact: ${error.message}`);
    }
  }

  // Get all contact messages with pagination
  async getAllContacts(
    page: number = 1, 
    limit: number = 10, 
    status?: string
  ): Promise<ContactsResponse> {
    try {
      const query = status ? { status } : {};
      const skip = (page - 1) * limit;
      
      const contacts = await ContactModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      
      const total = await ContactModel.countDocuments(query);
      
      return {
        contacts: contacts as IContact[],
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      };
    } catch (error: any) {
      throw new Error(`Error fetching contacts: ${error.message}`);
    }
  }

  // Get a single contact by ID
  async getContactById(id: string): Promise<IContact> {
    try {
      const contact = await ContactModel.findById(id).lean();
      if (!contact) {
        throw new Error('Contact not found');
      }
      return contact as IContact;
    } catch (error: any) {
      throw new Error(`Error fetching contact: ${error.message}`);
    }
  }

  // Update contact status
  async updateContactStatus(id: string, status: string): Promise<IContact> {
    try {
      const validStatuses = ['pending', 'read', 'responded'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const contact = await ContactModel.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean();

      if (!contact) {
        throw new Error('Contact not found');
      }

      return contact as IContact;
    } catch (error: any) {
      throw new Error(`Error updating contact: ${error.message}`);
    }
  }

  // Delete a contact
  async deleteContact(id: string): Promise<IContact> {
    try {
      const contact = await ContactModel.findByIdAndDelete(id).lean();
      if (!contact) {
        throw new Error('Contact not found');
      }
      return contact as IContact;
    } catch (error: any) {
      throw new Error(`Error deleting contact: ${error.message}`);
    }
  }

  // Get contacts statistics
  async getContactsStats(): Promise<ContactStats> {
    try {
      const stats = await ContactModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await ContactModel.countDocuments();
      
      return {
        total,
        byStatus: stats.reduce((acc: { [key: string]: number }, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error: any) {
      throw new Error(`Error fetching statistics: ${error.message}`);
    }
  }
}

export default new ContactService();
