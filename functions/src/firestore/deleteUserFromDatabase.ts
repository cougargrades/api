import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';

/**
 * This deletes the previously created database reference for a user when they delete their account.
 * 
 * I'm not actually sure when this would fire. Maybe if Google terminates their account or with GDPR stuff?
 * 
 * Either way, I'm pretty sure it was on the Google Auth example code in the Firebase SDK documentation.
 */
export const deleteUserFromDatabase = functions
  .auth.user().onDelete(async (user) => {
    // establish a reference
    const userRef = db.collection('users').doc(user.uid);

    // commit change to database
    await db.runTransaction(async (txn) => {
      await txn.delete(userRef);
    })
  })