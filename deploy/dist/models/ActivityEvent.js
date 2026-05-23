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
exports.ActivityEvent = exports.ACTIVITY_EVENT_TYPES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.ACTIVITY_EVENT_TYPES = [
    'application_submitted',
    'stage_changed',
    'note_added',
    'email_sent',
    'interview_scheduled',
    'interview_completed',
    'status_changed',
    'resume_parsed',
    'ai_score_updated',
    'viewed',
];
const ActivityEventSchema = new mongoose_1.Schema({
    applicationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    type: { type: String, enum: exports.ACTIVITY_EVENT_TYPES, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
ActivityEventSchema.index({ applicationId: 1, createdAt: -1 });
exports.ActivityEvent = mongoose_1.default.model('ActivityEvent', ActivityEventSchema);
//# sourceMappingURL=ActivityEvent.js.map