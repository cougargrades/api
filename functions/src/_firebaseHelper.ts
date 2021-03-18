import * as admin from 'firebase-admin';

// This works without extra work doing authentication for some reason which is cool
export const firebase = !admin.apps.length ? admin.initializeApp() : admin.app();

// Configure a Firestore DB object that is preconfigured and from the "correct" instance (maybe?)
const _db = firebase.firestore();
_db.settings({ ignoreUndefinedProperties: true });
export const db = _db;
