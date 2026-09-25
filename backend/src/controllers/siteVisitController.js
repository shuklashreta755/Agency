const { SiteVisitTracker, SiteVisitStep, Lead, Project, User } = require('../models');
const { SITE_VISIT_STEPS, SITE_VISIT_LOCATION_OPTIONAL_STEPS } = require('../constants/leadEnums');
const { isNearProject, reverseGeocode } = require('../utils/geo');
const { logActivity } = require('../utils/activityLogger');

async function getAccessibleLead(req, leadId) {
  const where = { id: leadId, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;
  return Lead.findOne({ where });
}

/**
 * Called from followUpController.create() whenever an agent logs a follow-up with
 * activityType === 'Site Visit'. Creates the tracker and, if GPS was supplied,
 * immediately completes step 0 ("Site Visit Scheduled") — this is the "capture
 * current GPS automatically, tracker turns green" behavior from the spec.
 * `projectId` (optional) is the project the agent picked for this specific visit —
 * see FollowUp.projectId — and is copied onto the tracker so it can be displayed
 * (and used for the "Site Visit Started" proximity check) without a join.
 */
async function createTrackerForFollowUp({ lead, agent, followUp, lat, lng, projectId }) {
  const tracker = await SiteVisitTracker.create({
    leadId: lead.id, agentId: agent.id, followUpId: followUp.id, currentStepIndex: 0,
    projectId: projectId || null,
  });

  if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
    const address = await reverseGeocode(lat, lng);
    await SiteVisitStep.create({
      trackerId: tracker.id, stepIndex: 0, stepName: SITE_VISIT_STEPS[0],
      latitude: lat, longitude: lng, address,
    });
    await tracker.update({ currentStepIndex: 1 });
  }

  return tracker;
}

