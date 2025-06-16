export interface IContact {
  _id?: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  status: 'pending' | 'read' | 'responded';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactDTO {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

export interface UpdateContactStatusDTO {
  status: 'pending' | 'read' | 'responded';
}

export interface ContactsResponse {
  contacts: IContact[];
  totalPages: number;
  currentPage: number;
  total: number;
}

export interface ContactStats {
  total: number;
  byStatus: {
    [key: string]: number;
  };
}
