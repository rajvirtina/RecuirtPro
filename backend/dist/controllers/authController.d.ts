import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export declare const register: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export declare const login: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export declare const getMe: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export declare const logout: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
export declare const refresh: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export declare const verifyEmail: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export declare const forgotPassword: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export declare const resetPassword: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Change password
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
export declare const changePassword: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Private
 */
export declare const resendVerification: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map