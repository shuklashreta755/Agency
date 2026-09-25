const router = require('express').Router();
const ctrl = require('../controllers/documentsController');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

// Works for a document belonging to ANY entity (project today, more later) —
// each Document row is broker-scoped and self-describing, so one route here
// covers every documentableType.
router.delete('/:id', asyncHandler(ctrl.remove));

module.exports = router;
