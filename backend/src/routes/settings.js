const router = require('express').Router();
const ctrl = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.put('/profile', asyncHandler(ctrl.updateProfile));

module.exports = router;
