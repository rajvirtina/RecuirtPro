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
exports.Interview = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const panelMemberSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    role: String,
}, { _id: false });
const interviewSchema = new mongoose_1.Schema({
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
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    round: {
        type: String,
        enum: Object.values(types_1.InterviewRound),
        required: true,
    },
    roundNumber: {
        type: Number,
        required: true,
        min: 1,
    },
    scheduledTime: {
        type: Date,
        required: true,
    },
    duration: {
        type: Number,
        required: true,
        default: 60,
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata',
    },
    status: {
        type: String,
        enum: Object.values(types_1.InterviewStatus),
        default: types_1.InterviewStatus.SCHEDULED,
    },
    meetingLink: String,
    meetingId: String,
    meetingPassword: String,
    calendarProvider: {
        type: String,
        enum: Object.values(types_1.CalendarProvider),
    },
    calendarEventId: String,
    panel: [panelMemberSchema],
    questions: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Question',
        },
    ],
    instructions: String,
    location: String,
    isOnline: {
        type: Boolean,
        default: true,
    },
    candidateConfirmed: {
        type: Boolean,
        default: false,
    },
    candidateConfirmedAt: Date,
    rescheduleCount: {
        type: Number,
        default: 0,
    },
    previousScheduledTime: Date,
    feedback: [
        {
            interviewerId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
            },
            rating: {
                type: Number,
                min: 1,
                max: 5,
            },
            comments: String,
            recommendation: {
                type: String,
                enum: ['strong_hire', 'hire', 'neutral', 'no_hire', 'strong_no_hire'],
            },
            submittedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    overallRating: {
        type: Number,
        min: 1,
        max: 5,
    },
    finalDecision: {
        type: String,
        enum: ['selected', 'rejected', 'on_hold'],
    },
    recordingUrl: String,
    proctoringEnabled: {
        type: Boolean,
        default: false,
    },
    proctoringConsent: Boolean,
    proctoringConsentAt: Date,
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    startedAt: Date,
    completedAt: Date,
    noShowReason: String,
    cancellationReason: String,
    cancelledBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    cancelledAt: Date,
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});
// Indexes
interviewSchema.index({ candidateId: 1, scheduledTime: -1 });
interviewSchema.index({ companyId: 1, status: 1 });
interviewSchema.index({ scheduledTime: 1 });
interviewSchema.index({ 'panel.userId': 1 });
// Calculate overall rating when feedback is added
interviewSchema.methods.calculateOverallRating = function () {
    if (this.feedback && this.feedback.length > 0) {
        const totalRating = this.feedback.reduce((sum, fb) => sum + fb.rating, 0);
        this.overallRating = totalRating / this.feedback.length;
    }
};
exports.Interview = mongoose_1.default.model('Interview', interviewSchema);
//# sourceMappingURL=Interview.js.map