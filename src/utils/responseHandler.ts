import { Response } from 'express';

/**
 * Standard API response format
 */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginated API response format
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * Send successful response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    requestId: (res.req as any).requestId,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send paginated successful response
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message: string = 'Success',
  statusCode: number = 200
): Response => {
  const response: PaginatedApiResponse<T> = {
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString(),
    requestId: (res.req as any).requestId,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  error: any = null
): Response => {
  const response: ApiResponse<null> = {
    success: false,
    message,
    error: error || undefined,
    timestamp: new Date().toISOString(),
    requestId: (res.req as any).requestId,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Create pagination metadata
 */
export const createPaginationMeta = (
  total: number,
  limit: number,
  page: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};