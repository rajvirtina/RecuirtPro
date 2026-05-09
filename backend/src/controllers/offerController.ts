import { Response } from 'express';
import { AuthRequest, OfferStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import { Offer, Application, Job, AuditLog } from '../models';
import { isSuperAdmin, getTenantCompanyId } from '../middleware/auth';
import logger from '../utils/logger';
import { notificationService } from '../services/notificationService';

// Valid offer status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  [OfferStatus.DRAFT]: [OfferStatus.PENDING_APPROVAL, OfferStatus.SENT, OfferStatus.WITHDRAWN],
  [OfferStatus.PENDING_APPROVAL]: [OfferStatus.APPROVED, OfferStatus.DRAFT, OfferStatus.WITHDRAWN],
  [OfferStatus.APPROVED]: [OfferStatus.SENT, OfferStatus.WITHDRAWN],
  [OfferStatus.SENT]: [OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.NEGOTIATING, OfferStatus.WITHDRAWN, OfferStatus.EXPIRED],
  [OfferStatus.NEGOTIATING]: [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN],
  [OfferStatus.ACCEPTED]: [],
  [OfferStatus.REJECTED]: [],
  [OfferStatus.WITHDRAWN]: [],
  [OfferStatus.EXPIRED]: [OfferStatus.SENT], // can resend
};

/**
 * @desc    Create offer for an application
 * @route   POST /api/v1/offers
 * @access  Private (HR/Admin)
 */
export const createOffer = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const {
      applicationId, salary, bonus, equity, designation, department,
      reportingTo, joiningDate, location, workMode, probationPeriod,
      noticePeriod, benefits, additionalTerms,
    } = req.body;

    if (!applicationId || !salary?.amount || !designation || !joiningDate) {
      return sendError(res, 'applicationId, salary, designation, and joiningDate are required', 400);
    }

    const application = await Application.findById(applicationId);
    if (!application) return sendError(res, 'Application not found', 404);

    // Tenant check
    if (application.companyId?.toString() !== companyId) {
      return sendError(res, 'Not authorized', 403);
    }

    // Check for existing offer
    const existing = await Offer.findOne({ applicationId, deletedAt: null });
    if (existing) return sendError(res, 'Offer already exists for this application', 400);

    const offer = await Offer.create({
      companyId,
      applicationId,
      jobId: application.jobId,
      candidateId: application.candidateId,
      createdBy: req.user!._id,
      status: OfferStatus.DRAFT,
      salary, bonus, equity, designation, department, reportingTo,
      joiningDate: new Date(joiningDate), location, workMode,
      probationPeriod, noticePeriod, benefits, additionalTerms,
      statusHistory: [{
        status: OfferStatus.DRAFT,
        changedBy: req.user!._id,
        changedAt: new Date(),
        remarks: 'Offer created',
      }],
    });

    logger.info(`Offer created for application ${applicationId} by ${req.user?.email}`);
    return sendSuccess(res, offer, 'Offer created', 201);
  } catch (error: any) {
    logger.error('Error in createOffer:', error);
    return sendError(res, error.message || 'Failed to create offer', 500);
  }
};

/**
 * @desc    Get offers for company
 * @route   GET /api/v1/offers
 * @access  Private (HR/Admin)
 */
export const getOffers = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId && !isSuperAdmin(req.user)) return sendError(res, 'Company context required', 400);

    const { page = 1, limit = 20, status } = req.query;
    const { pageNum, limitNum } = clampPagination(page, limit);

    const query: any = { deletedAt: null };
    if (companyId) query.companyId = companyId;
    if (status) query.status = status;

    const [offers, total] = await Promise.all([
      Offer.find(query)
        .populate('candidateId', 'firstName lastName email')
        .populate('jobId', 'title')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum).limit(limitNum),
      Offer.countDocuments(query),
    ]);

    return sendPaginatedResponse(res, offers, pageNum, limitNum, total, 'Offers retrieved');
  } catch (error: any) {
    logger.error('Error in getOffers:', error);
    return sendError(res, error.message || 'Failed to get offers', 500);
  }
};

