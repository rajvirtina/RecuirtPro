import { Response } from 'express';
import { AuthRequest, OfferStatus, ApplicationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import { Offer, Application, Job, AuditLog, User } from '../models';
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

      if (status === OfferStatus.ACCEPTED || status === OfferStatus.REJECTED) {
        // Notify company HR users — we use the offer's companyId to find them
        const hrUsers = await User.find({
          companyId: offer.companyId,
          role: { $in: ['hr', 'employer', 'admin'] },
          isActive: true,
        }).select('_id').lean();
        const hrIds = hrUsers.map((u: any) => u._id.toString());

        if (hrIds.length > 0) {
          const candidateDoc = await User.findById(offer.candidateId).select('firstName lastName').lean();
          const candName = candidateDoc
            ? `${(candidateDoc as any).firstName} ${(candidateDoc as any).lastName}`.trim()
            : 'Candidate';

          await notificationService.notifyOfferActioned(
            hrIds,
            candName,
            offer.designation || 'the position',
            status === OfferStatus.ACCEPTED ? 'accepted' : 'rejected',
            (offer._id as any).toString()
          );
        }
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

/**
 * @desc    Generate and stream offer letter as PDF (pdfkit)
 * @route   GET /api/v1/offers/:id/pdf
 * @access  Private (HR / Admin / Employer / Candidate — own offer only)
 */
export const downloadOfferPDF = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const offer = await Offer.findOne({ _id: id, deletedAt: null })
      .populate('candidateId', 'firstName lastName email')
      .populate('jobId', 'title')
      .populate('companyId', 'name');

    if (!offer) return sendError(res, 'Offer not found', 404);

    // Tenant isolation: HR/Admin use companyId; candidates can only access their own offer
    const tenantId = getTenantCompanyId(req.user);
    const isCandidateViewing =
      offer.candidateId && (offer.candidateId as any)._id?.toString() === req.user?._id;
    if (tenantId && offer.companyId?.toString() !== tenantId && !isCandidateViewing) {
      return sendError(res, 'Not authorized', 403);
    }
    if (!tenantId && !isCandidateViewing && !isSuperAdmin(req.user)) {
      return sendError(res, 'Not authorized', 403);
    }

    // Candidates can only download letters that have been formally sent
    if (isCandidateViewing && !['sent', 'accepted', 'negotiating', 'expired'].includes(offer.status)) {
      return sendError(res, 'Offer letter is not yet available', 403);
    }

    const candidate = offer.candidateId as any;
    const job       = offer.jobId       as any;
    const company   = offer.companyId   as any;

    // Lazy-load pdfkit (optional dep)
    let PDFDocument: any;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      return sendError(res, 'PDF generation is not available (pdfkit not installed). Please install it: npm install pdfkit', 500);
    }

    const doc = new PDFDocument({ margin: 60, size: 'A4' });

    const safeFilename = `offer_${candidate?.firstName || 'candidate'}_${candidate?.lastName || ''}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    doc.pipe(res);

    const currency = offer.salary?.currency || 'INR';
    const fmt = (n: number | undefined) =>
      n != null ? n.toLocaleString('en-IN') : 'N/A';
    const inDate = (d: Date | undefined) =>
      d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';

    // ── Header ────────────────────────────────────────────────────────────────
    doc
      .fontSize(22).font('Helvetica-Bold').text(company?.name || 'Company', { align: 'center' })
      .moveDown(0.3)
      .fontSize(14).font('Helvetica').text('Appointment / Offer Letter', { align: 'center' })
      .moveDown(0.2)
      .fontSize(10).fillColor('#666666').text('PRIVATE & CONFIDENTIAL', { align: 'center' })
      .fillColor('#000000')
      .moveDown(1);

    // ── Date + Ref ────────────────────────────────────────────────────────────
    doc.fontSize(11)
      .text(`Date: ${inDate(new Date())}`, { continued: true })
      .text(`                  Ref: ${(offer as any)._id?.toString().slice(-8).toUpperCase() || ''}`, { align: 'right' })
      .moveDown(0.8);

    // ── Salutation ────────────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').text(`${candidate?.firstName} ${candidate?.lastName}`)
      .font('Helvetica').text(candidate?.email || '')
      .moveDown(0.8);

    doc.text(
      `Dear ${candidate?.firstName},`
    ).moveDown(0.4);
    doc.text(
      `We are pleased to extend an offer of employment for the position of ` +
      `${offer.designation}${offer.department ? `, ${offer.department} Department` : ''} ` +
      `at ${company?.name || 'our organisation'}. The terms and conditions of your employment are set out below.`
    ).moveDown(1);

    // ── 1. Position Details ───────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('1.  Position Details').moveDown(0.4);
    doc.fontSize(11).font('Helvetica');

    const posRows: [string, string][] = [
      ['Designation',       offer.designation],
      ['Department',        offer.department || 'N/A'],
      ['Reporting To',      offer.reportingTo || 'To be communicated'],
      ['Location',          offer.location   || 'N/A'],
      ['Work Mode',         (offer.workMode   || 'onsite').replace(/^\w/, c => c.toUpperCase())],
      ['Date of Joining',   inDate(offer.joiningDate)],
    ];
    for (const [label, value] of posRows) {
      doc
        .font('Helvetica-Bold').text(`${label}:  `, { continued: true })
        .font('Helvetica').text(value)
        .moveDown(0.2);
    }
    doc.moveDown(0.6);

    // ── 2. CTC Breakdown ─────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('2.  Compensation (Cost to Company)').moveDown(0.4);
    doc.fontSize(11).font('Helvetica');

    if (offer.salary?.amount) {
      const annualCtc  = offer.salary.frequency === 'monthly'
        ? offer.salary.amount * 12
        : offer.salary.amount;

      const grossMonthly = Math.round(annualCtc / 12);

      // Standard Indian breakup approximation (customise per company policy)
      const basic        = Math.round(grossMonthly * 0.40);  // 40% of gross
      const hra          = Math.round(grossMonthly * 0.20);  // 20% (metro)
      const transport    = 1600;                              // ₹1,600 statutory limit
      const special      = grossMonthly - basic - hra - transport;

      const pfEmployee   = Math.round(basic * 0.12);         // 12% of basic (capped ₹15k basic)
      const pfEmployer   = Math.round(basic * 0.12);         // matched by employer
      const professionalTax = 200;                           // ₹200/month (most states)

      // Deductions
      const netMonthly   = grossMonthly - pfEmployee - professionalTax;

      // Table header
      const tLeft  = 80;
      const tRight = 450;
      const tY     = doc.y;

      const headerBg = '#1a56db';
      doc.rect(tLeft, tY, tRight - tLeft, 18).fill(headerBg);
      doc
        .fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
        .text('Salary Component', tLeft + 4, tY + 4, { width: 200 })
        .text('Monthly (₹)', tLeft + 210, tY + 4, { width: 100, align: 'right' })
        .text('Annual (₹)',   tLeft + 316, tY + 4, { width: 120, align: 'right' });

      doc.fillColor('#000000').font('Helvetica').fontSize(10);

      const tableRows: [string, number][] = [
        ['Basic Salary',              basic],
        ['House Rent Allowance (HRA)', hra],
        ['Transport Allowance',        transport],
        ['Special Allowance',          special],
      ];

      let rowY = tY + 20;
      let alternate = false;
      for (const [label, monthly] of tableRows) {
        if (alternate) doc.rect(tLeft, rowY, tRight - tLeft, 16).fill('#f0f4ff');
        doc
          .fillColor('#000000')
          .text(label,             tLeft + 4, rowY + 3, { width: 200 })
          .text(fmt(monthly),      tLeft + 210, rowY + 3, { width: 100, align: 'right' })
          .text(fmt(monthly * 12), tLeft + 316, rowY + 3, { width: 120, align: 'right' });
        rowY += 18;
        alternate = !alternate;
      }

      // Gross row
      doc.rect(tLeft, rowY, tRight - tLeft, 18).fill('#e8f0fe');
      doc
        .fillColor('#000000').font('Helvetica-Bold')
        .text('Gross Monthly CTC',  tLeft + 4,   rowY + 4, { width: 200 })
        .text(fmt(grossMonthly),    tLeft + 210, rowY + 4, { width: 100, align: 'right' })
        .text(fmt(annualCtc),       tLeft + 316, rowY + 4, { width: 120, align: 'right' });
      rowY += 20;

      // PF rows
      doc.font('Helvetica').fillColor('#555555');
      doc.text(`  Employer PF Contribution (12% of Basic):`,    tLeft + 4, rowY + 2).moveDown(0);
      doc.text(fmt(pfEmployer), tLeft + 210, rowY + 2, { width: 100, align: 'right' });
      doc.text(fmt(pfEmployer * 12), tLeft + 316, rowY + 2, { width: 120, align: 'right' });
      rowY += 18;
      doc.text(`  Employee PF Deduction (12% of Basic):`,       tLeft + 4, rowY + 2);
      doc.text(fmt(pfEmployee), tLeft + 210, rowY + 2, { width: 100, align: 'right' });
      doc.text(fmt(pfEmployee * 12), tLeft + 316, rowY + 2, { width: 120, align: 'right' });
      rowY += 18;
      doc.text(`  Professional Tax Deduction:`,                  tLeft + 4, rowY + 2);
      doc.text(fmt(professionalTax), tLeft + 210, rowY + 2, { width: 100, align: 'right' });
      doc.text(fmt(professionalTax * 12), tLeft + 316, rowY + 2, { width: 120, align: 'right' });
      rowY += 18;

      // Net take-home
      doc.rect(tLeft, rowY, tRight - tLeft, 20).fill('#dcf1dc');
      doc
        .fillColor('#000000').font('Helvetica-Bold').fontSize(11)
        .text('Approx. Net Monthly Take-Home', tLeft + 4, rowY + 4, { width: 200 })
        .text(fmt(netMonthly), tLeft + 210, rowY + 4, { width: 100, align: 'right' });

      doc.moveDown(0.3);
      doc.y = rowY + 30;
      doc
        .fontSize(9).fillColor('#888888').font('Helvetica')
        .text(
          'Note: The above breakup is indicative. Actual take-home may vary subject to applicable tax slabs, ' +
          'investment declarations under Section 80C, and other statutory obligations.',
          { align: 'justify' }
        )
        .fillColor('#000000').fontSize(11);
    }

    if ((offer as any).bonus?.amount) {
      doc.moveDown(0.4).font('Helvetica')
        .text(`Performance Bonus: ${currency} ${fmt((offer as any).bonus.amount)} (${(offer as any).bonus.type})`);
    }
    doc.moveDown(0.6);

    // ── 3. Employment Terms ───────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('3.  Employment Terms').moveDown(0.4);
    doc.fontSize(11).font('Helvetica');

    if (offer.probationPeriod) {
      doc.text(`Probation Period:  ${offer.probationPeriod} month(s)`).moveDown(0.2);
    }
    if (offer.noticePeriod != null) {
      const np = offer.noticePeriod >= 30
        ? `${Math.round(offer.noticePeriod / 30)} month(s)`
        : `${offer.noticePeriod} day(s)`;
      doc.text(`Notice Period (post-confirmation):  ${np}`).moveDown(0.2);
    }
    if ((offer as any).expiresAt) {
      doc.text(`Offer Valid Until:  ${inDate((offer as any).expiresAt)}`).moveDown(0.2);
    }
    doc.moveDown(0.6);

    // ── 4. Benefits ───────────────────────────────────────────────────────────
    if (Array.isArray(offer.benefits) && offer.benefits.length > 0) {
      doc.fontSize(13).font('Helvetica-Bold').text('4.  Benefits').moveDown(0.4);
      doc.fontSize(11).font('Helvetica');
      for (const b of offer.benefits) {
        doc.text(`  •  ${b}`).moveDown(0.1);
      }
      doc.moveDown(0.6);
    }

    // ── 5. Additional Terms / Special Conditions ──────────────────────────────
    if ((offer as any).additionalTerms) {
      doc.fontSize(13).font('Helvetica-Bold').text('5.  Additional Terms').moveDown(0.4);
      doc.fontSize(11).font('Helvetica').text((offer as any).additionalTerms, { align: 'justify' }).moveDown(0.6);
    }

    // ── 6. Confidentiality & Non-Solicitation ─────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text('6.  Confidentiality & Non-Solicitation').moveDown(0.4);
    doc.fontSize(11).font('Helvetica').text(
      'During and for a period of 12 months following the termination of your employment, you agree not to ' +
      'solicit or recruit any employee of the Company or its affiliates. You shall maintain strict ' +
      'confidentiality of all proprietary and business-sensitive information obtained in the course of your ' +
      'employment. A detailed Non-Disclosure and Confidentiality Agreement will be provided at on-boarding.',
      { align: 'justify' }
    ).moveDown(0.8);

    // ── Acceptance ────────────────────────────────────────────────────────────
    doc.fontSize(11)
      .font('Helvetica-Bold').text('Acceptance of Offer')
      .font('Helvetica').moveDown(0.3)
      .text(
        `Please sign and return a copy of this letter by ${(offer as any).expiresAt ? inDate((offer as any).expiresAt) : '7 days of the date above'} ` +
        `to indicate your acceptance of the terms herein. Failure to do so within the stipulated time will ` +
        `render this offer null and void.`,
        { align: 'justify' }
      ).moveDown(1.5);

    // ── Signature block ───────────────────────────────────────────────────────
    const sigY = doc.y;
    const pageWidth = doc.page.width - 120;

    // Two columns — Authorised signatory | Candidate acceptance
    doc
      .font('Helvetica-Bold').fontSize(11)
      .text('For ' + (company?.name || 'the Company'),  80,  sigY, { width: pageWidth / 2 - 10 })
      .text('Accepted by Candidate',                     80 + pageWidth / 2, sigY, { width: pageWidth / 2 });

    const lineY = sigY + 60;
    doc
      .moveTo(80, lineY).lineTo(80 + pageWidth / 2 - 30, lineY).stroke()
      .moveTo(80 + pageWidth / 2, lineY).lineTo(80 + pageWidth - 20, lineY).stroke();

    doc
      .font('Helvetica').fontSize(10)
      .text('Authorised Signatory / HR',  80,  lineY + 4, { width: pageWidth / 2 - 10 })
      .text('Signature & Date',           80 + pageWidth / 2, lineY + 4, { width: pageWidth / 2 });

    doc.moveDown(2);
    doc
      .font('Helvetica').fontSize(9).fillColor('#888888')
      .text(
        `This offer letter was generated on ${inDate(new Date())} and is subject to satisfactory completion of ` +
        `background verification, reference checks, and submission of all required documents prior to joining.`,
        { align: 'center' }
      );

    doc.end();

    logger.info(`[downloadOfferPDF] PDF streamed for offer ${id} by ${req.user?.email}`);
  } catch (error: any) {
    logger.error('Error in downloadOfferPDF:', error);
    if (!res.headersSent) {
      return sendError(res, error.message || 'Failed to generate PDF', 500);
    }
  }
};
