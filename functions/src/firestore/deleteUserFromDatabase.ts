import * as functions from 'firebase-functions';
import { firebase } from '../_common';
const db = firebase.firestore();

export const deleteUserFromDatabase = functions
  .auth.user().onDelete(async (user) => {
    // establish a reference
    const userRef = db.collection('users').doc(user.uid);

    // commit change to database
    await db.runTransaction(async (txn) => {
      await txn.delete(userRef);
    })
  })