const router = require('express').Router();
const ctrl = require('../controllers/historyController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.get('/', asyncHandler(ctrl.list));

module.exports = router;
