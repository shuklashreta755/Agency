const { User } = require('../models');

// PUT /api/settings/profile
// Phone number is the login identity and is intentionally not editable here.
// Brokers can update an agent's phone from the Agents page if it ever needs to change.
async function updateProfile(req, res) {
  const { name, email, avatarUrl } = req.body;
  await req.user.update({ name, email: email || null, avatarUrl });
  res.json({ data: req.user });
}

module.exports = { updateProfile };
