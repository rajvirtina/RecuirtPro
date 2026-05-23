"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Company = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const companySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true,
    },
    slug: {
        type: String,
        required: [true, 'Company slug is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    },
    email: {
        type: String,
        required: [true, 'Company email is required'],
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    website: {
        type: String,
        trim: true,
    },
    logo: {
        type: String,
    },
    description: {
        type: String,
    },
    industry: {
        type: String,
    },
    size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
    },
    settings: {
        enableProctoring: {
            type: Boolean,
            default: true,
        },
        enableNaukriIntegration: {
            type: Boolean,
            default: false,
        },
        enableLinkedInIntegration: {
            type: Boolean,
            default: false,
        },
        dataRetentionDays: {
            type: Number,
            default: 365,
        },
        timezone: { type: String, default: 'Asia/Kolkata' },
        dateFormat: { type: String, default: 'DD/MM/YYYY' },
        currency: { type: String, default: 'INR' },
        language: { type: String, default: 'en' },
    },
    branding: {
        logoUrl: String,
        primaryColor: { type: String, default: '#4f46e5' },
        faviconUrl: String,
        customDomain: { type: String, trim: true },
    },
    defaultPipelineStages: {
        type: [{
                id: { type: String, required: true },
                label: { type: String, required: true },
                order: { type: Number, required: true },
                color: { type: String, default: '#6366f1' },
                emailTemplateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
            }],
        default: [
            { id: 'applied', label: 'Applied', order: 0, color: '#6366f1' },
            { id: 'screening', label: 'Screening', order: 1, color: '#f59e0b' },
            { id: 'interview', label: 'Interview', order: 2, color: '#3b82f6' },
            { id: 'offer', label: 'Offer', order: 3, color: '#10b981' },
            { id: 'hired', label: 'Hired', order: 4, color: '#22c55e' },
        ],
    },
    notifications: {
        emailOnNewApplication: { type: Boolean, default: true },
        emailOnStageChange: { type: Boolean, default: true },
        smsEnabled: { type: Boolean, default: false },
        dailyDigest: { type: Boolean, default: false },
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending_verification'],
        default: 'pending_verification',
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationToken: {
        type: String,
        select: false,
    },
    emailVerificationExpires: {
        type: Date,
        select: false,
    },
    deletedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
companySchema.index({ name: 1, deletedAt: 1 });
companySchema.index({ slug: 1, deletedAt: 1 });
exports.Company = mongoose_1.default.model('Company', companySchema);
//# sourceMappingURL=Company.js.map