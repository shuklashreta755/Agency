const router = require('express').Router();
const ctrl = require('../controllers/builderController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

// Autocomplete for the Project form's Builder Name field — unchanged.
router.get('/', asyncHandler(ctrl.list));
router.post('/', asyncHandler(ctrl.create));

// Full Builders page (sidebar, between Leads and Clients) — Broker only.
// Registered before '/:id' so 'full' is never mistaken for an id.
router.get('/full', authorize('broker'), asyncHandler(ctrl.listFull));
router.post('/full', authorize('broker'), asyncHandler(ctrl.createFull));
router.get('/:id', authorize('broker'), asyncHandler(ctrl.getOne));
router.put('/:id', authorize('broker'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('broker'), asyncHandler(ctrl.remove));

module.exports = router;
