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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const types_1 = require("../types");
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false,
    },
    role: {
        type: String,
        enum: Object.values(types_1.UserRole),
        default: types_1.UserRole.CANDIDATE,
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(types_1.UserStatus),
        default: types_1.UserStatus.PENDING_VERIFICATION,
        required: true,
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata',
        required: true,
    },
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
    },
    isSuperAdminUser: {
        type: Boolean,
        default: false,
    },
    profileImage: {
        type: String,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    phoneVerified: {
        type: Boolean,
        default: false,
    },
    mfaEnabled: {
        type: Boolean,
        default: false,
    },
    mfaSecret: {
        type: String,
        select: false,
    },
    lastLogin: {
        type: Date,
    },
    passwordResetToken: {
        type: String,
        select: false,
    },
    passwordResetExpires: {
        type: Date,
        select: false,
    },
    emailVerificationToken: {
        type: String,
        select: false,
    },
    emailVerificationExpires: {
        type: Date,
        select: false,
    },
    deletedAt: {
        type: Date,
    },
    refreshTokenVersion: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});
// Index for better query performance
userSchema.index({ email: 1, deletedAt: 1 });
userSchema.index({ companyId: 1, role: 1 });
// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcryptjs_1.default.genSalt(10);
    this.password = await bcryptjs_1.default.hash(this.password, salt);
    next();
});
// Instance method: Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcryptjs_1.default.compare(candidatePassword, this.password);
};
// Instance method: Generate auth token
userSchema.methods.generateAuthToken = function () {
    return jsonwebtoken_1.default.sign({
        id: this._id,
        email: this.email,
        role: this.role,
        companyId: this.companyId,
    }, config_1.default.jwt.secret, { expiresIn: config_1.default.jwt.expire });
};
// Instance method: Generate refresh token
userSchema.methods.generateRefreshToken = function () {
    return jsonwebtoken_1.default.sign({
        id: this._id,
        companyId: this.companyId,
        type: 'refresh',
        tokenVersion: this.refreshTokenVersion || 0,
    }, config_1.default.jwt.refreshSecret, { expiresIn: config_1.default.jwt.refreshExpire });
};
// Instance method: Invalidate all refresh tokens (B-06/SEC-07)
userSchema.methods.invalidateRefreshTokens = async function () {
    this.refreshTokenVersion = (this.refreshTokenVersion || 0) + 1;
    await this.save();
};
// Instance method: Get full name
userSchema.methods.getFullName = function () {
    return `${this.firstName} ${this.lastName}`;
};
// Static method: Find by credentials
userSchema.statics.findByCredentials = async function (email, password) {
    const user = await this.findOne({
        email,
        deletedAt: null,
    }).select('+password');
    if (!user) {
        throw new Error('Invalid credentials');
    }
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
        throw new Error('Invalid credentials');
    }
    if (user.status !== types_1.UserStatus.ACTIVE) {
        throw new Error('Account is not active');
    }
    return user;
};
// Static method: Verify refresh token (B-06/SEC-07)
userSchema.statics.verifyRefreshToken = async function (token) {
    const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.refreshSecret);
    // Check token version to support revocation
    const user = await this.findById(decoded.id);
    if (!user) {
        throw new Error('User not found');
    }
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.refreshTokenVersion || 0)) {
        throw new Error('Refresh token has been revoked');
    }
    return decoded;
};
// Soft delete - don't actually remove, just mark as deleted
userSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.status = types_1.UserStatus.INACTIVE;
    return this.save();
};
exports.User = mongoose_1.default.model('User', userSchema);
//# sourceMappingURL=User.js.map