import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ctrl from '../controllers/companySettingsController';

import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

// Ensure logos upload directory
const logoDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logoDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `logo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// Public endpoint — no auth required
router.get('/public/:slug/branding', ctrl.getPublicBranding);

router.use(protect);

router.get('/settings', ctrl.getCompanySettings);
router.patch('/settings', authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN), ctrl.updateCompanySettings);
router.patch('/branding', authorize(UserRole.EMPLOYER, UserRole.ADMIN), ctrl.updateBranding);
router.post('/branding/logo', authorize(UserRole.EMPLOYER, UserRole.ADMIN), logoUpload.single('logo'), ctrl.uploadLogo);
router.get('/pipeline-stages', ctrl.getPipelineStages);
router.put('/pipeline-stages', authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN), ctrl.updatePipelineStages);
router.get('/permissions', ctrl.getPermissions);
router.patch('/permissions', authorize(UserRole.EMPLOYER, UserRole.ADMIN), ctrl.updatePermissions);
router.get('/settings/retention', ctrl.getRetentionSettings);
router.patch('/settings/retention', authorize(UserRole.ADMIN), ctrl.updateRetentionSettings);

export default router;
