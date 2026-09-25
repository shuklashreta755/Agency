const router = require('express').Router();
const ctrl = require('../controllers/paymentPlanController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.put('/:id', authorize('broker'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('broker'), asyncHandler(ctrl.remove));
router.post('/:id/installments/:sequenceNumber/activate', authorize('broker'), asyncHandler(ctrl.activateInstallment));
router.post('/:id/next-cycle', authorize('broker'), asyncHandler(ctrl.startNextCycle));

module.exports = router;
