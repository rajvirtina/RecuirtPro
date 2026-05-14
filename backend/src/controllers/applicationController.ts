import { Response } from 'express';
import { Application, Job, CandidateProfile, User } from '../models';
import { AuthRequest, JobStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import logger from '../utils/logger';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';

/**
 * @desc    Submit a job application
 * @route   POST /api/v1/applications
 * @access  Private (Candidate)
 */
export const submitApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId, coverLetter, expectedSalary } = req.body;
    const userId = req.user?._id;

    // Get resume URL from uploaded file or body
    let resumeUrl = req.body.resumeUrl;
    if (req.file) {
      // File was uploaded, use the file path
      resumeUrl = `/uploads/resumes/${req.file.filename}`;
    }

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 'Job not found', 404);
    }

    if (job.status !== JobStatus.PUBLISHED) {
      return sendError(res, 'Job is not accepting applications', 400);
    }

    // Check if user already applied
    const existingApplication = await Application.findOne({
      jobId,
      candidateId: userId,
      deletedAt: null,
    });

    if (existingApplication) {
      return sendError(res, 'You have already applied to this job', 400);
    }

    // Get or create candidate profile
    let candidateProfile = await CandidateProfile.findOne({ userId });
    if (!candidateProfile) {
      // Create basic candidate profile
      candidateProfile = await CandidateProfile.create({
        userId,
        resumeUrl: resumeUrl || '',
      });
    }

    // BUG-008: Use findOneAndUpdate with upsert=false to safely handle race conditions.
    // The unique index on [jobId, candidateId] catches concurrent inserts — return 409 not 500.
    let application;
    try {
      application = await Application.create({
        jobId,
        candidateId: userId,
        companyId: job.companyId,
        coverLetter,
        resumeUrl: resumeUrl || candidateProfile.resumeUrl,
        expectedSalary,
        status: ApplicationStatus.APPLIED,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key — concurrent insert lost the race
        return sendError(res, 'You have already applied to this job', 409);
      }
      throw err;
    }

    // DC-001: Increment application count atomically (stays in sync)
    await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });

    logger.info(`Application submitted: ${application._id} for job: ${jobId}`);

    return sendSuccess(
      res,
      application,
      'Application submitted successfully',
      201
    );
  } catch (error: any) {
    logger.error('Error in submitApplication:', error);
    return sendError(res, error.message || 'Error submitting application', 500);
  }
};

/**
 * @desc    Get all applications (with filters)
 * @route   GET /api/v1/applications
 * @access  Private (Employer/HR/Admin for job applications, Candidate for own applications)
 */
export const getApplications = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const {
      page = 1,
      limit = 10,
      jobId,
      status,
      candidateId,
    } = req.query;

    const query: any = { deletedAt: null };

    // Role-based filtering
    if (req.user?.role === 'candidate') {
      // Candidates can only see their own applications
      query.candidateId = req.user._id;
    } else {
      // TENANT ISOLATION: All non-candidate, non-super-admin users are scoped to their company
      const tenantId = getTenantCompanyId(req.user);
      if (tenantId) {
        query.companyId = tenantId;
      }
    }

    // Apply filters
    if (jobId) query.jobId = jobId;
    if (status) query.status = status;
    if (candidateId && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
      query.candidateId = candidateId;
    }

    const { pageNum, limitNum } = clampPagination(page, limit);
    const skip = (pageNum - 1) * limitNum;

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('jobId', 'title location companyId salaryMin salaryMax')
        .populate('candidateId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Application.countDocuments(query),
    ]);

    return sendPaginatedResponse(
      res,
      applications,
      pageNum,
      limitNum,
      total,
      'Applications retrieved successfully'
    );
  } catch (error: any) {
    logger.error('Error in getApplications:', error);
    return sendError(res, error.message || 'Error fetching applications', 500);
  }
};

/**
 * @desc    Get single application by ID
 * @route   GET /api/v1/applications/:id
 * @access  Private (Application owner or Employer/HR/Admin)
 */
