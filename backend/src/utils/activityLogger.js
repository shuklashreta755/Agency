const { ActivityHistory } = require('../models');

/**
 * Records an entry in the activity/audit trail.
 * @param {object} opts
 * @param {string} opts.brokerId - the broker this activity belongs to (tenant scope)
 * @param {string} opts.userId - who performed the action
 * @param {string} opts.action - human-readable description, e.g. "Updated lead status to Site Visit"
 * @param {string} [opts.relatedType] - e.g. 'Lead', 'Property', 'Meeting'
 * @param {string} [opts.relatedId]
 */
async function logActivity({ brokerId, userId, action, relatedType, relatedId }) {
  try {
    await ActivityHistory.create({ brokerId, userId, action, relatedType, relatedId });
  } catch (err) {
    // Logging must never break the main request flow
    console.error('Activity log failed:', err.message);
  }
}

module.exports = { logActivity };
