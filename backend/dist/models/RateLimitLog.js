"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
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
exports.RateLimitLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const rateLimitLogSchema = new mongoose_1.Schema({
    identifier: {
        type: String,
        required: true,
        index: true,
    },
    action: {
        type: String,
        required: true,
        enum: ['password_reset', 'login', 'registration', '2fa_verification', 'email_verification'],
    },
    attempts: {
        type: Number,
        default: 1,
    },
    lastAttempt: {
        type: Date,
        default: Date.now,
    },
    blockedUntil: {
        type: Date,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
});
// Compound index for efficient queries
rateLimitLogSchema.index({ identifier: 1, action: 1 });
rateLimitLogSchema.index({ blockedUntil: 1 }, { expireAfterSeconds: 0 });
// TTL index to automatically delete old records after 24 hours
rateLimitLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
exports.RateLimitLog = mongoose_1.default.model('RateLimitLog', rateLimitLogSchema);
//# sourceMappingURL=RateLimitLog.js.map