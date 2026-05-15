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
exports.SourcingSearch = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const sourcingSearchSchema = new mongoose_1.Schema({
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
    jobId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
    },
    platforms: [{
            type: String,
            enum: Object.values(types_1.SourcingPlatform),
        }],
    criteria: {
        keywords: [String],
        skills: [String],
        location: String,
        experienceMin: Number,
        experienceMax: Number,
        noticePeriod: String,
        employmentType: String,
        education: [String],
        techStack: [String],
        minMatchScore: { type: Number, default: 85 },
    },
    resultsCount: { type: Number, default: 0 },
    shortlistedCount: { type: Number, default: 0 },
    avgMatchScore: Number,
    executionTimeMs: Number,
    deletedAt: Date,
}, { timestamps: true });
sourcingSearchSchema.index({ companyId: 1, createdAt: -1 });
sourcingSearchSchema.index({ userId: 1, createdAt: -1 });
exports.SourcingSearch = mongoose_1.default.model('SourcingSearch', sourcingSearchSchema);
//# sourceMappingURL=SourcingSearch.js.map