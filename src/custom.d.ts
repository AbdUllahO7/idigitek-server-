import { UserRole } from "./types/user.types";

declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: UserRole;
    };
    startTime?: number;
  }
}