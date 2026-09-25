const path = require('path');
const fs = require('fs');
const { Document, User, Project, AgentProject } = require('../models');

// Maps a `documentableType` to a function that verifies a given id belongs to
// this broker AND — for an agent — that they're actually assigned to it,
// before any read or write against it is allowed. To attach the document
// system to a new entity, add one line here and two nested routes that reuse
// listForType/uploadForType below — no new controller code needed.
const OWNERSHIP_CHECKS = {
  project: async (req, id) => {
    const project = await Project.findOne({ where: { id, brokerId: req.brokerId } });
    if (!project) return null;
    if (req.user.role === 'agent') {
      const isAssigned = await AgentProject.findOne({ where: { agentId: req.user.id, projectId: id } });
      if (!isAssigned) return null;
    }
    return project;
  },
};

async function assertOwnership(req, type, id) {
  const check = OWNERSHIP_CHECKS[type];
  if (!check) return null;
  return check(req, id);
}

// GET /api/<entity>/:id/documents — e.g. GET /api/projects/:id/documents
function listForType(type) {
  return async function list(req, res) {
    const owner = await assertOwnership(req, type, req.params.id);
    if (!owner) return res.status(404).json({ message: 'Not found.' });

    const documents = await Document.findAll({
      where: { brokerId: req.brokerId, documentableType: type, documentableId: owner.id },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: documents });
  };
}

// POST /api/<entity>/:id/documents (multipart/form-data, field "documents",
// up to 10 files at once) — e.g. POST /api/projects/:id/documents
function uploadForType(type) {
  return async function upload(req, res) {
    const owner = await assertOwnership(req, type, req.params.id);
    if (!owner) return res.status(404).json({ message: 'Not found.' });

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Select at least one file to upload.' });

    const created = await Document.bulkCreate(files.map((f) => ({
      brokerId: req.brokerId,
      documentableType: type,
      documentableId: owner.id,
      name: f.originalname,
      fileName: f.filename,
      url: `/uploads/documents/${f.filename}`,
      mimeType: f.mimetype,
      size: f.size,
      uploadedBy: req.user.id,
    })));

    const withUploader = await Document.findAll({
      where: { id: created.map((d) => d.id) },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.status(201).json({ data: withUploader });
  };
}

// DELETE /api/attachments/:id — generic across every documentableType, since
// each Document row already carries its own broker scope. Also removes the
// file from disk (best-effort — the DB row is the source of truth either way,
// so a stray file left behind on a filesystem error is harmless).
async function remove(req, res) {
  const doc = await Document.findOne({ where: { id: req.params.id, brokerId: req.brokerId } });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });

  const filePath = path.join(__dirname, '..', '..', 'uploads', 'documents', doc.fileName);
  fs.unlink(filePath, () => {});

  await doc.destroy();
  res.json({ message: 'Document removed.' });
}

module.exports = { listForType, uploadForType, remove };