/**
 * @desc    Get offer by ID
 * @route   GET /api/v1/offers/:id
 * @access  Private (HR/Admin/Candidate)
 */
export const getOfferById = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const offer = await Offer.findOne({ _id: req.params.id, deletedAt: null })
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title location')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!offer) return sendError(res, 'Offer not found', 404);

    // Tenant check — candidate can see their own offer
    const tenantId = getTenantCompanyId(req.user);
    const isCandidateViewing = offer.candidateId && (offer.candidateId as any)._id?.toString() === req.user?._id;
    if (tenantId && offer.companyId.toString() !== tenantId && !isCandidateViewing) {
      return sendError(res, 'Not authorized', 403);
    }

    return sendSuccess(res, offer, 'Offer retrieved');
  } catch (error: any) {
    logger.error('Error in getOfferById:', error);
    return sendError(res, error.message || 'Failed to get offer', 500);
  }
};

/**
 * @desc    Update offer status with transition validation
 * @route   PUT /api/v1/offers/:id/status
 * @access  Private (HR/Admin/Candidate for accept/reject)
 */
export const updateOfferStatus = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { status, remarks, candidateComments } = req.body;

    const offer = await Offer.findOne({ _id: id, deletedAt: null });
    if (!offer) return sendError(res, 'Offer not found', 404);

    // Tenant check
    const tenantId = getTenantCompanyId(req.user);
    const isCandidateAction = offer.candidateId.toString() === req.user?._id;
    if (tenantId && offer.companyId.toString() !== tenantId && !isCandidateAction) {
      return sendError(res, 'Not authorized', 403);
    }

    // Candidate can only accept, reject, or negotiate
    if (isCandidateAction && !['accepted', 'rejected', 'negotiating'].includes(status)) {
      return sendError(res, 'You can only accept, reject, or negotiate', 400);
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[offer.status] || [];
    if (!allowed.includes(status)) {
      return sendError(res, `Cannot transition from '${offer.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`, 400);
    }

    offer.status = status;
    if (status === OfferStatus.SENT && !offer.sentAt) {
      offer.sentAt = new Date();
      offer.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
    if (status === OfferStatus.ACCEPTED || status === OfferStatus.REJECTED) {
      offer.respondedAt = new Date();
    }
    if (status === OfferStatus.APPROVED) {
      offer.approvedBy = req.user!._id as any;
      offer.approvedAt = new Date();
      offer.approvalComments = remarks;
    }
    if (candidateComments) offer.candidateComments = candidateComments;

    offer.statusHistory.push({
      status, changedBy: req.user!._id as any, changedAt: new Date(), remarks,
    });
    await offer.save();

    // Update application status when offer is accepted
    if (status === OfferStatus.ACCEPTED) {
      await Application.findByIdAndUpdate(offer.applicationId, {
        status: ApplicationStatus.HIRED,
        $push: {
          statusHistory: {
            status: ApplicationStatus.HIRED,
            changedBy: req.user!._id,
            changedAt: new Date(),
            remarks: 'Offer accepted by candidate',
          },
        },
      });
    }

    // Send notification
    try {
      if (status === OfferStatus.SENT) {
        await notificationService.createNotification({
          userId: offer.candidateId.toString(),
          type: 'in_app',
          title: 'New Offer Letter',
          message: `You have received an offer for ${offer.designation}. Please review and respond.`,
          priority: 'high',
          data: { offerId: offer._id, type: 'offer_sent' },
        });
      }
    } catch (e) {
      logger.warn('Failed to send offer notification');
    }

    logger.info(`Offer ${id} status updated to ${status} by ${req.user?.email}`);
    return sendSuccess(res, offer, 'Offer status updated');
  } catch (error: any) {
    logger.error('Error in updateOfferStatus:', error);
    return sendError(res, error.message || 'Failed to update offer', 500);
  }
};

