import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { Instructor, Util } from '@cougargrades/types';

export const getInstructorByName = functions.https.onRequest(async (request, response) => {
  const doc = await db
    .collection('instructors')
    .doc(`${request.query.instructorName}`)
    .get();

  if(doc.exists) {
    response.json(Util.sanitizeInstructor(doc.data() as Instructor));
  }
  else {
    response.sendStatus(404);
  }
});