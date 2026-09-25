const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/unitController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const uploadUnitImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads', 'units')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/:id', asyncHandler(ctrl.getOne));
router.put('/:id', authorize('broker'), uploadUnitImages.array('images', 10), asyncHandler(ctrl.update));
router.patch('/:id/pricing', authorize('broker'), asyncHandler(ctrl.updatePricing));
router.delete('/:id', authorize('broker'), asyncHandler(ctrl.remove));

module.exports = router;
