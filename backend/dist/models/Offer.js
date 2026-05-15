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
exports.Offer = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const offerSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    applicationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Application',
        required: true,
    },
    jobId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    candidateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(types_1.OfferStatus),
        default: types_1.OfferStatus.DRAFT,
    },
    salary: {
        amount: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        frequency: { type: String, enum: ['annual', 'monthly'], default: 'annual' },
    },
    bonus: {
        amount: Number,
        type: { type: String, enum: ['signing', 'performance', 'retention'] },
        details: String,
    },
    equity: {
        type: {
            type: String,
            enum: ['stock_options', 'rsus', 'esops'],
        },
        units: Number,
        vestingPeriod: String,
        details: String,
    },
    designation: { type: String, required: true },
    department: String,
    reportingTo: String,
    joiningDate: { type: Date, required: true },
    location: String,
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'] },
    probationPeriod: Number,
    noticePeriod: Number,
    benefits: [String],
    additionalTerms: String,
    offerLetterUrl: String,
    offerLetterHtml: String,
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    approvalComments: String,
    sentAt: Date,
    expiresAt: Date,
    respondedAt: Date,
    candidateComments: String,
    negotiations: [
        {
            round: Number,
            proposedBy: { type: String, enum: ['company', 'candidate'] },
            changes: mongoose_1.Schema.Types.Mixed,
            comments: String,
            createdAt: { type: Date, default: Date.now },
        },
    ],
    statusHistory: [
        {
            status: { type: String, enum: Object.values(types_1.OfferStatus) },
            changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            changedAt: { type: Date, default: Date.now },
            remarks: String,
        },
    ],
    deletedAt: Date,
}, { timestamps: true });
// Indexes — tenant isolation
offerSchema.index({ companyId: 1, status: 1 });
offerSchema.index({ applicationId: 1 }, { unique: true });
offerSchema.index({ candidateId: 1, companyId: 1 });
offerSchema.index({ companyId: 1, deletedAt: 1 });
exports.Offer = mongoose_1.default.model('Offer', offerSchema);
//# sourceMappingURL=Offer.js.map