"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOfferLetter = exports.updateOffer = exports.updateOfferStatus = exports.getOfferById = exports.getOffers = exports.createOffer = void 0;
const types_1 = require("../types");
const response_1 = require("../utils/response");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const notificationService_1 = require("../services/notificationService");
// Valid offer status transitions
const VALID_TRANSITIONS = {
    [types_1.OfferStatus.DRAFT]: [types_1.OfferStatus.PENDING_APPROVAL, types_1.OfferStatus.SENT, types_1.OfferStatus.WITHDRAWN],
    [types_1.OfferStatus.PENDING_APPROVAL]: [types_1.OfferStatus.APPROVED, types_1.OfferStatus.DRAFT, types_1.OfferStatus.WITHDRAWN],
    [types_1.OfferStatus.APPROVED]: [types_1.OfferStatus.SENT, types_1.OfferStatus.WITHDRAWN],
    [types_1.OfferStatus.SENT]: [types_1.OfferStatus.ACCEPTED, types_1.OfferStatus.REJECTED, types_1.OfferStatus.NEGOTIATING, types_1.OfferStatus.WITHDRAWN, types_1.OfferStatus.EXPIRED],
    [types_1.OfferStatus.NEGOTIATING]: [types_1.OfferStatus.SENT, types_1.OfferStatus.ACCEPTED, types_1.OfferStatus.REJECTED, types_1.OfferStatus.WITHDRAWN],
    [types_1.OfferStatus.ACCEPTED]: [],
    [types_1.OfferStatus.REJECTED]: [],
    [types_1.OfferStatus.WITHDRAWN]: [],
    [types_1.OfferStatus.EXPIRED]: [types_1.OfferStatus.SENT], // can resend
};
/**
 * @desc    Create offer for an application
 * @route   POST /api/v1/offers
 * @access  Private (HR/Admin)
 */
const createOffer = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const { applicationId, salary, bonus, equity, designation, department, reportingTo, joiningDate, location, workMode, probationPeriod, noticePeriod, benefits, additionalTerms, } = req.body;
        if (!applicationId || !salary?.amount || !designation || !joiningDate) {
            return (0, response_1.sendError)(res, 'applicationId, salary, designation, and joiningDate are required', 400);
        }
        const application = await models_1.Application.findById(applicationId);
        if (!application)
            return (0, response_1.sendError)(res, 'Application not found', 404);
        // Tenant check
        if (application.companyId?.toString() !== companyId) {
            return (0, response_1.sendError)(res, 'Not authorized', 403);
        }
        // Check for existing offer
        const existing = await models_1.Offer.findOne({ applicationId, deletedAt: null });
        if (existing)
            return (0, response_1.sendError)(res, 'Offer already exists for this application', 400);
        const offer = await models_1.Offer.create({
            companyId,
            applicationId,
            jobId: application.jobId,
            candidateId: application.candidateId,
            createdBy: req.user._id,
            status: types_1.OfferStatus.DRAFT,
            salary, bonus, equity, designation, department, reportingTo,
            joiningDate: new Date(joiningDate), location, workMode,
            probationPeriod, noticePeriod, benefits, additionalTerms,
            statusHistory: [{
                    status: types_1.OfferStatus.DRAFT,
                    changedBy: req.user._id,
                    changedAt: new Date(),
                    remarks: 'Offer created',
                }],
        });
        logger_1.default.info(`Offer created for application ${applicationId} by ${req.user?.email}`);
        return (0, response_1.sendSuccess)(res, offer, 'Offer created', 201);
    }
    catch (error) {
        logger_1.default.error('Error in createOffer:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to create offer', 500);
    }
};
exports.createOffer = createOffer;
/**
 * @desc    Get offers for company
 * @route   GET /api/v1/offers
 * @access  Private (HR/Admin)
 */
const getOffers = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId && !(0, auth_1.isSuperAdmin)(req.user))
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const { page = 1, limit = 20, status } = req.query;
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const query = { deletedAt: null };
        if (companyId)
            query.companyId = companyId;
        if (status)
            query.status = status;
        const [offers, total] = await Promise.all([
            models_1.Offer.find(query)
                .populate('candidateId', 'firstName lastName email')
                .populate('jobId', 'title')
                .populate('createdBy', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum).limit(limitNum),
            models_1.Offer.countDocuments(query),
        ]);
        return (0, response_1.sendPaginatedResponse)(res, offers, pageNum, limitNum, total, 'Offers retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getOffers:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get offers', 500);
    }
};
exports.getOffers = getOffers;
/**
 * @desc    Get offer by ID
 * @route   GET /api/v1/offers/:id
 * @access  Private (HR/Admin/Candidate)
 */
const getOfferById = async (req, res) => {
    try {
        const offer = await models_1.Offer.findOne({ _id: req.params.id, deletedAt: null })
            .populate('candidateId', 'firstName lastName email')
            .populate('jobId', 'title location')
            .populate('createdBy', 'firstName lastName')
            .populate('approvedBy', 'firstName lastName');
        if (!offer)
            return (0, response_1.sendError)(res, 'Offer not found', 404);
        // Tenant check — candidate can see their own offer
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isCandidateViewing = offer.candidateId && offer.candidateId._id?.toString() === req.user?._id;
        if (tenantId && offer.companyId.toString() !== tenantId && !isCandidateViewing) {
            return (0, response_1.sendError)(res, 'Not authorized', 403);
        }
        return (0, response_1.sendSuccess)(res, offer, 'Offer retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getOfferById:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get offer', 500);
    }
};
exports.getOfferById = getOfferById;
/**
 * @desc    Update offer status with transition validation
 * @route   PUT /api/v1/offers/:id/status
 * @access  Private (HR/Admin/Candidate for accept/reject)
 */
const updateOfferStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks, candidateComments } = req.body;
        const offer = await models_1.Offer.findOne({ _id: id, deletedAt: null });
        if (!offer)
            return (0, response_1.sendError)(res, 'Offer not found', 404);
        // Tenant check
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isCandidateAction = offer.candidateId.toString() === req.user?._id;
        if (tenantId && offer.companyId.toString() !== tenantId && !isCandidateAction) {
            return (0, response_1.sendError)(res, 'Not authorized', 403);
        }
        // Candidate can only accept, reject, or negotiate
        if (isCandidateAction && !['accepted', 'rejected', 'negotiating'].includes(status)) {
            return (0, response_1.sendError)(res, 'You can only accept, reject, or negotiate', 400);
        }
        // Validate transition
        const allowed = VALID_TRANSITIONS[offer.status] || [];
        if (!allowed.includes(status)) {
            return (0, response_1.sendError)(res, `Cannot transition from '${offer.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`, 400);
        }
        offer.status = status;
        if (status === types_1.OfferStatus.SENT && !offer.sentAt) {
            offer.sentAt = new Date();
            offer.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }
        if (status === types_1.OfferStatus.ACCEPTED || status === types_1.OfferStatus.REJECTED) {
            offer.respondedAt = new Date();
        }
        if (status === types_1.OfferStatus.APPROVED) {
            offer.approvedBy = req.user._id;
            offer.approvedAt = new Date();
            offer.approvalComments = remarks;
        }
        if (candidateComments)
            offer.candidateComments = candidateComments;
        offer.statusHistory.push({
            status, changedBy: req.user._id, changedAt: new Date(), remarks,
        });
        await offer.save();
        // Update application status when offer is accepted
        if (status === types_1.OfferStatus.ACCEPTED) {
            await models_1.Application.findByIdAndUpdate(offer.applicationId, {
                status: types_1.ApplicationStatus.HIRED,
                $push: {
                    statusHistory: {
                        status: types_1.ApplicationStatus.HIRED,
                        changedBy: req.user._id,
                        changedAt: new Date(),
                        remarks: 'Offer accepted by candidate',
                    },
                },
            });
        }
        // Send notification
        try {
            if (status === types_1.OfferStatus.SENT) {
                await notificationService_1.notificationService.createNotification({
                    userId: offer.candidateId.toString(),
                    type: 'in_app',
                    title: 'New Offer Letter',
                    message: `You have received an offer for ${offer.designation}. Please review and respond.`,
                    priority: 'high',
                    data: { offerId: offer._id, type: 'offer_sent' },
                });
            }
        }
        catch (e) {
            logger_1.default.warn('Failed to send offer notification');
        }
        logger_1.default.info(`Offer ${id} status updated to ${status} by ${req.user?.email}`);
        return (0, response_1.sendSuccess)(res, offer, 'Offer status updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateOfferStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to update offer', 500);
    }
};
exports.updateOfferStatus = updateOfferStatus;
/**
 * @desc    Update offer details (salary negotiation etc.)
 * @route   PUT /api/v1/offers/:id
 * @access  Private (HR/Admin)
 */
const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const offer = await models_1.Offer.findOne({ _id: id, companyId, deletedAt: null });
        if (!offer)
            return (0, response_1.sendError)(res, 'Offer not found', 404);
        // Can only edit draft or negotiating offers
        if (![types_1.OfferStatus.DRAFT, types_1.OfferStatus.NEGOTIATING].includes(offer.status)) {
            return (0, response_1.sendError)(res, `Cannot edit offer in '${offer.status}' status`, 400);
        }
        const allowedFields = ['salary', 'bonus', 'equity', 'designation', 'department',
            'reportingTo', 'joiningDate', 'location', 'workMode', 'probationPeriod',
            'noticePeriod', 'benefits', 'additionalTerms', 'offerLetterHtml'];
        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined)
                updates[field] = req.body[field];
        }
        // Track negotiation round
        if (offer.status === types_1.OfferStatus.NEGOTIATING) {
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
        return (0, response_1.sendSuccess)(res, offer, 'Offer updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateOffer:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to update offer', 500);
    }
};
exports.updateOffer = updateOffer;
/**
 * @desc    Generate offer letter HTML
 * @route   POST /api/v1/offers/:id/generate-letter
 * @access  Private (HR/Admin)
 */
const generateOfferLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const offer = await models_1.Offer.findOne({ _id: id, companyId, deletedAt: null })
            .populate('candidateId', 'firstName lastName email')
            .populate('jobId', 'title')
            .populate('companyId', 'name');
        if (!offer)
            return (0, response_1.sendError)(res, 'Offer not found', 404);
        const candidate = offer.candidateId;
        const job = offer.jobId;
        const company = offer.companyId;
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
        return (0, response_1.sendSuccess)(res, { offerLetterHtml: letterHtml }, 'Offer letter generated');
    }
    catch (error) {
        logger_1.default.error('Error in generateOfferLetter:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to generate letter', 500);
    }
};
exports.generateOfferLetter = generateOfferLetter;
//# sourceMappingURL=offerController.js.map