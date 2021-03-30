import * as functions from 'firebase-functions';
import { firebase, db } from '../_firebaseHelper';
import { User } from '@cougargrades/types';

/**
 * This creates a database reference for a user when they login for the first time.
 */
export const saveUserToDatabase = functions
  .auth.user().onCreate(async (user) => {
    // establish a reference
    const userRef = db.collection('users').doc(user.uid);

    // draft the new user's data
    // we confirmed that this information was accessible when specifying Google OAuth2 scopes
    let userData: User = {
      displayName: user.displayName ?? user.uid, 
      email: user.email ?? `${user.uid}@users.cougargrades.io`,
      photoURL: user.photoURL ?? `https://avatars.dicebear.com/api/identicon/${user.uid}.svg`,
      uid: user.uid,
      custom_claims: {
        admin: false
      }
    };

    // commit change to database
    await db.runTransaction(async (txn) => {
      await txn.set(userRef, userData);
    })

    // send back custom claims
    await firebase.auth().setCustomUserClaims(user.uid, userData.custom_claims);
  });
