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
exports.SourcingIntegration = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const encryption_1 = require("../utils/encryption");
const sourcingIntegrationSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    platform: {
        type: String,
        enum: Object.values(types_1.SourcingPlatform),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(types_1.IntegrationStatus),
        default: types_1.IntegrationStatus.DISCONNECTED,
    },
    accessToken: {
        type: String,
        required: true,
        select: false,
    },
    refreshToken: {
        type: String,
        select: false,
    },
    tokenExpiresAt: Date,
    scopes: [String],
    externalUserId: String,
    externalUsername: String,
    metadata: mongoose_1.Schema.Types.Mixed,
    lastSyncAt: Date,
    errorMessage: String,
    deletedAt: Date,
}, { timestamps: true });
// Encrypt tokens before save
sourcingIntegrationSchema.pre('save', function (next) {
    if (this.isModified('accessToken') && this.accessToken && !this.accessToken.includes(':')) {
        this.accessToken = (0, encryption_1.encrypt)(this.accessToken);
    }
    if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.includes(':')) {
        this.refreshToken = (0, encryption_1.encrypt)(this.refreshToken);
    }
    next();
});
sourcingIntegrationSchema.methods.getDecryptedAccessToken = function () {
    try {
        return (0, encryption_1.decrypt)(this.accessToken);
    }
    catch {
        return this.accessToken;
    }
};
sourcingIntegrationSchema.methods.getDecryptedRefreshToken = function () {
    if (!this.refreshToken)
        return null;
    try {
        return (0, encryption_1.decrypt)(this.refreshToken);
    }
    catch {
        return this.refreshToken;
    }
};
// Indexes — tenant isolation
sourcingIntegrationSchema.index({ companyId: 1, platform: 1 });
sourcingIntegrationSchema.index({ userId: 1, platform: 1 }, { unique: true });
sourcingIntegrationSchema.index({ companyId: 1, deletedAt: 1 });
exports.SourcingIntegration = mongoose_1.default.model('SourcingIntegration', sourcingIntegrationSchema);
//# sourceMappingURL=SourcingIntegration.js.map