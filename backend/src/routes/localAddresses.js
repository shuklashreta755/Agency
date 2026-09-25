const router = require('express').Router();
const ctrl = require('../controllers/localAddressController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));

module.exports = router;
