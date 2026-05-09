import { Response } from 'express';
import { Application, Job, CandidateProfile, User } from '../models';
import { AuthRequest, JobStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse } from '../utils/response';
import logger from '../utils/logger';

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

    // Create application
    const application = await Application.create({
      jobId,
      candidateId: userId,
      companyId: job.companyId,
      coverLetter,
      resumeUrl: resumeUrl || candidateProfile.resumeUrl,
      expectedSalary,
      status: ApplicationStatus.APPLIED,
    });

    // Increment application count on job
    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicationCount: 1 },
    });

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
    } else if (req.user?.role === 'employer' || req.user?.role === 'hr') {
      // Employers/HR see applications for their company's jobs
      if (req.user.companyId) {
        query.companyId = req.user.companyId;
      }
    }

    // Apply filters
    if (jobId) query.jobId = jobId;
    if (status) query.status = status;
    if (candidateId && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
      query.candidateId = candidateId;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
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
    const isAdmin = req.user?.role === 'admin';
    
    // HR/Employer can only view applications for their company's jobs
    let isAuthorizedHROrEmployer = false;
    if (req.user?.role === 'hr' || req.user?.role === 'employer') {
      if (req.user?.companyId && application.companyId) {
        isAuthorizedHROrEmployer = application.companyId.toString() === req.user.companyId.toString();
      }
    }

    if (!isOwner && !isAuthorizedHROrEmployer && !isAdmin) {
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

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      req.user?.role === 'employer' ||
      req.user?.role === 'hr';

    if (!isAuthorized) {
      return sendError(
        res,
        'Not authorized to update this application',
        403
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

    // Soft delete
    application.status = ApplicationStatus.WITHDRAWN;
    application.deletedAt = new Date();
    application.statusHistory.push({
      status: ApplicationStatus.WITHDRAWN,
      changedAt: new Date(),
      changedBy: req.user?._id! as any,
      remarks: 'Application withdrawn by candidate',
    });

    await application.save();

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
    if (req.user?.role === 'employer' || req.user?.role === 'hr') {
      if (req.user.companyId) {
        matchQuery.companyId = req.user.companyId;
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
    const isCompanyHR = req.user?.companyId === application.companyId?.toString();
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isCompanyHR && !isAdmin) {
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
