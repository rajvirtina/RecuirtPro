"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePipelineStages = exports.getPipelineStages = exports.uploadLogo = exports.updateBranding = exports.updateCompanySettings = exports.getCompanySettings = void 0;
const models_1 = require("../models");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * GET /api/v1/companies/settings
 */
const getCompanySettings = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        const company = await models_1.Company.findById(companyId).lean();
        if (!company)
            return (0, response_1.sendError)(res, 'Company not found', 404);
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        logger_1.default.error('Error in getCompanySettings:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching company settings', 500);
    }
};
exports.getCompanySettings = getCompanySettings;
/**
 * PATCH /api/v1/companies/settings
 */
const updateCompanySettings = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        const { name, website, industry, size, settings, notifications } = req.body;
        const update = {};
        if (name)
            update.name = name;
        if (website !== undefined)
            update.website = website;
        if (industry !== undefined)
            update.industry = industry;
        if (size !== undefined)
            update.size = size;
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
        const company = await models_1.Company.findByIdAndUpdate(companyId, { $set: update }, { new: true }).lean();
        if (!company)
            return (0, response_1.sendError)(res, 'Company not found', 404);
        return (0, response_1.sendSuccess)(res, company, 'Settings updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateCompanySettings:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating settings', 500);
    }
};
exports.updateCompanySettings = updateCompanySettings;
/**
 * PATCH /api/v1/companies/branding
 */
const updateBranding = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        const { primaryColor, faviconUrl, logoUrl } = req.body;
        const update = {};
        if (primaryColor) {
            if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
                return (0, response_1.sendError)(res, 'Invalid hex color format', 400);
            }
            update['branding.primaryColor'] = primaryColor;
        }
        if (faviconUrl !== undefined)
            update['branding.faviconUrl'] = faviconUrl;
        if (logoUrl !== undefined)
            update['branding.logoUrl'] = logoUrl;
        const company = await models_1.Company.findByIdAndUpdate(companyId, { $set: update }, { new: true }).lean();
        if (!company)
            return (0, response_1.sendError)(res, 'Company not found', 404);
        return (0, response_1.sendSuccess)(res, company.branding, 'Branding updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateBranding:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating branding', 500);
    }
};
exports.updateBranding = updateBranding;
/**
 * POST /api/v1/companies/branding/logo — multipart upload
 */
const uploadLogo = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        if (!req.file)
            return (0, response_1.sendError)(res, 'No file uploaded', 400);
        // Use the uploaded file path (multer saves to uploads/ or S3 depending on config)
        const logoUrl = `/uploads/${req.file.filename}`;
        await models_1.Company.findByIdAndUpdate(companyId, { $set: { 'branding.logoUrl': logoUrl } });
        return (0, response_1.sendSuccess)(res, { logoUrl }, 'Logo uploaded');
    }
    catch (error) {
        logger_1.default.error('Error in uploadLogo:', error);
        return (0, response_1.sendError)(res, error.message || 'Error uploading logo', 500);
    }
};
exports.uploadLogo = uploadLogo;
/**
 * GET /api/v1/companies/pipeline-stages
 */
const getPipelineStages = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        const company = await models_1.Company.findById(companyId).select('defaultPipelineStages').lean();
        if (!company)
            return (0, response_1.sendError)(res, 'Company not found', 404);
        return (0, response_1.sendSuccess)(res, company.defaultPipelineStages || []);
    }
    catch (error) {
        logger_1.default.error('Error in getPipelineStages:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching pipeline stages', 500);
    }
};
exports.getPipelineStages = getPipelineStages;
/**
 * PUT /api/v1/companies/pipeline-stages
 */
const updatePipelineStages = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        if (!companyId)
            return (0, response_1.sendError)(res, 'No company associated', 400);
        const { stages } = req.body;
        if (!Array.isArray(stages))
            return (0, response_1.sendError)(res, 'stages must be an array', 400);
        // Validate each stage
        for (const stage of stages) {
            if (!stage.id || !stage.label || stage.order === undefined) {
                return (0, response_1.sendError)(res, 'Each stage must have id, label, and order', 400);
            }
        }
        const company = await models_1.Company.findByIdAndUpdate(companyId, { $set: { defaultPipelineStages: stages } }, { new: true }).lean();
        if (!company)
            return (0, response_1.sendError)(res, 'Company not found', 404);
        return (0, response_1.sendSuccess)(res, company.defaultPipelineStages, 'Pipeline stages updated');
    }
    catch (error) {
        logger_1.default.error('Error in updatePipelineStages:', error);
        return (0, response_1.sendError)(res, error.message || 'Error updating pipeline stages', 500);
    }
};
exports.updatePipelineStages = updatePipelineStages;
//# sourceMappingURL=companySettingsController.js.map