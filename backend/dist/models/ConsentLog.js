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
const mongoose_1 = __importStar(require("mongoose"));
const ConsentLogSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    userEmail: {
        type: String,
        required: true,
        index: true,
    },
    userName: {
        type: String,
        required: true,
    },
    consentType: {
        type: String,
        enum: ['monitoring', 'recording', 'data_processing', 'marketing', 'terms_of_service'],
        required: true,
        index: true,
    },
    consentVersion: {
        type: String,
        required: true,
        default: '1.0',
    },
    granted: {
        type: Boolean,
        required: true,
        index: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    deviceInfo: {
        platform: String,
        browser: String,
        os: String,
    },
    interviewId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Interview',
        index: true,
    },
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    collection: 'consentlogs',
});
// Indexes for efficient querying
ConsentLogSchema.index({ userId: 1, consentType: 1, timestamp: -1 });
ConsentLogSchema.index({ interviewId: 1, userId: 1 });
ConsentLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 }); // 7 years retention (GDPR requirement)
// Helper method to get latest consent for user + type
ConsentLogSchema.statics.getLatestConsent = async function (userId, consentType) {
    return this.findOne({ userId, consentType })
        .sort({ timestamp: -1 })
        .exec();
};
// Helper method to check if user has valid consent
ConsentLogSchema.statics.hasValidConsent = async function (userId, consentType, minVersion) {
    const consent = await this.getLatestConsent(userId, consentType);
    if (!consent || !consent.granted) {
        return false;
    }
    // Check if consent was withdrawn
    if (consent.metadata?.withdrawnAt) {
        return false;
    }
    // Check version if specified
    if (minVersion && consent.consentVersion < minVersion) {
        return false;
    }
    return true;
};
// Helper method to record consent
ConsentLogSchema.statics.recordConsent = async function (data) {
    const consent = new this(data);
    await consent.save();
    return consent;
};
// Helper method to withdraw consent
ConsentLogSchema.statics.withdrawConsent = async function (userId, consentType, reason) {
    const withdrawalData = {
        userId,
        consentType: consentType,
        granted: false,
        timestamp: new Date(),
        metadata: {
            withdrawnAt: new Date(),
            withdrawnReason: reason,
        },
    };
    const consent = await this.recordConsent(withdrawalData);
    return consent;
};
const ConsentLog = mongoose_1.default.model('ConsentLog', ConsentLogSchema);
exports.default = ConsentLog;
//# sourceMappingURL=ConsentLog.js.map