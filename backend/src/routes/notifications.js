const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.get('/', asyncHandler(ctrl.list));
router.patch('/read-all', asyncHandler(ctrl.markAllRead));
router.patch('/:id/read', asyncHandler(ctrl.markRead));

module.exports = router;
