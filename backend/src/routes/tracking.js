const router = require('express').Router();
const ctrl = require('../controllers/trackingController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

router.get('/', authorize('broker'), asyncHandler(ctrl.list));
router.post('/', authorize('agent'), asyncHandler(ctrl.update));

module.exports = router;
