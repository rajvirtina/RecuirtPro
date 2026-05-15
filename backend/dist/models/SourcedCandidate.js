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
exports.SourcedCandidate = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const sourcedCandidateSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    sourcedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    jobId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
    },
    platform: {
        type: String,
        enum: Object.values(types_1.SourcingPlatform),
        required: true,
    },
    externalId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: String,
    phone: String,
    location: String,
    currentCompany: String,
    currentPosition: String,
    experience: Number,
    skills: [String],
    education: [String],
    summary: String,
    profileUrl: String,
    resumeUrl: String,
    imageUrl: String,
    lastActive: Date,
    matchScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    matchDetails: {
        skillScore: Number,
        experienceScore: Number,
        locationScore: Number,
        semanticScore: Number,
        recencyScore: Number,
        overallScore: Number,
        strengths: [String],
        missingSkills: [String],
        recommendation: String,
        confidenceScore: Number,
    },
    githubData: {
        username: String,
        publicRepos: Number,
        followers: Number,
        contributions: Number,
        topLanguages: [String],
        topRepos: [
            {
                name: String,
                description: String,
                stars: Number,
                language: String,
                url: String,
            },
        ],
        techStackScore: Number,
    },
    status: {
        type: String,
        enum: ['sourced', 'shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected', 'saved'],
        default: 'sourced',
    },
    contactedAt: Date,
    respondedAt: Date,
    notes: [
        {
            addedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            note: String,
            createdAt: { type: Date, default: Date.now },
        },
    ],
    deletedAt: Date,
}, { timestamps: true });
// Indexes — tenant isolation + dedup
sourcedCandidateSchema.index({ companyId: 1, platform: 1, externalId: 1 }, { unique: true });
sourcedCandidateSchema.index({ companyId: 1, jobId: 1, matchScore: -1 });
sourcedCandidateSchema.index({ companyId: 1, status: 1 });
sourcedCandidateSchema.index({ companyId: 1, deletedAt: 1 });
sourcedCandidateSchema.index({ skills: 1 });
exports.SourcedCandidate = mongoose_1.default.model('SourcedCandidate', sourcedCandidateSchema);
//# sourceMappingURL=SourcedCandidate.js.map