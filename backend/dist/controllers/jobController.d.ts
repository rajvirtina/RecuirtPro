import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
export declare const getJobs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getCompanyInfoBySlug: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getJobsByCompanySlug: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getJobById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createJob: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateJob: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteJob: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=jobController.d.ts.map