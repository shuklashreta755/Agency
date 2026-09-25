const router = require('express').Router();
const ctrl = require('../controllers/unitController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.patch('/:id', authorize('broker'), asyncHandler(ctrl.updateInstallmentStatus));

module.exports = router;