// GET /api/leads/:id/site-visit-tracker
// Returns the most recent tracker for this lead (there's normally at most one
// in-progress at a time), including all completed steps, or null if the agent
// hasn't logged a Site Visit follow-up yet.
async function getTracker(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const tracker = await SiteVisitTracker.findOne({
    where: { leadId: lead.id },
    order: [['createdAt', 'DESC']],
    include: [
      { model: SiteVisitStep, as: 'steps', order: [['stepIndex', 'ASC']] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
  });
  if (!tracker) return res.json({ data: null, steps: SITE_VISIT_STEPS });

  const steps = tracker.steps.sort((a, b) => a.stepIndex - b.stepIndex);
  res.json({ data: tracker, completedSteps: steps, steps: SITE_VISIT_STEPS });
}

// GET /api/leads/:id/site-visit-trackers  (plural)
// One Lead can have multiple Site Visits — each time an agent logs a new "Site
// Visit" follow-up, a fresh tracker is created (see createTrackerForFollowUp)
// without touching any earlier ones. This returns ALL of them for the lead,
// oldest first, each with its own completed steps, so the UI can list/switch
// between past visits instead of only ever seeing the latest.
async function listTrackers(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const trackers = await SiteVisitTracker.findAll({
    where: { leadId: lead.id },
    order: [['createdAt', 'ASC']],
    include: [
      { model: SiteVisitStep, as: 'steps' },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
  });

  res.json({
    data: trackers.map((t) => ({ ...t.toJSON(), steps: [...t.steps].sort((a, b) => a.stepIndex - b.stepIndex) })),
    steps: SITE_VISIT_STEPS,
  });
}

// POST /api/leads/:id/site-visit-tracker/steps
// Advances the tracker by ONE step. multipart/form-data with fields:
//   stepName (must match the currently active step), lat, lng (both optional for
//   the last two steps — see SITE_VISIT_LOCATION_OPTIONAL_STEPS), photo (file, only
//   required for the "Photo Uploaded" step), feedback (text, only used for the
//   "Visit Feedback Added" step).
async function advanceStep(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const tracker = await SiteVisitTracker.findOne({
    where: { leadId: lead.id }, order: [['createdAt', 'DESC']],
    include: [{ model: SiteVisitStep, as: 'steps' }],
  });
  if (!tracker) return res.status(404).json({ message: 'No site visit tracker found for this lead yet — log a "Site Visit" follow-up first.' });
  if (tracker.status === 'completed') return res.status(400).json({ message: 'This site visit is already complete.' });

  const stepIndex = tracker.currentStepIndex;
  const expectedName = SITE_VISIT_STEPS[stepIndex];
  const { stepName, lat, lng, feedback } = req.body;

  if (!stepName || stepName.trim().toLowerCase() !== expectedName.toLowerCase()) {
    return res.status(400).json({ message: `Please confirm the current step: "${expectedName}".` });
  }

  // --- Location capture ---
  // Required for every step except the last two (Visit Feedback Added, Next
  // Follow-up), which are optional and may be confirmed without GPS. For all
  // required steps, the location may be the same as or different from any
  // earlier step's location — there's no "must have moved" check.
  const locationOptional = SITE_VISIT_LOCATION_OPTIONAL_STEPS.includes(expectedName);
  let latitude = lat !== undefined && lat !== '' ? Number(lat) : null;
  let longitude = lng !== undefined && lng !== '' ? Number(lng) : null;
  if (Number.isNaN(latitude)) latitude = null;
  if (Number.isNaN(longitude)) longitude = null;

  if (!locationOptional && (latitude === null || longitude === null)) {
    return res.status(400).json({ message: 'Could not read your current location. Please enable location access and try again.' });
  }

  // "Site Visit Started" should happen at the project itself — checked against
  // the project's own coordinates below. Its location relative to any earlier
  // step (e.g. "Customer Picked Up") is NOT constrained: every step's GPS is
  // still captured and stored fresh (see below), but any step's coordinates
  // may be the same as or different from any other step's — there's no
  // "must have moved since the last step" requirement anywhere in this flow.
  if (expectedName === 'Site Visit Started' && latitude !== null && longitude !== null) {
    const project = tracker.projectId
      ? await Project.findByPk(tracker.projectId)
      : (lead.projectId ? await Project.findByPk(lead.projectId) : null);
    if (project?.latitude != null && project?.longitude != null) {
      if (!isNearProject(latitude, longitude, Number(project.latitude), Number(project.longitude))) {
        return res.status(400).json({
          message: `Your current location doesn't match the project's location. Please confirm "${expectedName}" once you're at ${project.name}.`,
        });
      }
    }
    // If the project has no coordinates set, we can't validate proximity — allow it
    // through rather than permanently blocking the agent.
  }
  if (expectedName === 'Photo Uploaded' && !req.file) {
    return res.status(400).json({ message: 'A photo is required before continuing — please attach one.' });
  }

  const address = latitude !== null && longitude !== null ? await reverseGeocode(latitude, longitude) : null;
  const photoUrl = req.file ? `/uploads/site-visits/${req.file.filename}` : null;

  await SiteVisitStep.create({
    trackerId: tracker.id, stepIndex, stepName: expectedName, latitude, longitude, address, photoUrl,
    feedback: expectedName === 'Visit Feedback Added' ? (feedback || null) : null,
  });

  const nextIndex = stepIndex + 1;
  const isDone = nextIndex >= SITE_VISIT_STEPS.length;
  await tracker.update({ currentStepIndex: nextIndex, status: isDone ? 'completed' : 'in_progress' });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Confirmed Site Visit step "${expectedName}" for ${lead.customerName}`, relatedType: 'Lead', relatedId: lead.id,
  });

  const refreshed = await SiteVisitTracker.findByPk(tracker.id, {
    include: [{ model: SiteVisitStep, as: 'steps' }],
  });
  res.json({ data: refreshed, completedSteps: refreshed.steps.sort((a, b) => a.stepIndex - b.stepIndex), steps: SITE_VISIT_STEPS });
}

module.exports = { getTracker, listTrackers, advanceStep, createTrackerForFollowUp };









// const {
//   SiteVisitTracker,
//   SiteVisitStep,
//   Lead,
//   Project,
//   User,
// } = require("../models");
// const {
//   SITE_VISIT_STEPS,
//   SITE_VISIT_LOCATION_OPTIONAL_STEPS,
// } = require("../constants/leadEnums");
// const {
//   isNearProject,
//   isDifferentLocation,
//   reverseGeocode,
//   DIFFERENT_LOCATION_THRESHOLD_M,
// } = require("../utils/geo");
// const { logActivity } = require("../utils/activityLogger");

// async function getAccessibleLead(req, leadId) {
//   const where = { id: leadId, brokerId: req.brokerId };
//   if (req.user.role === "agent") where.agentId = req.user.id;
//   return Lead.findOne({ where });
// }

// /**
//  * Called from followUpController.create() whenever an agent logs a follow-up with
//  * activityType === 'Site Visit'. Creates the tracker and, if GPS was supplied,
//  * immediately completes step 0 ("Site Visit Scheduled") — this is the "capture
//  * current GPS automatically, tracker turns green" behavior from the spec.
//  * `projectId` (optional) is the project the agent picked for this specific visit —
//  * see FollowUp.projectId — and is copied onto the tracker so it can be displayed
//  * (and used for the "Site Visit Started" proximity check) without a join.
//  */
// async function createTrackerForFollowUp({
//   lead,
//   agent,
//   followUp,
//   lat,
//   lng,
//   projectId,
// }) {
//   const tracker = await SiteVisitTracker.create({
//     leadId: lead.id,
//     agentId: agent.id,
//     followUpId: followUp.id,
//     currentStepIndex: 0,
//     projectId: projectId || null,
//   });

//   if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
//     const address = await reverseGeocode(lat, lng);
//     await SiteVisitStep.create({
//       trackerId: tracker.id,
//       stepIndex: 0,
//       stepName: SITE_VISIT_STEPS[0],
//       latitude: lat,
//       longitude: lng,
//       address,
//     });
//     await tracker.update({ currentStepIndex: 1 });
//   }

//   return tracker;
// }

// // GET /api/leads/:id/site-visit-tracker
// // Returns the most recent tracker for this lead (there's normally at most one
// // in-progress at a time), including all completed steps, or null if the agent
// // hasn't logged a Site Visit follow-up yet.
// async function getTracker(req, res) {
//   const lead = await getAccessibleLead(req, req.params.id);
//   if (!lead)
//     return res
//       .status(404)
//       .json({ message: "Lead not found or not assigned to you." });

//   const tracker = await SiteVisitTracker.findOne({
//     where: { leadId: lead.id },
//     order: [["createdAt", "DESC"]],
//     include: [
//       { model: SiteVisitStep, as: "steps", order: [["stepIndex", "ASC"]] },
//       { model: Project, as: "project", attributes: ["id", "name"] },
//     ],
//   });
//   if (!tracker) return res.json({ data: null, steps: SITE_VISIT_STEPS });

//   const steps = tracker.steps.sort((a, b) => a.stepIndex - b.stepIndex);
//   res.json({ data: tracker, completedSteps: steps, steps: SITE_VISIT_STEPS });
// }

// // GET /api/leads/:id/site-visit-trackers  (plural)
// // One Lead can have multiple Site Visits — each time an agent logs a new "Site
// // Visit" follow-up, a fresh tracker is created (see createTrackerForFollowUp)
// // without touching any earlier ones. This returns ALL of them for the lead,
// // oldest first, each with its own completed steps, so the UI can list/switch
// // between past visits instead of only ever seeing the latest.
// async function listTrackers(req, res) {
//   const lead = await getAccessibleLead(req, req.params.id);
//   if (!lead)
//     return res
//       .status(404)
//       .json({ message: "Lead not found or not assigned to you." });

//   const trackers = await SiteVisitTracker.findAll({
//     where: { leadId: lead.id },
//     order: [["createdAt", "ASC"]],
//     include: [
//       { model: SiteVisitStep, as: "steps" },
//       { model: Project, as: "project", attributes: ["id", "name"] },
//     ],
//   });

//   res.json({
//     data: trackers.map((t) => ({
//       ...t.toJSON(),
//       steps: [...t.steps].sort((a, b) => a.stepIndex - b.stepIndex),
//     })),
//     steps: SITE_VISIT_STEPS,
//   });
// }

// // POST /api/leads/:id/site-visit-tracker/steps
// // Advances the tracker by ONE step. multipart/form-data with fields:
// //   stepName (must match the currently active step), lat, lng (both optional for
// //   the last two steps — see SITE_VISIT_LOCATION_OPTIONAL_STEPS), photo (file, only
// //   required for the "Photo Uploaded" step), feedback (text, only used for the
// //   "Visit Feedback Added" step).
// async function advanceStep(req, res) {
//   const lead = await getAccessibleLead(req, req.params.id);
//   if (!lead)
//     return res
//       .status(404)
//       .json({ message: "Lead not found or not assigned to you." });

//   const tracker = await SiteVisitTracker.findOne({
//     where: { leadId: lead.id },
//     order: [["createdAt", "DESC"]],
//     include: [{ model: SiteVisitStep, as: "steps" }],
//   });
//   if (!tracker)
//     return res.status(404).json({
//       message:
//         'No site visit tracker found for this lead yet — log a "Site Visit" follow-up first.',
//     });
//   if (tracker.status === "completed")
//     return res
//       .status(400)
//       .json({ message: "This site visit is already complete." });

//   const stepIndex = tracker.currentStepIndex;
//   const expectedName = SITE_VISIT_STEPS[stepIndex];
//   const { stepName, lat, lng, feedback } = req.body;

//   if (
//     !stepName ||
//     stepName.trim().toLowerCase() !== expectedName.toLowerCase()
//   ) {
//     return res
//       .status(400)
//       .json({ message: `Please confirm the current step: "${expectedName}".` });
//   }

//   // --- Location capture ---
//   // Required for every step except the last two (Visit Feedback Added, Next
//   // Follow-up), which are optional and may be confirmed without GPS. See the
//   // "hasn't moved" guard just below for the one constraint on how a required
//   // step's location may relate to an earlier step's.
//   const locationOptional =
//     SITE_VISIT_LOCATION_OPTIONAL_STEPS.includes(expectedName);
//   let latitude = lat !== undefined && lat !== "" ? Number(lat) : null;
//   let longitude = lng !== undefined && lng !== "" ? Number(lng) : null;
//   if (Number.isNaN(latitude)) latitude = null;
//   if (Number.isNaN(longitude)) longitude = null;

//   if (!locationOptional && (latitude === null || longitude === null)) {
//     return res.status(400).json({
//       message:
//         "Could not read your current location. Please enable location access and try again.",
//     });
//   }

//   // Guard against a stale/duplicate GPS reading being reused for two different
//   // steps (e.g. a device that hands back a cached fix instead of actually
//   // re-acquiring one). Compares the FRESH reading just captured for this step
//   // against the exact lat/lng stored for the most recent earlier step that
//   // also has a location, using real GPS distance (Haversine, in meters) —
//   // never the reverse-geocoded address/city text, since two points a city
//   // apart (or even ~1km apart) can share the same city-level address string.
//   // Only blocks when the two readings are genuinely within the small
//   // "hasn't moved" threshold; any real-world movement (e.g. ~1km between
//   // "Customer Picked Up" and "Site Visit Started") is always recognized and
//   // allowed through.
//   if (!locationOptional && latitude !== null && longitude !== null) {
//     const previousStepWithLocation = [...tracker.steps]
//       .filter(
//         (s) =>
//           s.stepIndex < stepIndex && s.latitude != null && s.longitude != null,
//       )
//       .sort((a, b) => b.stepIndex - a.stepIndex)[0];

//     if (
//       previousStepWithLocation &&
//       !isDifferentLocation(
//         latitude,
//         longitude,
//         Number(previousStepWithLocation.latitude),
//         Number(previousStepWithLocation.longitude),
//       )
//     ) {
//       return res.status(400).json({
//         message: `Your location hasn't changed since "${previousStepWithLocation.stepName}" (within ${DIFFERENT_LOCATION_THRESHOLD_M}m). Please confirm "${expectedName}" once you've actually moved there.`,
//       });
//     }
//   }

//   // "Site Visit Started" should additionally happen at the project itself —
//   // checked against the project's own coordinates below (separate from, and
//   // in addition to, the "hasn't moved since the previous step" guard above).
//   if (
//     expectedName === "Site Visit Started" &&
//     latitude !== null &&
//     longitude !== null
//   ) {
//     const project = tracker.projectId
//       ? await Project.findByPk(tracker.projectId)
//       : lead.projectId
//         ? await Project.findByPk(lead.projectId)
//         : null;
//     if (project?.latitude != null && project?.longitude != null) {
//       if (
//         !isNearProject(
//           latitude,
//           longitude,
//           Number(project.latitude),
//           Number(project.longitude),
//         )
//       ) {
//         return res.status(400).json({
//           message: `Your current location doesn't match the project's location. Please confirm "${expectedName}" once you're at ${project.name}.`,
//         });
//       }
//     }
//     // If the project has no coordinates set, we can't validate proximity — allow it
//     // through rather than permanently blocking the agent.
//   }
//   if (expectedName === "Photo Uploaded" && !req.file) {
//     return res.status(400).json({
//       message: "A photo is required before continuing — please attach one.",
//     });
//   }

//   const address =
//     latitude !== null && longitude !== null
//       ? await reverseGeocode(latitude, longitude)
//       : null;
//   const photoUrl = req.file
//     ? `/uploads/site-visits/${req.file.filename}`
//     : null;

//   await SiteVisitStep.create({
//     trackerId: tracker.id,
//     stepIndex,
//     stepName: expectedName,
//     latitude,
//     longitude,
//     address,
//     photoUrl,
//     feedback: expectedName === "Visit Feedback Added" ? feedback || null : null,
//   });

//   const nextIndex = stepIndex + 1;
//   const isDone = nextIndex >= SITE_VISIT_STEPS.length;
//   await tracker.update({
//     currentStepIndex: nextIndex,
//     status: isDone ? "completed" : "in_progress",
//   });

//   await logActivity({
//     brokerId: req.brokerId,
//     userId: req.user.id,
//     action: `Confirmed Site Visit step "${expectedName}" for ${lead.customerName}`,
//     relatedType: "Lead",
//     relatedId: lead.id,
//   });

//   const refreshed = await SiteVisitTracker.findByPk(tracker.id, {
//     include: [{ model: SiteVisitStep, as: "steps" }],
//   });
//   res.json({
//     data: refreshed,
//     completedSteps: refreshed.steps.sort((a, b) => a.stepIndex - b.stepIndex),
//     steps: SITE_VISIT_STEPS,
//   });
// }

// module.exports = {
//   getTracker,
//   listTrackers,
//   advanceStep,
//   createTrackerForFollowUp,
// };











