import * as functions from 'firebase-functions'
import { firebase } from '../_firebaseHelper';
import { User } from '@cougargrades/types';
import { is } from 'typescript-is';



export const propagateCustomClaims = functions
  .firestore.document('users/{qid}')
  .onUpdate(async (change, context) => {
    // get updated data
    const userData = change.after.data();

    // confirm snapshot data has the types we're anticipating
    if(is<User>(userData)) {

      // send back updated custom claims
      await firebase.auth().setCustomUserClaims(userData.uid, userData.custom_claims);
    }    
  });
