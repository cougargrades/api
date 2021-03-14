import * as functions from 'firebase-functions';
import { firebase } from '../_common';
import { User } from '@cougargrades/types';

const db = firebase.firestore();

export const saveUserToDatabase = functions
  .auth.user().onCreate(async (user) => {
    // establish a reference
    const userRef = db.collection('users').doc(user.uid);

    // draft the new user's data
    // we confirmed that this information was accessible when specifying Google OAuth2 scopes
    let userData: User = {
      displayName: user.displayName!, 
      email: user.email!,
      photoURL: user.photoURL!,
      uid: user.uid,
      unlimited_access: false
    };

    // commit change to database
    await db.runTransaction(async (txn) => {
      await txn.set(userRef, userData);
    })
  });