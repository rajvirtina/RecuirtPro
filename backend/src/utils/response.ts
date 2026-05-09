import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * Clamp pagination params to safe bounds (B-14)
 */
export const clampPagination = (page: any, limit: any): { pageNum: number; limitNum: number } => {
  let pageNum = parseInt(page as string, 10);
  let limitNum = parseInt(limit as string, 10);
  if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
  if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
  if (limitNum > 100) limitNum = 100;
  return { pageNum, limitNum };
};

/**
 * Send success response
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: any[]
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 */
export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response => {
  const response: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  return res.status(200).json(response);
};
