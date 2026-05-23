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
exports.CandidateProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const skillSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    yearsOfExperience: Number,
    proficiency: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    },
}, { _id: false });
const educationSchema = new mongoose_1.Schema({
    degree: {
        type: String,
        required: true,
    },
    institution: {
        type: String,
        required: true,
    },
    fieldOfStudy: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
}, { _id: false });
const workExperienceSchema = new mongoose_1.Schema({
    company: {
        type: String,
        required: true,
    },
    position: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: Date,
    current: {
        type: Boolean,
        default: false,
    },
    description: String,
}, { _id: false });
const candidateProfileSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    resumeUrl: String,
    resumeFileName: String,
    skills: [skillSchema],
    totalExperience: {
        type: Number,
        default: 0,
        min: 0,
    },
    currentSalary: {
        type: Number,
        min: 0,
    },
    expectedSalary: {
        type: Number,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    noticePeriod: {
        type: Number,
        min: 0,
    },
    availableFrom: Date,
    education: [educationSchema],
    workExperience: [workExperienceSchema],
    certifications: [
        {
            name: String,
            issuingOrganization: String,
            issueDate: Date,
            expiryDate: Date,
            credentialId: String,
        },
    ],
    languages: [
        {
            name: String,
            proficiency: {
                type: String,
                enum: ['basic', 'conversational', 'fluent', 'native'],
            },
        },
    ],
    linkedinUrl: String,
    githubUrl: String,
    portfolioUrl: String,
    source: {
        portal: String,
        externalId: String,
        url: String,
    },
    parsedData: mongoose_1.Schema.Types.Mixed,
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
// Indexes
candidateProfileSchema.index({ 'skills.name': 1 });
candidateProfileSchema.index({ totalExperience: 1 });
exports.CandidateProfile = mongoose_1.default.model('CandidateProfile', candidateProfileSchema);
//# sourceMappingURL=CandidateProfile.js.map