const { LeadDocument, Lead, User } = require('../models');
const { notifyBrokerOfAgentAction } = require('../utils/notify');

async function getAccessibleLead(req, leadId) {
  const where = { id: leadId, brokerId: req.brokerId };
  if (req.user.role === 'agent') where.agentId = req.user.id;
  return Lead.findOne({ where });
}

// GET /api/leads/:id/documents
async function listForLead(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const documents = await LeadDocument.findAll({
    where: { leadId: lead.id },
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ data: documents });
}

// POST /api/leads/:id/documents  { name, url }
async function create(req, res) {
  const lead = await getAccessibleLead(req, req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found or not assigned to you.' });

  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ message: 'Both a name and a URL are required.' });

  const doc = await LeadDocument.create({ leadId: lead.id, uploadedBy: req.user.id, name, url });
  await notifyBrokerOfAgentAction(req, {
    title: 'Document Uploaded',
    message: `${req.user.name} uploaded "${name}" for ${lead.customerName}.`,
  });
  res.status(201).json({ data: doc });
}

// DELETE /api/documents/:id
async function remove(req, res) {
  const doc = await LeadDocument.findOne({
    include: [{ model: Lead, as: 'lead', where: { brokerId: req.brokerId } }],
    where: { id: req.params.id },
  });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (req.user.role === 'agent' && doc.uploadedBy !== req.user.id) {
    return res.status(403).json({ message: 'You can only remove documents you added yourself.' });
  }
  await doc.destroy();
  res.json({ message: 'Document removed.' });
}

module.exports = { listForLead, create, remove };
