import { Request, Response } from 'express';
import { Company } from '../models';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import { getTenantCompanyId } from '../middleware/auth';

/**
 * GET /api/v1/companies/public/:slug/branding
 * Public — no auth required. Returns branding for the white-label portal.
 */
export const getPublicBranding = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) return sendError(res, 'Slug is required', 400);

    const company = await Company.findOne({ slug, status: 'active', deletedAt: null }).lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, {
      name: company.name,
      slug: company.slug,
      logo: company.logo || company.branding?.logoUrl || null,
      description: company.description || null,
      website: company.website || null,
      branding: {
        primaryColor: company.branding?.primaryColor || '#4f46e5',
        logoUrl: company.branding?.logoUrl || company.logo || null,
        faviconUrl: company.branding?.faviconUrl || null,
        customDomain: company.branding?.customDomain || null,
      },
    }, 'Public branding retrieved');
  } catch (error: any) {
    logger.error('Error in getPublicBranding:', error);
    return sendError(res, 'Error fetching company branding', 500);
  }
};

/**
 * GET /api/v1/companies/settings
 */
export const getCompanySettings = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    const company = await Company.findById(companyId).lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, {
      name: company.name,
      slug: company.slug,
      email: company.email,
      website: company.website,
      industry: company.industry,
      size: company.size,
      branding: company.branding || {},
      settings: company.settings || {},
      notifications: company.notifications || {},
      defaultPipelineStages: company.defaultPipelineStages || [],
    });
  } catch (error: any) {
    logger.error('Error in getCompanySettings:', error);
    return sendError(res, error.message || 'Error fetching company settings', 500);
  }
};

/**
 * PATCH /api/v1/companies/settings
 */
export const updateCompanySettings = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    const { name, website, industry, size, settings, notifications } = req.body;

    const update: Record<string, any> = {};
    if (name) update.name = name;
    if (website !== undefined) update.website = website;
    if (industry !== undefined) update.industry = industry;
    if (size !== undefined) update.size = size;
    if (settings) {
      for (const [k, v] of Object.entries(settings)) {
        update[`settings.${k}`] = v;
      }
    }
    if (notifications) {
      for (const [k, v] of Object.entries(notifications)) {
        update[`notifications.${k}`] = v;
      }
    }

    const company = await Company.findByIdAndUpdate(companyId, { $set: update }, { new: true }).lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, company, 'Settings updated');
  } catch (error: any) {
    logger.error('Error in updateCompanySettings:', error);
    return sendError(res, error.message || 'Error updating settings', 500);
  }
};

/**
 * PATCH /api/v1/companies/branding
 */
export const updateBranding = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    const { primaryColor, faviconUrl, logoUrl, customDomain } = req.body;

    const update: Record<string, any> = {};
    if (primaryColor) {
      if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
        return sendError(res, 'Invalid hex color format', 400);
      }
      update['branding.primaryColor'] = primaryColor;
    }
    if (faviconUrl !== undefined) update['branding.faviconUrl'] = faviconUrl;
    if (logoUrl !== undefined) update['branding.logoUrl'] = logoUrl;
    if (customDomain !== undefined) update['branding.customDomain'] = customDomain || null;

    const company = await Company.findByIdAndUpdate(companyId, { $set: update }, { new: true }).lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, company.branding, 'Branding updated');
  } catch (error: any) {
    logger.error('Error in updateBranding:', error);
    return sendError(res, error.message || 'Error updating branding', 500);
  }
};

/**
 * POST /api/v1/companies/branding/logo — multipart upload
 */
export const uploadLogo = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    if (!req.file) return sendError(res, 'No file uploaded', 400);

    // Use the uploaded file path (multer saves to uploads/ or S3 depending on config)
    const logoUrl = `/uploads/${req.file.filename}`;

    await Company.findByIdAndUpdate(companyId, { $set: { 'branding.logoUrl': logoUrl } });

    return sendSuccess(res, { logoUrl }, 'Logo uploaded');
  } catch (error: any) {
    logger.error('Error in uploadLogo:', error);
    return sendError(res, error.message || 'Error uploading logo', 500);
  }
};

/**
 * GET /api/v1/companies/pipeline-stages
 */
export const getPipelineStages = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    const company = await Company.findById(companyId).select('defaultPipelineStages').lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, company.defaultPipelineStages || []);
  } catch (error: any) {
    logger.error('Error in getPipelineStages:', error);
    return sendError(res, error.message || 'Error fetching pipeline stages', 500);
  }
};

/**
 * PUT /api/v1/companies/pipeline-stages
 */
export const updatePipelineStages = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = getTenantCompanyId(req.user);
    if (!companyId) return sendError(res, 'No company associated', 400);

    const { stages } = req.body;
    if (!Array.isArray(stages)) return sendError(res, 'stages must be an array', 400);

    // Validate each stage
    for (const stage of stages) {
      if (!stage.id || !stage.label || stage.order === undefined) {
        return sendError(res, 'Each stage must have id, label, and order', 400);
      }
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      { $set: { defaultPipelineStages: stages } },
      { new: true }
    ).lean();
    if (!company) return sendError(res, 'Company not found', 404);

    return sendSuccess(res, company.defaultPipelineStages, 'Pipeline stages updated');
  } catch (error: any) {
    logger.error('Error in updatePipelineStages:', error);
    return sendError(res, error.message || 'Error updating pipeline stages', 500);
  }
};
