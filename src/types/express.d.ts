// src/types/express.d.ts
import { UserRole } from './user.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
      requestId?: string;
      startTime?: number;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    file?: File;
    files?: File[];
  }
}

declare namespace Express {
  export interface Request {
    file?: File & { path?: string; filename?: string };
    files?: (File & { path?: string; filename?: string })[] | { [fieldname: string]: (File & { path?: string; filename?: string })[] };
  }
}