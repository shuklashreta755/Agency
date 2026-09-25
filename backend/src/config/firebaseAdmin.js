const admin = require('firebase-admin');

// Initialize once. Supports two ways to supply credentials:
//  1. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars
//     (copied from the service account JSON — see backend/.env.example)
//  2. GOOGLE_APPLICATION_CREDENTIALS pointing at the service account JSON file path
if (!admin.apps.length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // .env files can't hold real newlines, so the key is stored with literal "\n"
        // sequences and unescaped here.
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    console.warn(
      '⚠ Firebase Admin is not configured — phone login will fail. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend/.env ' +
      '(see backend/.env.example for where to get them).'
    );
  }
}

module.exports = admin.apps.length ? admin : null;
