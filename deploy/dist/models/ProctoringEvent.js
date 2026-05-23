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
exports.ProctoringEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const proctoringEventSchema = new mongoose_1.Schema({
    interviewId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
    candidateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    eventType: {
        type: String,
        enum: Object.values(types_1.ProctoringEventType),
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    description: String,
    snapshotUrl: String,
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    reviewed: {
        type: Boolean,
        default: false,
    },
    reviewedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewedAt: Date,
    reviewComments: String,
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
proctoringEventSchema.index({ interviewId: 1, timestamp: -1 });
proctoringEventSchema.index({ candidateId: 1 });
proctoringEventSchema.index({ eventType: 1, severity: 1 });
proctoringEventSchema.index({ reviewed: 1 });
// TTL index for automatic deletion after 90 days (data retention policy)
proctoringEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days
exports.ProctoringEvent = mongoose_1.default.model('ProctoringEvent', proctoringEventSchema);
//# sourceMappingURL=ProctoringEvent.js.map