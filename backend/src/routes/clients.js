const router = require('express').Router();
const ctrl = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate, authorize('broker'));

router.get('/', asyncHandler(ctrl.list));

module.exports = router;
