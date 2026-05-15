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
exports.Job = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const jobPostingSchema = new mongoose_1.Schema({
    portal: {
        type: String,
        required: true,
    },
    postedAt: {
        type: Date,
    },
    externalId: {
        type: String,
    },
    status: {
        type: String,
        enum: ['pending', 'posted', 'failed'],
        default: 'pending',
    },
    error: {
        type: String,
    },
    retryCount: {
        type: Number,
        default: 0,
    },
}, { _id: false });
const jobSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    title: {
        type: String,
        required: [true, 'Job title is required'],
        trim: true,
        maxlength: [200, 'Job title cannot exceed 200 characters'], // BUG-005/VAL-002
    },
    description: {
        type: String,
        required: [true, 'Job description is required'],
        maxlength: [20000, 'Job description cannot exceed 20,000 characters'], // BUG-005/VAL-002
    },
    responsibilities: {
        type: [String],
        validate: {
            // Guard: pass when field is absent; only validate actual array entries
            validator: (arr) => !Array.isArray(arr) ||
                arr.every((s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 500),
            message: 'Each responsibility must be non-empty and ≤ 500 characters',
        },
    },
    requirements: {
        type: [String],
        validate: {
            validator: (arr) => !Array.isArray(arr) ||
                arr.every((s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 500),
            message: 'Each requirement must be non-empty and ≤ 500 characters',
        },
    },
    skills: {
        type: [String],
        required: true,
        validate: [
            // VAL-003: reject empty-string skills; guard against non-array (undefined/null)
            {
                validator: (arr) => !Array.isArray(arr) ||
                    arr.every((s) => typeof s === 'string' && s.trim().length > 0),
                message: 'Skills must not contain empty strings',
            },
            {
                validator: (arr) => !Array.isArray(arr) ||
                    arr.every((s) => typeof s === 'string' && s.length <= 100),
                message: 'Each skill name must be ≤ 100 characters',
            },
        ],
    },
    experienceMin: {
        type: Number,
        required: true,
        min: 0,
    },
    experienceMax: {
        type: Number,
        required: true,
        min: 0,
    },
    salaryMin: {
        type: Number,
        min: 0,
    },
    salaryMax: {
        type: Number,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    location: {
        type: String,
        required: true,
    },
    workMode: {
        type: String,
        enum: Object.values(types_1.WorkMode),
        required: true,
    },
    jobType: {
        type: String,
        enum: Object.values(types_1.JobType),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(types_1.JobStatus),
        default: types_1.JobStatus.DRAFT,
    },
    department: {
        type: String,
    },
    positions: {
        type: Number,
        default: 1,
        min: 1,
    },
    joiningDate: {
        type: Date,
    },
    expiryDate: {
        type: Date,
    },
    tags: [String],
    version: {
        type: Number,
        default: 1,
    },
    previousVersionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
    },
    postings: [jobPostingSchema],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    publishedAt: {
        type: Date,
    },
    closedAt: {
        type: Date,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    applicationCount: {
        type: Number,
        default: 0,
    },
    deletedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indexes
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ expiryDate: 1 });
// Auto-expire jobs
jobSchema.pre('save', function (next) {
    if (this.expiryDate && new Date() > this.expiryDate && this.status === types_1.JobStatus.PUBLISHED) {
        this.status = types_1.JobStatus.EXPIRED;
    }
    next();
});
exports.Job = mongoose_1.default.model('Job', jobSchema);
//# sourceMappingURL=Job.js.map