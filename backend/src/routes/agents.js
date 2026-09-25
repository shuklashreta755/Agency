const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/agentController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Agent profile image — a single image per agent (one agent → one image),
// shown on the agent's card in the broker's Agents panel (see
// models/User.js `avatarUrl`). Same multer setup as the Project cover image
// (routes/projects.js uploadProjectImage) so uploads behave identically.
const agentImageUploadDir = path.join(__dirname, '..', '..', 'uploads', 'agents');
fs.mkdirSync(agentImageUploadDir, { recursive: true });
const agentImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, agentImageUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const uploadAgentImage = multer({
  storage: agentImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    cb(null, true);
  },
});

router.use(authenticate, authorize('broker'));

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));
router.put('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));
router.put('/:id/projects', asyncHandler(ctrl.assignProjects));
router.get('/:id/performance', asyncHandler(ctrl.performance));
router.get('/:id/dashboard', asyncHandler(ctrl.dashboard));

// Profile image (nested under the agent) — see uploadAgentImage above.
router.post('/:id/image', uploadAgentImage.single('image'), asyncHandler(ctrl.uploadImage));

module.exports = router;
