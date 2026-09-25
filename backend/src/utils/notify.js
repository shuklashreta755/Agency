const { Notification } = require('../models');

/**
 * Notifies the broker that an agent performed an action. Informational only —
 * NEVER include a link here; broker notifications must not redirect anywhere.
 * No-op if the actor isn't actually an agent (brokers don't need to be notified
 * about their own actions).
 */
async function notifyBrokerOfAgentAction(req, { title, message }) {
  if (req.user.role !== 'agent') return;
  try {
    const notification = await Notification.create({ userId: req.brokerId, title, message, link: null });
    const io = req.app.get('io');
    if (io) io.to(`user:${req.brokerId}`).emit('notification:new', notification);
  } catch (err) {
    console.error('Failed to create broker notification:', err.message);
  }
}

/**
 * Notifies an agent of something the broker did (lead assignment, project
 * assignment, etc). `link` is a frontend path the agent gets taken to on click.
 * Pushed both as a persisted Notification row and, if a socket is connected,
 * as a real-time `notification:new` event straight to that agent.
 */
async function notifyAgent(req, agentId, { title, message, link }) {
  try {
    const notification = await Notification.create({ userId: agentId, title, message, link: link || null });
    const io = req.app.get('io');
    if (io) io.to(`user:${agentId}`).emit('notification:new', notification);
  } catch (err) {
    console.error('Failed to create agent notification:', err.message);
  }
}

module.exports = { notifyBrokerOfAgentAction, notifyAgent };
