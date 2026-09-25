const { Op } = require('sequelize');

// An agent can work with a project if EITHER it's formally assigned to them
// (AgentProject) OR they already have a lead tied to that project (assigned to
// them, or created by them). This keeps "projects I can work with" consistent
// with what an agent actually sees on their own Leads page — a project a broker
// has clearly put them to work on (by handing them a lead there) is accessible
// even before/without a separate formal AgentProject assignment.
async function agentHasProjectAccess(agentId, projectId) {
  const { AgentProject, Lead } = require('../models');
  const [link, lead] = await Promise.all([
    AgentProject.findOne({ where: { agentId, projectId } }),
    Lead.findOne({ where: { projectId, [Op.or]: [{ agentId }, { createdBy: agentId }] } }),
  ]);
  return !!(link || lead);
}

module.exports = { agentHasProjectAccess };