export const getApplicationById = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('jobId')
      .populate('candidateId', '-password');

    if (!application || application.deletedAt) {
      return sendError(res, 'Application not found', 404);
    }

    // Authorization check
    const isOwner = application.candidateId._id.toString() === req.user?._id;
    const tenantId = getTenantCompanyId(req.user);
    const isSuperAdminUser = isSuperAdmin(req.user);
    
    // Company members can only view applications for their company's jobs
    let isAuthorizedCompanyMember = false;
    if (tenantId && application.companyId) {
      isAuthorizedCompanyMember = application.companyId.toString() === tenantId;
    }

    if (!isOwner && !isAuthorizedCompanyMember && !isSuperAdminUser) {
      return sendError(res, 'Not authorized to view this application', 403);
    }

    return sendSuccess(res, application, 'Application retrieved successfully');
  } catch (error: any) {
    logger.error('Error in getApplicationById:', error);
    return sendError(res, error.message || 'Error fetching application', 500);
  }
};

/**
 * @desc    Update application status
 * @route   PUT /api/v1/applications/:id/status
 * @access  Private (Employer/HR/Admin only)
 */
export const updateApplicationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const application = await Application.findById(id);

    if (!application || application.deletedAt) {
      return sendError(res, 'Application not found', 404);
    }

    // Authorization check — company isolation (SEC-15/B-16)
    const tenantId = getTenantCompanyId(req.user);
    const isSuperAdminUser = isSuperAdmin(req.user);
    let isAuthorizedCompanyMember = false;
    if (tenantId && application.companyId) {
      isAuthorizedCompanyMember = application.companyId.toString() === tenantId;
    }

    if (!isSuperAdminUser && !isAuthorizedCompanyMember) {
      return sendError(
        res,
        'Not authorized to update this application',
        403
      );
    }

    // Status transition validation (NEW-03)
    const validTransitions: Record<string, string[]> = {
      [ApplicationStatus.APPLIED]: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD, ApplicationStatus.WITHDRAWN],
      [ApplicationStatus.SHORTLISTED]: [ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD, ApplicationStatus.WITHDRAWN],
      [ApplicationStatus.INTERVIEW_SCHEDULED]: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD, ApplicationStatus.WITHDRAWN],
      [ApplicationStatus.IN_PROGRESS]: [ApplicationStatus.SELECTED, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD, ApplicationStatus.WITHDRAWN],
      [ApplicationStatus.SELECTED]: [ApplicationStatus.OFFER_RELEASED, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD],
      [ApplicationStatus.OFFER_RELEASED]: [ApplicationStatus.HIRED, ApplicationStatus.REJECTED, ApplicationStatus.ON_HOLD],
      [ApplicationStatus.ON_HOLD]: [ApplicationStatus.SHORTLISTED, ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
      [ApplicationStatus.HIRED]: [],
      [ApplicationStatus.REJECTED]: [],
      [ApplicationStatus.WITHDRAWN]: [],
    };

    const currentStatus = application.status;
    const allowedNext = validTransitions[currentStatus] || [];
    if (!allowedNext.includes(status)) {
      return sendError(
        res,
        `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowedNext.join(', ') || 'none (terminal state)'}`,
        400
      );
    }

    // Update status
    application.status = status;
    
    // Add note if provided
    if (notes) {
      (application.notes as any).push({
        addedBy: req.user?._id!,
        note: notes,
        createdAt: new Date(),
      });
    }

    // Add status change to statusHistory
    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user?._id! as any,
      remarks: notes,
    });

    await application.save();

    logger.info(
      `Application ${id} status updated to ${status} by ${req.user?._id}`
    );

    return sendSuccess(res, application, 'Application status updated');
  } catch (error: any) {
    logger.error('Error in updateApplicationStatus:', error);
    return sendError(
      res,
      error.message || 'Error updating application status',
      500
    );
  }
};

/**
 * @desc    Withdraw application
 * @route   DELETE /api/v1/applications/:id
 * @access  Private (Candidate - application owner only)
 */
