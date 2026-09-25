const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

router.get('/overview', asyncHandler(ctrl.overview));
router.get('/leads-by-stage', asyncHandler(ctrl.leadsByStage));
router.get('/leads-by-priority', asyncHandler(ctrl.leadsByPriority));
router.get('/leads-by-source', asyncHandler(ctrl.leadsBySource));
router.get('/monthly-trend', asyncHandler(ctrl.monthlyTrend));
router.get('/agent-performance', authorize('broker'), asyncHandler(ctrl.agentPerformance));

module.exports = router;
