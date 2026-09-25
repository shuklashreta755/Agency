const router = require('express').Router();
const ctrl = require('../controllers/followUpController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

// Static route before the /:id param route, or "leads" would be swallowed as an :id value.
router.get('/leads', asyncHandler(ctrl.listLeadsWithFollowUps)); // the Follow-ups sidebar
router.patch('/:id', asyncHandler(ctrl.update));
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
