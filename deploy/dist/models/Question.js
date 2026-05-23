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
exports.Question = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const questionSchema = new mongoose_1.Schema({
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
    },
    question: {
        type: String,
        required: [true, 'Question is required'],
    },
    questionType: {
        type: String,
        enum: ['technical', 'behavioral', 'situational', 'coding', 'system_design'],
        required: true,
    },
    difficulty: {
        type: String,
        enum: Object.values(types_1.QuestionDifficulty),
        required: true,
    },
    skills: {
        type: [String],
        required: true,
    },
    expectedAnswer: String,
    hints: [String],
    estimatedDuration: {
        type: Number,
        required: true,
        default: 5,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    usageCount: {
        type: Number,
        default: 0,
    },
    averageRating: {
        type: Number,
        min: 1,
        max: 5,
    },
}, {
    timestamps: true,
});
// Indexes
questionSchema.index({ companyId: 1, difficulty: 1 });
questionSchema.index({ skills: 1 });
questionSchema.index({ isActive: 1 });
exports.Question = mongoose_1.default.model('Question', questionSchema);
//# sourceMappingURL=Question.js.map