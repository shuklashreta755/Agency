const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/projectController');
const unitCtrl = require('../controllers/unitController');
const paymentPlanCtrl = require('../controllers/paymentPlanController');
const documentsCtrl = require('../controllers/documentsController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const unitUploadDir = path.join(__dirname, '..', '..', 'uploads', 'units');
fs.mkdirSync(unitUploadDir, { recursive: true });
const unitStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, unitUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const uploadUnitImages = multer({ storage: unitStorage, limits: { fileSize: 8 * 1024 * 1024 } });

// Project documents (brochures, agreements, RERA copies, etc.) — stored via
// the generic polymorphic Document model (see models/Document.js /
// controllers/documentsController.js), so this exact same upload+list+delete
// setup can be reused for other entities later just by adding their own
// nested routes below.
const documentUploadDir = path.join(__dirname, '..', '..', 'uploads', 'documents');
fs.mkdirSync(documentUploadDir, { recursive: true });
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, documentUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const uploadDocuments = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only PDF, JPG, PNG, DOC, and DOCX files are allowed.'));
    }
    cb(null, true);
  },
});

// Project cover image — a single image shown on the project card and detail
// page (see models/Project.js `imageUrl`).
const projectImageUploadDir = path.join(__dirname, '..', '..', 'uploads', 'projects');
fs.mkdirSync(projectImageUploadDir, { recursive: true });
const projectImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, projectImageUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const uploadProjectImage = multer({
  storage: projectImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    cb(null, true);
  },
});

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', authorize('broker'), asyncHandler(ctrl.create));
router.put('/:id', authorize('broker'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('broker'), asyncHandler(ctrl.remove));

// Units (nested under the project) — Units module is broker-managed; agents get
// read-only access (enforced in the controller: available units only, no installments).
router.get('/:id/units', asyncHandler(unitCtrl.list));
router.post('/:id/units', authorize('broker'), uploadUnitImages.array('images', 10), asyncHandler(unitCtrl.create));
router.post('/:id/units/bulk-price-preview', authorize('broker'), asyncHandler(unitCtrl.bulkPricePreview));
router.post('/:id/units/bulk-price-apply', authorize('broker'), asyncHandler(unitCtrl.bulkPriceApply));

// Payment Plans (nested under the project) — a project can have multiple
// independently-configurable installment plans; PUT/DELETE for an individual
// plan live at /api/payment-plans/:id (see routes/paymentPlans.js).
router.get('/:id/payment-plans', asyncHandler(paymentPlanCtrl.list));
router.post('/:id/payment-plans', authorize('broker'), asyncHandler(paymentPlanCtrl.create));

// Documents (nested under the project) — broker-managed. See the comment
// above documentUploadDir for how this plugs into the shared Document system.
router.get('/:id/documents', asyncHandler(documentsCtrl.listForType('project')));
router.post('/:id/documents', authorize('broker'), uploadDocuments.array('documents', 10), asyncHandler(documentsCtrl.uploadForType('project')));

// Cover image (nested under the project) — see uploadProjectImage above.
router.post('/:id/image', authorize('broker'), uploadProjectImage.single('image'), asyncHandler(ctrl.uploadImage));

module.exports = router;
