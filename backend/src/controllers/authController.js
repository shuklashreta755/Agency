const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const { normalizePhone } = require('../utils/phone');
const firebaseAdmin = require('../config/firebaseAdmin');
const { logActivity } = require('../utils/activityLogger');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitize(user) {
  return user.toJSON();
}

// POST /api/auth/firebase-login  { idToken }
// The frontend uses the Firebase Web SDK to send a real OTP over SMS and verify it
// client-side (this is what actually delivers the code to the user's phone — Firebase
// handles that end-to-end). Once verified, Firebase gives the browser a signed ID token
// proving ownership of that phone number; this endpoint verifies that token server-side
// with the Firebase Admin SDK and then maps the phone number to an account in our system.
async function firebaseLogin(req, res) {
  try {
    if (!firebaseAdmin) {
      return res.status(500).json({ message: 'Firebase Admin is not configured on the server. See backend/.env.example.' });
    }
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Missing Firebase ID token.' });

    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired verification. Please request a new OTP.' });
    }

    const phone = normalizePhone(decoded.phone_number);
    if (!phone) return res.status(400).json({ message: 'Could not read a valid phone number from the verification.' });

    const user = await User.findOne({ where: { phone, isActive: true } });
    if (!user) {
      return res.status(404).json({ message: 'Account not found. Please contact the broker.' });
    }

    await User.update({ status: 'online' }, { where: { id: user.id } });
    const token = signToken(user);
    res.json({ user: sanitize(user), token });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
}

// POST /api/auth/agents  (Broker creates an Agent account — no password, phone is the login credential)
async function createAgent(req, res) {
  try {
    const { name, phone: rawPhone, email, address, joiningDate } = req.body;
    if (!name || !rawPhone) {
      return res.status(400).json({ message: 'Name and phone number are required.' });
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) return res.status(400).json({ message: 'Please enter a valid phone number.' });

    const orClauses = [{ phone }];
    if (email) orClauses.push({ email });
    const existing = await User.findOne({ where: { [Op.or]: orClauses } });
    if (existing) {
      return res.status(409).json({
        message: existing.phone === phone
          ? 'An account with this phone number already exists.'
          : 'An account with this email already exists.',
      });
    }

    const agent = await User.create({
      name, phone, email: email || null, role: 'agent', brokerId: req.user.id,
      address: address || null, joiningDate: joiningDate || null,
    });

    await logActivity({
      brokerId: req.user.id, userId: req.user.id,
      action: `Created a new agent account for ${name}`, relatedType: 'User', relatedId: agent.id,
    });

    res.status(201).json({ user: sanitize(agent) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create agent.', error: err.message });
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: sanitize(req.user) });
}

module.exports = { firebaseLogin, createAgent, me };
