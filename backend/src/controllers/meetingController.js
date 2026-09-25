const { Op } = require('sequelize');
const { Meeting, Lead, User } = require('../models');
const { logActivity } = require('../utils/activityLogger');

// GET /api/meetings?from=&to=
async function list(req, res) {
  const { from, to, type, status } = req.query;
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;
  if (type) where.type = type;
  if (status) where.status = status;
  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt[Op.gte] = new Date(from);
    if (to) where.scheduledAt[Op.lte] = new Date(to);
  }

  const meetings = await Meeting.findAll({
    where,
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'customerName', 'phone'] },
      { model: User, as: 'agent', attributes: ['id', 'name'] },
    ],
    order: [['scheduledAt', 'ASC']],
  });

  res.json({ data: meetings });
}

// POST /api/meetings
async function create(req, res) {
  const { title, type, scheduledAt, durationMinutes, leadId, agentId, notes } = req.body;
  if (!title || !scheduledAt) return res.status(400).json({ message: 'Title and scheduled time are required.' });

  const meeting = await Meeting.create({
    brokerId: req.brokerId,
    agentId: req.user.role === 'agent' ? req.user.id : agentId,
    leadId, title, type, scheduledAt, durationMinutes, notes,
  });

  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Scheduled "${title}"`, relatedType: 'Meeting', relatedId: meeting.id,
  });

  // Meetings automatically appear on the calendar because Calendar reads from the same table.
  res.status(201).json({ data: meeting });
}

// PUT /api/meetings/:id
async function update(req, res) {
  const where = { id: req.params.id, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const meeting = await Meeting.findOne({ where });
  if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });

  await meeting.update(req.body);
  await logActivity({
    brokerId: req.brokerId, userId: req.user.id,
    action: `Updated meeting "${meeting.title}"`, relatedType: 'Meeting', relatedId: meeting.id,
  });

  res.json({ data: meeting });
}

// DELETE /api/meetings/:id
async function remove(req, res) {
  const where = { id: req.params.id, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const meeting = await Meeting.findOne({ where });
  if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });

  await meeting.destroy();
  res.json({ message: 'Meeting cancelled.' });
}

module.exports = { list, create, update, remove };
