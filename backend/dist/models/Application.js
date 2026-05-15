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
exports.Application = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const statusHistorySchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: Object.values(types_1.ApplicationStatus),
        required: true,
    },
    changedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    changedAt: {
        type: Date,
        default: Date.now,
    },
    remarks: String,
}, { _id: false });
const applicationSchema = new mongoose_1.Schema({
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
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    resumeUrl: String,
    coverLetter: String,
    status: {
        type: String,
        enum: Object.values(types_1.ApplicationStatus),
        default: types_1.ApplicationStatus.APPLIED,
    },
    statusHistory: [statusHistorySchema],
    skillMatchScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    experienceMatchScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    appliedAt: {
        type: Date,
        default: Date.now,
    },
    shortlistedAt: Date,
    rejectedAt: Date,
    hiredAt: Date,
    rejectionReason: String,
    notes: [
        {
            addedBy: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
            },
            note: String,
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    source: {
        type: String,
        enum: ['direct', 'naukri', 'linkedin', 'referral'],
        default: 'direct',
    },
    referralBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    deletedAt: Date,
}, {
    timestamps: true,
});
// Indexes
applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
applicationSchema.index({ candidateId: 1, status: 1 });
applicationSchema.index({ companyId: 1, status: 1 });
applicationSchema.index({ overallScore: -1 });
applicationSchema.index({ appliedAt: -1 });
// Update timestamp fields on status change (B-07/B-08 fix: removed duplicate
// statusHistory push — history is now managed only in the controller, which
// correctly records the actual user who made the change).
applicationSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        // Update timestamp fields
        switch (this.status) {
            case types_1.ApplicationStatus.SHORTLISTED:
                this.shortlistedAt = new Date();
                break;
            case types_1.ApplicationStatus.REJECTED:
                this.rejectedAt = new Date();
                break;
            case types_1.ApplicationStatus.HIRED:
                this.hiredAt = new Date();
                break;
        }
    }
    next();
});
exports.Application = mongoose_1.default.model('Application', applicationSchema);
//# sourceMappingURL=Application.js.map