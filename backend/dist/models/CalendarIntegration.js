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
exports.CalendarIntegration = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const encryption_1 = require("../utils/encryption");
const calendarIntegrationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    provider: {
        type: String,
        enum: Object.values(types_1.CalendarProvider),
        required: true,
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
    tokenType: {
        type: String,
        default: 'Bearer',
    },
    expiresAt: Date,
    scope: String,
    calendarId: String,
    email: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastSyncedAt: Date,
    metadata: mongoose_1.Schema.Types.Mixed,
}, {
    timestamps: true,
});
// Indexes
calendarIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
calendarIntegrationSchema.index({ isActive: 1 });
// SEC-11: Encrypt OAuth tokens before saving to DB
calendarIntegrationSchema.pre('save', function (next) {
    if (this.isModified('accessToken') && this.accessToken && !this.accessToken.includes(':')) {
        this.accessToken = (0, encryption_1.encrypt)(this.accessToken);
    }
    if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.includes(':')) {
        this.refreshToken = (0, encryption_1.encrypt)(this.refreshToken);
    }
    next();
});
// SEC-11: Decrypt tokens when reading from DB
calendarIntegrationSchema.methods.getDecryptedAccessToken = function () {
    try {
        return (0, encryption_1.decrypt)(this.accessToken);
    }
    catch {
        return this.accessToken; // Return raw if decryption fails (legacy data)
    }
};
calendarIntegrationSchema.methods.getDecryptedRefreshToken = function () {
    if (!this.refreshToken)
        return undefined;
    try {
        return (0, encryption_1.decrypt)(this.refreshToken);
    }
    catch {
        return this.refreshToken;
    }
};
exports.CalendarIntegration = mongoose_1.default.model('CalendarIntegration', calendarIntegrationSchema);
//# sourceMappingURL=CalendarIntegration.js.map