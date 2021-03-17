import * as admin from 'firebase-admin';

// This works without extra work doing authentication for some reason which is cool
export const firebase = !admin.apps.length ? admin.initializeApp() : admin.app();

const _db = firebase.firestore();
_db.settings({ ignoreUndefinedProperties: true });
export const db = _db;