const { Op } = require('sequelize');
const { FollowUp, Lead, LeadStatusHistory, User, Project, AgentProject, Booking } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { LEAD_STAGES, ACTIVITY_TYPES } = require('../constants/leadEnums');
const { notifyBrokerOfAgentAction } = require('../utils/notify');
const { createTrackerForFollowUp } = require('./siteVisitController');

// Shared guard: the requesting user must be allowed to see/act on this lead
// (broker: any lead in tenant; agent: only leads assigned to them).
async function getAccessibleLead(req, leadId) {
  const where = { id: leadId, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;
  return Lead.findOne({ where });
}

// GET /api/leads/:id/follow-ups — the full timeline for one lead, newest first.
async function listForLead(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const followUps = await FollowUp.findAll({
    where: { leadId: lead.id },
    include: [
      { model: User, as: 'agent', attributes: ['id', 'name'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json({ data: followUps });
}

// GET /api/leads/:id/project-responses
// Project-wise response tracking for one lead — powers the "Projects &
// Responses" section of the Lead detail popup. Groups this lead's follow-ups
// by the project each one was logged against, so every project shows ONLY
// its own latest 5 responses, never another project's activity mixed in.
//
// A follow-up with no project of its own falls back to the lead's currently
// assigned project for grouping (same fallback already documented on
// FollowUp.projectId) — one that has neither is simply not attributable to
// any project and is left out here (it still shows up as before in the
// lead's plain Follow-up History timeline, which this endpoint doesn't touch).
//
// "Projects associated with this lead" = the lead's own assigned project
// (always included, even with zero responses — shown as "No Responses")
// plus any other project a follow-up was explicitly logged against. Returns
// at most the 5 most recently active projects, own project pinned first.
async function projectResponses(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const followUps = await FollowUp.findAll({
    where: { leadId: lead.id },
    include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });

  const byProject = new Map(); // projectId -> follow-ups for THIS lead + THIS project only, newest first
  for (const fu of followUps) {
    const pid = fu.projectId || lead.projectId;
    if (!pid) continue; // no project to attribute this one to — excluded from project-wise tracking
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid).push(fu);
  }

  const projectIds = new Set(byProject.keys());
  if (lead.projectId) projectIds.add(lead.projectId);

  const leadSummary = { id: lead.id, customerName: lead.customerName, phone: lead.phone, stage: lead.stage, priority: lead.priority };
  if (projectIds.size === 0) return res.json({ data: { lead: leadSummary, projects: [] } });

  const [projects, bookings] = await Promise.all([
    Project.findAll({ where: { id: { [Op.in]: [...projectIds] } }, attributes: ['id', 'name', 'city'] }),
    // "Booked" for this lead, scoped to each specific project — not the lead's
    // overall booked status, which could be booked against a different project.
    Booking.findAll({
      where: { leadId: lead.id, projectId: { [Op.in]: [...projectIds] }, status: { [Op.ne]: 'Cancelled' } },
      attributes: ['projectId'],
    }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const bookedProjectIds = new Set(bookings.map((b) => b.projectId));

  let rows = [...projectIds].map((pid) => {
    const group = byProject.get(pid) || []; // already newest-first
    const latest = group[0];
    const proj = projectById.get(pid);
    return {
      project: proj ? { id: proj.id, name: proj.name, city: proj.city } : { id: pid, name: 'Unknown project', city: null },
      isOwnProject: pid === lead.projectId,
      // The project's latest known stage for this lead — from its most recent
      // follow-up, or the lead's current stage if this is its own assigned
      // project with no follow-ups logged against it yet.
      stage: latest ? latest.stage : (pid === lead.projectId ? lead.stage : null),
      isBooked: bookedProjectIds.has(pid),
      responseCount: group.length,
      responses: group.slice(0, 5).map((fu) => ({
        id: fu.id,
        activityType: fu.activityType,
        response: fu.response,
        description: fu.description,
        createdAt: fu.createdAt,
        agent: fu.agent ? { id: fu.agent.id, name: fu.agent.name } : null,
      })),
      lastActivityAt: latest ? latest.createdAt : null,
    };
  });

  // Lead's own project always leads; the rest ordered by most recently active
  // (projects with zero responses sink to the bottom).
  rows.sort((a, b) => {
    if (a.isOwnProject !== b.isOwnProject) return a.isOwnProject ? -1 : 1;
    if (!a.lastActivityAt && !b.lastActivityAt) return 0;
    if (!a.lastActivityAt) return 1;
    if (!b.lastActivityAt) return -1;
    return new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
  });
  rows = rows.slice(0, 5); // latest 5 projects for this lead

  res.json({ data: { lead: leadSummary, projects: rows } });
}

// POST /api/leads/:id/follow-ups
// Logs an activity and, in the same step, applies its `stage` and `nextFollowUpAt`
// onto the parent Lead so the Lead's current status/reminder always reflects the
// most recent follow-up.
async function create(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const { stage, activityType, description, nextFollowUpAt, reminderEnabled, response, lat, lng, projectId } = req.body;
  if (!activityType || !ACTIVITY_TYPES.includes(activityType)) {
    return res.status(400).json({ message: `activityType must be one of: ${ACTIVITY_TYPES.join(', ')}` });
  }
  const resolvedStage = stage && LEAD_STAGES.includes(stage) ? stage : lead.stage;

  // projectId is optional, but when supplied it must be one of this agent's
  // own assigned projects — the dropdown only ever offers those, so anything
  // else is either a stale selection or a tampered request.
  let resolvedProjectId = null;
  if (projectId) {
    if (req.user.role === 'agent') {
      const link = await AgentProject.findOne({ where: { agentId: req.user.id, projectId } });
      if (!link) return res.status(400).json({ message: 'That project is not assigned to you.' });
    }
    const project = await Project.findOne({ where: { id: projectId, brokerId: req.brokerId } });
    if (!project) return res.status(400).json({ message: 'Project not found.' });
    resolvedProjectId = project.id;
  }

  const followUp = await FollowUp.create({
    leadId: lead.id,
    agentId: req.user.id,
    stage: resolvedStage,
    activityType,
    response: ['positive', 'neutral', 'negative'].includes(response) ? response : null,
    description,
    nextFollowUpAt: nextFollowUpAt || null,
    reminderEnabled: !!reminderEnabled,
    projectId: resolvedProjectId,
  });

  const prevStage = lead.stage;
  await lead.update({
    stage: resolvedStage,
    lastContactedAt: new Date(),
    ...(nextFollowUpAt !== undefined && { nextFollowUp: nextFollowUpAt || null }),
  });

  if (resolvedStage !== prevStage) {
    await LeadStatusHistory.create({ leadId: lead.id, changedBy: req.user.id, fromStage: prevStage, toStage: resolvedStage });
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Logged a ${activityType} follow-up for ${lead.customerName}`, relatedType: 'Lead', relatedId: lead.id,
  });
  await notifyBrokerOfAgentAction(req, {
    title: `${activityType} Logged`,
    message: `${req.user.name} logged a ${activityType} for ${lead.customerName}${description ? `: ${description}` : '.'}`,
  });
  if (resolvedStage !== prevStage) {
    await notifyBrokerOfAgentAction(req, {
      title: 'Status Change',
      message: `${req.user.name} changed ${lead.customerName}'s status from ${prevStage} to ${resolvedStage}.`,
    });
  }

  let siteVisitTracker = null;
  if (activityType === 'Site Visit') {
    siteVisitTracker = await createTrackerForFollowUp({
      lead, agent: req.user, followUp,
      lat: lat !== undefined ? Number(lat) : null,
      lng: lng !== undefined ? Number(lng) : null,
      projectId: resolvedProjectId,
    });
  }

  const withAgent = await FollowUp.findByPk(followUp.id, {
    include: [
      { model: User, as: 'agent', attributes: ['id', 'name'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
  });
  res.status(201).json({ data: withAgent, lead, siteVisitTracker });
}

// PATCH /api/follow-ups/:id — only the logging agent, or the broker, can edit it.
async function update(req, res) {
  const followUp = await FollowUp.findOne({
    include: [{ model: Lead, as: 'lead', where: { brokerId: req.brokerId } }],
    where: { id: req.params.id },
  });
  if (!followUp) return res.status(404).json({ message: 'Follow-up not found.' });
  if (req.user.role === 'agent' && followUp.agentId !== req.user.id) {
    return res.status(403).json({ message: 'You can only edit follow-ups you logged yourself.' });
  }

  const { stage, activityType, description, nextFollowUpAt, reminderEnabled, response } = req.body;
  await followUp.update({
    ...(stage !== undefined && { stage }),
    ...(activityType !== undefined && { activityType }),
    ...(description !== undefined && { description }),
    ...(nextFollowUpAt !== undefined && { nextFollowUpAt }),
    ...(reminderEnabled !== undefined && { reminderEnabled }),
    ...(response !== undefined && { response }),
  });

  res.json({ data: followUp });
}

// DELETE /api/follow-ups/:id — same ownership rule as update.
async function remove(req, res) {
  const followUp = await FollowUp.findOne({
    include: [{ model: Lead, as: 'lead', where: { brokerId: req.brokerId } }],
    where: { id: req.params.id },
  });
  if (!followUp) return res.status(404).json({ message: 'Follow-up not found.' });
  if (req.user.role === 'agent' && followUp.agentId !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete follow-ups you logged yourself.' });
  }

  await followUp.destroy();
  res.json({ message: 'Follow-up deleted.' });
}

// GET /api/follow-ups/leads — the Follow-ups sidebar.
// Shows only leads that have AT LEAST ONE follow-up logged, each annotated with its
// most recent activity, sorted by that activity's date (newest first).
// Filters: activityType, search (name/phone), and a `bucket` of today/upcoming/overdue/completed
// (computed off the lead's next_follow_up).
async function listLeadsWithFollowUps(req, res) {
  const { activityType, search, bucket, page = 1, limit = 50 } = req.query;

  const leadWhere = { brokerId: req.brokerId };
  if (req.user.role === 'agent') leadWhere.agentId = req.user.id;

  // 1. Pull every follow-up for leads in scope, newest first, and reduce to "latest per lead" in JS —
  //    simplest reliable way to get a "most recent row per group" without raw SQL window functions.
  const allFollowUps = await FollowUp.findAll({
    include: [{ model: Lead, as: 'lead', where: leadWhere, attributes: ['id'] }],
    order: [['createdAt', 'DESC']],
  });

  const latestByLead = new Map();
  for (const fu of allFollowUps) {
    if (!latestByLead.has(fu.leadId)) latestByLead.set(fu.leadId, fu);
  }
  if (activityType) {
    for (const [leadId, fu] of [...latestByLead.entries()]) {
      if (fu.activityType !== activityType) latestByLead.delete(leadId);
    }
  }

  const leadIds = [...latestByLead.keys()];
  if (leadIds.length === 0) return res.json({ data: [], total: 0 });

  const where = { id: { [Op.in]: leadIds } };
  if (search) {
    where[Op.or] = [
      { customerName: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  let leads = await Lead.findAll({
    where,
    include: [
      { model: User, as: 'agent', attributes: ['id', 'name'] },
      { model: Project, as: 'project', attributes: ['id', 'name'] },
    ],
  });

  // 2. Apply the today/upcoming/overdue/completed bucket against next_follow_up.
  if (bucket) {
    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    leads = leads.filter((l) => {
      if (!l.nextFollowUp) return bucket === 'completed';
      const d = new Date(l.nextFollowUp);
      if (bucket === 'today') return d >= startOfDay && d <= endOfDay;
      if (bucket === 'upcoming') return d > endOfDay;
      if (bucket === 'overdue') return d < startOfDay;
      if (bucket === 'completed') return false;
      return true;
    });
  }

  // 3. Attach latest-activity info and sort by it, newest first.
  const enriched = leads
    .map((l) => {
      const fu = latestByLead.get(l.id);
      return {
        ...l.toJSON(),
        lastActivityType: fu?.activityType || null,
        lastActivityAt: fu?.createdAt || null,
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));

  const offset = (Number(page) - 1) * Number(limit);
  const paged = enriched.slice(offset, offset + Number(limit));

  res.json({ data: paged, total: enriched.length, page: Number(page), limit: Number(limit) });
}

module.exports = { listForLead, create, update, remove, listLeadsWithFollowUps, projectResponses };
