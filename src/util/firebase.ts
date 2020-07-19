import * as admin from 'firebase-admin';
import { FIREBASE_PROJECT_ID } from '../util/secrets';
//import * as functions from 'firebase-functions';
//import 'firebase-functions';

const auth = {
  credential: admin.credential.applicationDefault(),
  projectId: FIREBASE_PROJECT_ID,
};

export default !admin.apps.length ? admin.initializeApp(auth) : admin.app();
