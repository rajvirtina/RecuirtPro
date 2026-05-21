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
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ctrl = __importStar(require("../controllers/companySettingsController"));
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
// Ensure logos upload directory
const logoDir = path_1.default.join(__dirname, '../../uploads/logos');
if (!fs_1.default.existsSync(logoDir)) {
    fs_1.default.mkdirSync(logoDir, { recursive: true });
}
const logoUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, logoDir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname);
            cb(null, `logo-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    },
});
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/settings', ctrl.getCompanySettings);
router.patch('/settings', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), ctrl.updateCompanySettings);
router.patch('/branding', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN), ctrl.updateBranding);
router.post('/branding/logo', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN), logoUpload.single('logo'), ctrl.uploadLogo);
router.get('/pipeline-stages', ctrl.getPipelineStages);
router.put('/pipeline-stages', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), ctrl.updatePipelineStages);
exports.default = router;
//# sourceMappingURL=companySettings.js.map