/**
 * @desc    Update offer details (salary negotiation etc.)
 * @route   PUT /api/v1/offers/:id
 * @access  Private (HR/Admin)
 */
export const updateOffer = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const offer = await Offer.findOne({ _id: id, companyId, deletedAt: null });
    if (!offer) return sendError(res, 'Offer not found', 404);

    // Can only edit draft or negotiating offers
    if (![OfferStatus.DRAFT, OfferStatus.NEGOTIATING].includes(offer.status as OfferStatus)) {
      return sendError(res, `Cannot edit offer in '${offer.status}' status`, 400);
    }

    const allowedFields = ['salary', 'bonus', 'equity', 'designation', 'department',
      'reportingTo', 'joiningDate', 'location', 'workMode', 'probationPeriod',
      'noticePeriod', 'benefits', 'additionalTerms', 'offerLetterHtml'];

    const updates: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Track negotiation round
    if (offer.status === OfferStatus.NEGOTIATING) {
      const round = (offer.negotiations?.length || 0) + 1;
      offer.negotiations = offer.negotiations || [];
      offer.negotiations.push({
        round,
        proposedBy: 'company',
        changes: updates,
        comments: req.body.negotiationComments,
        createdAt: new Date(),
      });
    }

    Object.assign(offer, updates);
    await offer.save();

    return sendSuccess(res, offer, 'Offer updated');
  } catch (error: any) {
    logger.error('Error in updateOffer:', error);
    return sendError(res, error.message || 'Failed to update offer', 500);
  }
};

/**
 * @desc    Generate offer letter HTML
 * @route   POST /api/v1/offers/:id/generate-letter
 * @access  Private (HR/Admin)
 */
export const generateOfferLetter = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const offer = await Offer.findOne({ _id: id, companyId, deletedAt: null })
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title')
      .populate('companyId', 'name');

    if (!offer) return sendError(res, 'Offer not found', 404);

    const candidate = offer.candidateId as any;
    const job = offer.jobId as any;
    const company = offer.companyId as any;

    const letterHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a365d;">${company?.name || 'Company'}</h1>
          <h2 style="color: #4a5568;">Offer of Employment</h2>
        </div>
        <p>Date: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>Dear <strong>${candidate?.firstName} ${candidate?.lastName}</strong>,</p>
        <p>We are pleased to offer you the position of <strong>${offer.designation}</strong>${offer.department ? ` in the ${offer.department} department` : ''} at ${company?.name || 'our company'}.</p>
        <h3>Position Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Designation</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.designation}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Department</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.department || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Location</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.location || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Work Mode</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.workMode || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Joining Date</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(offer.joiningDate).toLocaleDateString('en-IN')}</td></tr>
        </table>
        <h3>Compensation</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Salary</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.salary.currency} ${offer.salary.amount.toLocaleString()} (${offer.salary.frequency})</td></tr>
          ${offer.bonus ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Bonus</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.salary.currency} ${offer.bonus.amount?.toLocaleString()} (${offer.bonus.type})</td></tr>` : ''}
          ${offer.probationPeriod ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Probation</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${offer.probationPeriod} months</td></tr>` : ''}
        </table>
        ${offer.benefits?.length ? `<h3>Benefits</h3><ul>${offer.benefits.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
        ${offer.additionalTerms ? `<h3>Additional Terms</h3><p>${offer.additionalTerms}</p>` : ''}
        <p style="margin-top: 30px;">Please confirm your acceptance within 7 days of receiving this offer.</p>
        <p>We look forward to welcoming you to our team!</p>
        <p style="margin-top: 40px;">Warm regards,<br/><strong>${company?.name || 'HR Team'}</strong></p>
      </div>
    `;

    offer.offerLetterHtml = letterHtml;
    await offer.save();

    return sendSuccess(res, { offerLetterHtml: letterHtml }, 'Offer letter generated');
  } catch (error: any) {
    logger.error('Error in generateOfferLetter:', error);
    return sendError(res, error.message || 'Failed to generate letter', 500);
  }
};
