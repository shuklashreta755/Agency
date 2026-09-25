const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/leadController');
const followUpCtrl = require('../controllers/followUpController');
const documentCtrl = require('../controllers/documentController');
const siteVisitCtrl = require('../controllers/siteVisitController');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const siteVisitUploadDir = path.join(__dirname, '..', '..', 'uploads', 'site-visits');
fs.mkdirSync(siteVisitUploadDir, { recursive: true });
const siteVisitStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, siteVisitUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const uploadSiteVisitPhoto = multer({ storage: siteVisitStorage, limits: { fileSize: 8 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.post('/import', authorize('broker'), upload.single('file'), asyncHandler(ctrl.importLeads));
// Lead Approval Workflow — registered before the '/:id' catch-all.
router.get('/pending', asyncHandler(ctrl.listPending)); // broker: all pending; agent: only their own ("My Pending Leads")
router.get('/filter-options', asyncHandler(ctrl.filterOptions)); // dynamic Priority/Source values for the sidebar filters (values in use)
router.get('/enums', asyncHandler(ctrl.enums)); // full valid Priority/Source values for the Add Lead form, read from the model
router.post('/:id/approve', authorize('broker'), asyncHandler(ctrl.approve));
router.post('/:id/reject', authorize('broker'), asyncHandler(ctrl.reject));
router.get('/:id', asyncHandler(ctrl.getOne));
router.post('/', asyncHandler(ctrl.create)); // broker: any project/agent, saved Approved; agent: duplicate-checked, saved Pending Approval
router.put('/:id', asyncHandler(ctrl.update)); // full edit — broker: any lead; agent: self-created only
router.patch('/:id/stage', asyncHandler(ctrl.updateStage)); // stage/priority/notes/nextFollowUp — broker: any; agent: any assigned lead
router.delete('/:id', asyncHandler(ctrl.remove)); // broker: any lead; agent: self-created only
router.post('/:id/assign', authorize('broker'), asyncHandler(ctrl.assign));

// Follow-up timeline (nested under the lead) — all creation/editing/history happens here
router.get('/:id/follow-ups', asyncHandler(followUpCtrl.listForLead));
router.post('/:id/follow-ups', authorize('agent'), asyncHandler(followUpCtrl.create));
// Project-wise response tracking — every project associated with this lead,
// each with just that project's own latest 5 responses (see
// followUpController.projectResponses). Powers the Lead detail popup.
router.get('/:id/project-responses', asyncHandler(followUpCtrl.projectResponses));

// Documents (nested under the lead)
router.get('/:id/documents', asyncHandler(documentCtrl.listForLead));
router.post('/:id/documents', asyncHandler(documentCtrl.create));

// Site Visit Tracker (nested under the lead) — auto-created when a "Site Visit"
// follow-up is logged (see followUpController.create); these endpoints read
// its progress and advance it one GPS-validated step at a time. A Lead can have
// multiple Site Visits over time — each new "Site Visit" follow-up starts a
// fresh tracker, so `site-visit-trackers` (plural) lists all of them.
router.get('/:id/site-visit-tracker', asyncHandler(siteVisitCtrl.getTracker));
router.get('/:id/site-visit-trackers', asyncHandler(siteVisitCtrl.listTrackers));
router.post('/:id/site-visit-tracker/steps', authorize('agent'), uploadSiteVisitPhoto.single('photo'), asyncHandler(siteVisitCtrl.advanceStep));

module.exports = router;
