const { fn, col, literal } = require('sequelize');
const { Lead, Project, User } = require('../models');

// GET /api/reports/overview
async function overview(req, res) {
  const where = { brokerId: req.brokerId };
  const leadWhere = req.user.role === 'agent' ? { ...where, agentId: req.user.id } : where;

  const totalLeads = await Lead.count({ where: leadWhere });
  const closedLeads = await Lead.count({ where: { ...leadWhere, stage: 'Closed' } });
  const totalProjects = req.user.role === 'broker' ? await Project.count({ where }) : undefined;
  const activeAgents = req.user.role === 'broker'
    ? await User.count({ where: { brokerId: req.brokerId, role: 'agent', status: 'online' } })
    : undefined;

  res.json({
    data: {
      totalLeads,
      closedLeads,
      conversionRate: totalLeads ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0,
      totalProjects,
      activeAgents,
    },
  });
}

// GET /api/reports/leads-by-stage
async function leadsByStage(req, res) {
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const rows = await Lead.findAll({
    where,
    attributes: ['stage', [fn('COUNT', col('id')), 'count']],
    group: ['stage'],
    raw: true,
  });
  res.json({ data: rows });
}

// GET /api/reports/leads-by-priority
async function leadsByPriority(req, res) {
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const rows = await Lead.findAll({
    where,
    attributes: ['priority', [fn('COUNT', col('id')), 'count']],
    group: ['priority'],
    raw: true,
  });
  res.json({ data: rows });
}

// GET /api/reports/leads-by-source
async function leadsBySource(req, res) {
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const rows = await Lead.findAll({
    where,
    attributes: ['source', [fn('COUNT', col('id')), 'count']],
    group: ['source'],
    raw: true,
  });
  res.json({ data: rows });
}

// GET /api/reports/monthly-trend  (leads created vs closed, grouped by month)
async function monthlyTrend(req, res) {
  const where = { brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;

  const rows = await Lead.findAll({
    where,
    attributes: [
      [fn('to_char', col('created_at'), 'Mon YYYY'), 'month'],
      [fn('COUNT', col('id')), 'newLeads'],
      [fn('COUNT', literal(`CASE WHEN stage = 'Closed' THEN 1 END`)), 'closed'],
    ],
    group: [literal('1')],
    order: [literal('MIN(created_at) ASC')],
    raw: true,
  });
  res.json({ data: rows });
}

// GET /api/reports/agent-performance  (Broker only)
async function agentPerformance(req, res) {
  const agents = await User.findAll({ where: { brokerId: req.brokerId, role: 'agent' } });
  const data = await Promise.all(agents.map(async (agent) => {
    const totalLeads = await Lead.count({ where: { agentId: agent.id } });
    const closedLeads = await Lead.count({ where: { agentId: agent.id, stage: 'Closed' } });
    return {
      agentId: agent.id,
      name: agent.name,
      totalLeads,
      closedLeads,
      conversionRate: totalLeads ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0,
    };
  }));
  res.json({ data });
}

module.exports = { overview, leadsByStage, leadsByPriority, leadsBySource, monthlyTrend, agentPerformance };
