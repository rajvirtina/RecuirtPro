import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as ctrl from '../controllers/companySettingsController';
import { authenticate, authorize } from '../middleware/auth';

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
router.use(authenticate);

router.get('/settings', ctrl.getCompanySettings);
router.patch('/settings', authorize('employer', 'hr', 'admin'), ctrl.updateCompanySettings);
router.patch('/branding', authorize('employer', 'admin'), ctrl.updateBranding);
router.post('/branding/logo', authorize('employer', 'admin'), logoUpload.single('logo'), ctrl.uploadLogo);
router.get('/pipeline-stages', ctrl.getPipelineStages);
router.put('/pipeline-stages', authorize('employer', 'hr', 'admin'), ctrl.updatePipelineStages);

export default router;
