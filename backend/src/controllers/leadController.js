const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { Lead, LeadStatusHistory, User, Project, AgentProject, FollowUp, Booking } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { notifyBrokerOfAgentAction, notifyAgent } = require('../utils/notify');
const { normalizePhone } = require('../utils/phone');

const include = [
  { model: User, as: 'agent', attributes: ['id', 'name', 'phone'] },
  { model: User, as: 'creator', attributes: ['id', 'name', 'role'] },
  { model: Project, as: 'project', attributes: ['id', 'name', 'city'] },
];

// GET /api/leads
// Broker sees every lead in the tenant; Agent sees only leads assigned to them.
async function list(req, res) {
  const { stage, priority, source, search, projectId, agentId, unassigned, assigned, page = 1, limit = 10 } = req.query;
  // "Active Leads" — Pending Approval and Rejected leads live on the Pending
  // Requests view instead, never here.
  const where = { brokerId: req.brokerId, approvalStatus: 'Approved' };

  if (req.user.role === 'agent') {
    // Agent Panel "Unassigned Leads" tab — every unassigned lead in the tenant,
    // so any agent can see what's currently available. Default ("My Assigned
    // Leads") stays strictly scoped to only that agent's own leads.
    where.agentId = unassigned === 'true' ? null : req.user.id;
  } else if (agentId) {
    where.agentId = agentId; // "Assign Agent" sidebar filter — broker only
  } else if (unassigned === 'true') {
    where.agentId = null;
  } else if (assigned === 'true') {
    // Broker Leads page "Assigned Leads" tab — every lead currently assigned
    // to ANY agent, tenant-wide.
    where.agentId = { [Op.ne]: null };
  }
  if (stage) where.stage = stage;
  if (priority) where.priority = priority;
  if (source) where.source = source;
  if (projectId) where.projectId = projectId;
  if (search) {
    where[Op.or] = [
      { customerName: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (Number(page) - 1) * Number(limit);
  const { rows, count } = await Lead.findAndCountAll({
    where, include, order: [['createdAt', 'DESC']], limit: Number(limit), offset,
  });

  // Attach each lead's latest 5 follow-ups (newest first) for the "Last 5 Responses"
  // column — one query for the whole page, grouped in JS, rather than N+1 queries.
  const leadIds = rows.map((l) => l.id);
  let recentByLead = new Map();
  if (leadIds.length) {
    const allFollowUps = await FollowUp.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      include: [{ model: User, as: 'agent', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    recentByLead = new Map();
    for (const fu of allFollowUps) {
      const list = recentByLead.get(fu.leadId) || [];
      if (list.length < 5) {
        list.push(fu);
        recentByLead.set(fu.leadId, list);
      }
    }
  }

  // "Booked" / "Not Booked" for the Leads table's Status column — true the
  // moment this lead has any non-cancelled booking against it (a booking that
  // was later cancelled doesn't count; the lead goes back to "Not Booked").
  // One query for the whole page, grouped in JS, same pattern as the recent
  // follow-ups above — never N+1.
  let bookedLeadIds = new Set();
  if (leadIds.length) {
    const bookingRows = await Booking.findAll({
      where: { leadId: { [Op.in]: leadIds }, status: { [Op.ne]: 'Cancelled' } },
      attributes: ['leadId'],
    });
    bookedLeadIds = new Set(bookingRows.map((b) => b.leadId));
  }

  const data = rows.map((lead) => ({
    ...lead.toJSON(),
    recentFollowUps: recentByLead.get(lead.id) || [],
    isBooked: bookedLeadIds.has(lead.id),
  }));

  res.json({ data, total: count, page: Number(page), limit: Number(limit) });
}

// GET /api/leads/:id
async function getOne(req, res) {
  const where = { id: req.params.id, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const lead = await Lead.findOne({
    where,
    include: [...include, { model: LeadStatusHistory, as: 'statusHistory' }],
  });
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  res.json({ data: lead });
}

// Duplicate check — compares normalized phone & alternatePhone against BOTH
// fields on every existing lead for this broker (any approval status: an
// already-pending or already-active lead both count as a duplicate). Shared
// by both the agent and broker create paths below, so "this lead already
// exists" is caught the same way no matter who is adding it.
// IMPORTANT: existing rows may have been saved with un-normalized phone
// strings (e.g. "9876543210" vs "+919876543210"), so normalize each stored
// value the same way before comparing — a DB-level Op.in against raw columns
// would silently miss real duplicates.
const normPhone = (p) => (p ? normalizePhone(p) || String(p).trim().toLowerCase() : null);
async function findDuplicateLeadId(brokerId, phone, alternatePhone) {
  const candidates = [phone, alternatePhone].filter(Boolean).map(normPhone);
  if (!candidates.length) return null;

  const allLeads = await Lead.findAll({
    where: { brokerId },
    attributes: ['id', 'phone', 'alternatePhone'],
  });
  const match = allLeads.find((l) => {
    const stored = [normPhone(l.phone), normPhone(l.alternatePhone)].filter(Boolean);
    return stored.some((s) => candidates.includes(s));
  });
  return match ? match.id : null;
}

// POST /api/leads
// Broker: can create for any project/agent in the tenant — saved as Approved
// immediately, exactly as before this feature existed.
// Agent: Project is now OPTIONAL (Unassigned allowed). Before saving, the phone
// AND alternatePhone are checked against every existing lead's phone/alternatePhone
// in the tenant; a match blocks the save and returns the existing lead's details
// instead. If unique, the lead is saved as Pending Approval (not yet assigned to
// anyone, not yet visible on My Leads) and the broker is notified in real-time.
async function create(req, res) {
  const { customerName, phone, alternatePhone, email, projectId, source, agentId, priority, interestedIn, preferredLocations } = req.body;
  if (!customerName || !phone) return res.status(400).json({ message: 'Customer name and phone are required.' });

  if (req.user.role === 'agent') {
    if (projectId) {
      const assigned = await AgentProject.findOne({ where: { agentId: req.user.id, projectId } });
      if (!assigned) return res.status(403).json({ message: 'You can only create leads for projects assigned to you.' });
    }

    const duplicateId = await findDuplicateLeadId(req.brokerId, phone, alternatePhone);
    if (duplicateId) {
      const existing = await Lead.findOne({ where: { id: duplicateId }, include });
      return res.status(409).json({
        message: 'A lead with this phone number already exists.',
        existingLead: existing,
      });
    }

    const lead = await Lead.create({
      brokerId: req.brokerId,
      projectId: projectId || null,
      agentId: null, // assigned automatically to the submitting agent only on approval
      createdBy: req.user.id,
      createdByRole: req.user.role,
      customerName, phone, alternatePhone: alternatePhone || null, email, source, priority,
      interestedIn: interestedIn || [],
      preferredLocations: preferredLocations || null,
      approvalStatus: 'Pending',
    });

    await logActivity({
      brokerId: req.brokerId, userId: req.user.id,
      action: `Submitted new lead "${customerName}" for approval`, relatedType: 'Lead', relatedId: lead.id,
    });
    await notifyBrokerOfAgentAction(req, {
      title: 'New Lead Approval Request',
      message: `${req.user.name} submitted a new lead "${customerName}" (${phone}) for your approval.`,
    });

    return res.status(201).json({ data: lead });
  }

  // Broker path — same duplicate check as the agent path above (this is the
  // requested new behavior: a broker adding a lead whose phone/alternatePhone
  // already belongs to an existing lead gets blocked with the same message,
  // instead of silently creating a second record for the same person).
  const duplicateId = await findDuplicateLeadId(req.brokerId, phone, alternatePhone);
  if (duplicateId) {
    const existing = await Lead.findOne({ where: { id: duplicateId }, include });
    return res.status(409).json({
      message: 'A lead with this phone number already exists.',
      existingLead: existing,
    });
  }

  const lead = await Lead.create({
    brokerId: req.brokerId,
    projectId: projectId || null,
    agentId: agentId || null,
    createdBy: req.user.id,
    createdByRole: req.user.role,
    customerName, phone, alternatePhone: alternatePhone || null, email, source, priority,
    interestedIn: interestedIn || [],
    preferredLocations: preferredLocations || null,
  });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Added new lead "${customerName}"`, relatedType: 'Lead', relatedId: lead.id,
  });

  res.status(201).json({ data: lead });
}

// PUT /api/leads/:id — full edit of the lead record.
// Broker: any lead. Agent: only leads THEY created (createdBy === self && createdByRole === 'agent').
// Broker-created leads assigned to an agent are NOT editable by that agent here —
// use PATCH /leads/:id/stage instead for stage/priority/follow-up updates.
async function update(req, res) {
  const lead = await Lead.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });

  if (req.user.role === 'agent' && !(lead.createdBy === req.user.id && lead.createdByRole === 'agent')) {
    return res.status(403).json({ message: 'You can only edit leads you created yourself.' });
  }

  const prevStage = lead.stage;
  await lead.update(req.body);

  if (req.body.stage && req.body.stage !== prevStage) {
    await LeadStatusHistory.create({ leadId: lead.id, changedBy: req.user.id, fromStage: prevStage, toStage: req.body.stage });
  }
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated lead "${lead.customerName}"`, relatedType: 'Lead', relatedId: lead.id,
  });

  res.json({ data: lead });
}

// PATCH /api/leads/:id/stage — lightweight update available to ANY agent the lead
// is assigned to (not just self-created leads), plus the broker.
async function updateStage(req, res) {
  const where = { id: req.params.id, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const lead = await Lead.findOne({ where });
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const { stage, priority, nextFollowUp, notes, lastContactedAt } = req.body;
  const prevStage = lead.stage;
  const prevNotes = lead.notes;
  await lead.update({
    ...(stage !== undefined && { stage }),
    ...(priority !== undefined && { priority }),
    ...(nextFollowUp !== undefined && { nextFollowUp }),
    ...(notes !== undefined && { notes }),
    ...(lastContactedAt !== undefined && { lastContactedAt }),
  });

  if (stage && stage !== prevStage) {
    await LeadStatusHistory.create({ leadId: lead.id, changedBy: req.user.id, fromStage: prevStage, toStage: stage });
    await logActivity({
      brokerId: req.brokerId, userId: req.user.id,
      action: `Updated lead "${lead.customerName}" stage from ${prevStage} to ${stage}`,
      relatedType: 'Lead', relatedId: lead.id,
    });
    await notifyBrokerOfAgentAction(req, {
      title: 'Status Change',
      message: `${req.user.name} changed ${lead.customerName}'s status from ${prevStage} to ${stage}.`,
    });
  }

  if (notes !== undefined && notes !== prevNotes) {
    await notifyBrokerOfAgentAction(req, {
      title: 'Note Added',
      message: `${req.user.name} added a note on ${lead.customerName}.`,
    });
  }

  res.json({ data: lead });
}

// DELETE /api/leads/:id — Broker: any lead. Agent: only self-created leads.
async function remove(req, res) {
  const lead = await Lead.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });

  if (req.user.role === 'agent' && !(lead.createdBy === req.user.id && lead.createdByRole === 'agent')) {
    return res.status(403).json({ message: 'You can only delete leads you created yourself.' });
  }

  await lead.destroy();
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Deleted lead "${lead.customerName}"`, relatedType: 'Lead', relatedId: lead.id,
  });

  res.json({ message: 'Lead deleted.' });
}

// POST /api/leads/:id/assign  (Broker only — assign/reassign a lead to an agent)
async function assign(req, res) {
  const { agentId } = req.body;
  const lead = await Lead.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });

  const agent = await User.findOne({ where: { id: agentId, brokerId: req.brokerId, role: 'agent' } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  await lead.update({ agentId });
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Assigned lead "${lead.customerName}" to ${agent.name}`, relatedType: 'Lead', relatedId: lead.id,
  });
  await notifyAgent(req, agent.id, {
    title: 'New lead assigned',
    message: `${lead.customerName} (${lead.phone}) has been assigned to you.`,
    link: `/agent/leads/${lead.id}`,
  });

  res.json({ data: lead });
}

// GET /api/leads/enums
// Powers the Add Lead form's Priority & Source autocomplete fields with the full,
// valid set of values — read live from the Lead model's ENUM definition (the
// backend's single source of truth), never duplicated as a hardcoded frontend
// array. Unlike /filter-options (which only returns values already in use, for
// filtering existing leads), this always returns every value a NEW lead could
// take — otherwise a brand-new tenant with zero leads would see an empty picklist.
async function enums(req, res) {
  const priorities = Lead.rawAttributes.priority.values;
  // 'Import' is stamped automatically by the bulk CSV/Excel import flow — a human
  // creating a lead by hand should never pick it, so it's excluded here (mirrors
  // the option list the form has always shown).
  const sources = Lead.rawAttributes.source.values.filter((v) => v !== 'Import');
  res.json({ priorities, sources });
}

// GET /api/leads/filter-options
// Powers the Leads sidebar filters' Priority & Source dropdowns with values that
// actually occur in this tenant's (or, for an agent, their own) leads — never a
// hardcoded list, so it always reflects real data.
async function filterOptions(req, res) {
  const where = { brokerId: req.brokerId, approvalStatus: 'Approved' };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const rows = await Lead.findAll({ where, attributes: ['priority', 'source'], raw: true });
  const priorities = [...new Set(rows.map((r) => r.priority).filter(Boolean))];
  const sources = [...new Set(rows.map((r) => r.source).filter(Boolean))];

  res.json({ priorities, sources });
}

// GET /api/leads/pending
// Broker: every Pending lead submitted by any agent in the tenant.
// Agent: only their own submissions ("My Pending Leads").
async function listPending(req, res) {
  const where = { brokerId: req.brokerId, approvalStatus: 'Pending' };
  if (req.user.role === 'agent') where.createdBy = req.user.id;

  const leads = await Lead.findAll({ where, include, order: [['createdAt', 'DESC']] });
  res.json({ data: leads, total: leads.length });
}

// POST /api/leads/:id/approve  (Broker only)
// Moves the lead into Main Leads, auto-assigns it to the submitting agent, and
// lets the broker assign/change the project in the same call if it's Unassigned
// (or simply to override it).
async function approve(req, res) {
  const { projectId } = req.body;
  const lead = await Lead.findOne({ where: { id: req.params.id, brokerId: req.brokerId, approvalStatus: 'Pending' } });
  if (!lead) return res.status(404).json({ message: 'Pending lead not found.' });

  await lead.update({
    approvalStatus: 'Approved',
    agentId: lead.createdBy,
    ...(projectId !== undefined && { projectId: projectId || null }),
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Approved lead "${lead.customerName}"`, relatedType: 'Lead', relatedId: lead.id,
  });
  await notifyAgent(req, lead.createdBy, {
    title: 'Lead Approved',
    message: `Your lead "${lead.customerName}" (${lead.phone}) was approved and assigned to you.`,
    link: `/agent/leads/${lead.id}`,
  });

  res.json({ data: lead });
}

// POST /api/leads/:id/reject  (Broker only) — rejection reason is required.
// The lead is marked Rejected and never appears in Main Leads / My Leads.
async function reject(req, res) {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ message: 'A rejection reason is required.' });

  const lead = await Lead.findOne({ where: { id: req.params.id, brokerId: req.brokerId, approvalStatus: 'Pending' } });
  if (!lead) return res.status(404).json({ message: 'Pending lead not found.' });

  await lead.update({
    approvalStatus: 'Rejected',
    rejectionReason: reason.trim(),
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Rejected lead "${lead.customerName}"`, relatedType: 'Lead', relatedId: lead.id,
  });
  await notifyAgent(req, lead.createdBy, {
    title: 'Lead Rejected',
    message: `Your lead "${lead.customerName}" (${lead.phone}) was rejected. Reason: ${reason.trim()}`,
    link: null,
  });

  res.json({ data: lead });
}

// POST /api/leads/import  (Broker only — bulk import from CSV or Excel)
// Expects a multipart file field named "file". Recognized columns (case-insensitive,
// flexible naming): name/customer name, phone/mobile, email, project/project name,
// source, priority.
async function importLeads(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded. Attach a CSV or Excel file as "file".' });

  let rows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (err) {
    return res.status(400).json({ message: 'Could not parse the uploaded file. Please upload a valid CSV or Excel file.' });
  }

  if (!rows.length) return res.status(400).json({ message: 'The uploaded file has no rows.' });

  const projects = await Project.findAll({ where: { brokerId: req.brokerId } });
  const projectByName = new Map(projects.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const normalizeHeader = (h) => h.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
  const pick = (row, keys) => {
    for (const key of Object.keys(row)) {
      if (keys.includes(normalizeHeader(key))) return String(row[key]).trim();
    }
    return '';
  };

  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const customerName = pick(row, ['name', 'customer name', 'customer', 'full name', 'lead name', 'client name', 'client']);
    const phone = pick(row, ['phone', 'mobile', 'phone number', 'contact', 'mobile number', 'contact number', 'cell', 'cell number', 'whatsapp', 'whatsapp number']);
    const email = pick(row, ['email', 'email address', 'e-mail', 'mail']);
    const projectName = pick(row, ['project', 'project name', 'property', 'property name', 'site']);
    const source = pick(row, ['source', 'lead source']) || 'Import';
    const priority = pick(row, ['priority', 'lead priority']);

    if (!customerName || !phone) {
      results.skipped++;
      results.errors.push(`Row ${i + 2}: missing name or phone — skipped.`);
      continue;
    }

    await Lead.create({
      brokerId: req.brokerId,
      projectId: projectByName.get(projectName.trim().toLowerCase()) || null,
      agentId: null,
      createdBy: req.user.id,
      createdByRole: 'broker',
      customerName, phone, email: email || null,
      source: ['Website', 'Referral', 'Walk-in', 'Social Media', 'Reference', 'Import', 'Other'].includes(source) ? source : 'Import',
      priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium',
    });
    results.created++;
  }

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Imported ${results.created} lead(s) from file "${req.file.originalname}"`, relatedType: 'Lead',
  });

  const detectedColumns = Object.keys(rows[0] || {});
  let message = `Imported ${results.created} lead(s), skipped ${results.skipped}.`;
  if (results.created === 0) {
    message += ` No rows matched — detected columns in your file: [${detectedColumns.join(', ')}]. `
      + `Make sure it has a Name column (e.g. "Name", "Customer Name", "Full Name") and a Phone column `
      + `(e.g. "Phone", "Mobile", "Contact Number").`;
  }

  res.json({ message, detectedColumns, ...results });
}

module.exports = { list, getOne, create, update, updateStage, remove, assign, importLeads, listPending, approve, reject, filterOptions, enums };
