const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.get('/', asyncHandler(ctrl.list));
router.get('/leads', asyncHandler(ctrl.leadOptions)); // ?leadType=Client|Lead
router.get('/projects', asyncHandler(ctrl.bookableProjects));
router.get('/enums', asyncHandler(ctrl.enums));
router.get('/payment-actions', asyncHandler(ctrl.paymentActions));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', asyncHandler(ctrl.create));
router.post('/:id/installments/:instId/pay', asyncHandler(ctrl.payInstallment));
router.delete('/:id', authorize('broker'), asyncHandler(ctrl.remove));

module.exports = router;
