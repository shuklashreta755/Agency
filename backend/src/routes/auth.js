const router = require('express').Router();
const { firebaseLogin, createAgent, me } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/firebase-login', asyncHandler(firebaseLogin));
router.get('/me', authenticate, asyncHandler(me));
router.post('/agents', authenticate, authorize('broker'), asyncHandler(createAgent));

module.exports = router;