export const withdrawApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id);

    if (!application || application.deletedAt) {
      return sendError(res, 'Application not found', 404);
    }

    // Only candidate who submitted can withdraw
    if (application.candidateId.toString() !== req.user?._id) {
      return sendError(res, 'Not authorized to withdraw this application', 403);
    }

    // Cannot withdraw if already in interview or hired
    if ([ApplicationStatus.HIRED, ApplicationStatus.IN_PROGRESS].includes(application.status)) {
      return sendError(
        res,
        `Cannot withdraw application in ${application.status} status`,
        400
      );
    }

    // Hard delete
    await Application.findByIdAndDelete(id);

    // Decrement application count on job
    await Job.findByIdAndUpdate(application.jobId, {
      $inc: { applicationCount: -1 },
    });

    logger.info(`Application ${id} withdrawn by candidate ${req.user?._id}`);

    return sendSuccess(res, null, 'Application withdrawn successfully');
  } catch (error: any) {
    logger.error('Error in withdrawApplication:', error);
    return sendError(res, error.message || 'Error withdrawing application', 500);
  }
};

/**
 * @desc    Get application statistics
 * @route   GET /api/v1/applications/stats
 * @access  Private (Employer/HR/Admin)
 */
export const getApplicationStats = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.query;

    const matchQuery: any = { deletedAt: null };

    // Role-based filtering
    if (req.user?.role === 'employer' || req.user?.role === 'hr' || req.user?.role === 'admin') {
      // TENANT ISOLATION: Scope to company
      const tenantId = getTenantCompanyId(req.user);
      if (tenantId) {
        matchQuery.companyId = tenantId;
      }
    }

    if (jobId) {
      matchQuery.jobId = jobId;
    }

    const stats = await Application.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Application.countDocuments(matchQuery);

    const formattedStats = {
      total,
      byStatus: stats.reduce((acc: any, stat: any) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
    };

    return sendSuccess(
      res,
      formattedStats,
      'Application statistics retrieved'
    );
  } catch (error: any) {
    logger.error('Error in getApplicationStats:', error);
    return sendError(res, error.message || 'Error fetching statistics', 500);
  }
};

/**
 * @desc    Download resume for an application
 * @route   GET /api/v1/applications/:id/resume
 * @access  Private (HR/Employer/Admin or application owner)
 */
export const downloadResume = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    // Check authorization
    const isOwner = application.candidateId.toString() === req.user?._id;
    const tenantId = getTenantCompanyId(req.user);
    const isCompanyMember = tenantId ? application.companyId?.toString() === tenantId : false;
    const isSuperAdminUser = isSuperAdmin(req.user);

    if (!isOwner && !isCompanyMember && !isSuperAdminUser) {
      return sendError(res, 'Not authorized to download this resume', 403);
    }

    if (!application.resumeUrl) {
      return sendError(res, 'No resume uploaded for this application', 404);
    }

    // Prevent path traversal (SEC-04/B-05)
    const path = require('path');
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const filePath = path.resolve(__dirname, '../../', application.resumeUrl);

    // Ensure resolved path stays within the uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      logger.warn(`[downloadResume] Path traversal attempt blocked: ${application.resumeUrl}`);
      return sendError(res, 'Invalid resume path', 400);
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Resume file not found', 404);
    }

    // Send file
    return res.download(filePath, (err) => {
      if (err) {
        logger.error('Error downloading resume:', err);
        if (!res.headersSent) {
          return sendError(res, 'Error downloading resume', 500);
        }
      }
    });
  } catch (error: any) {
    logger.error('Error in downloadResume:', error);
    return sendError(res, error.message || 'Error downloading resume', 500);
  }
};

/**
 * @desc    Check if candidate has applied to a job
 * @route   GET /api/v1/applications/check/:jobId
 * @access  Private (Candidate)
 */
export const checkApplicationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.params;
    const userId = req.user?._id;

    const application = await Application.findOne({
      jobId,
      candidateId: userId,
      deletedAt: null,
    });

    return sendSuccess(res, {
      hasApplied: !!application,
      application: application ? {
        _id: application._id,
        status: application.status,
        appliedAt: application.createdAt,
      } : null,
    }, 'Application status retrieved');
  } catch (error: any) {
    logger.error('Error in checkApplicationStatus:', error);
    return sendError(res, error.message || 'Error checking application status', 500);
  }
};
