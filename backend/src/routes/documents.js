const router = require('express').Router();
const ctrl = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
