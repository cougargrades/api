import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { Course, Util } from '@cougargrades/types';

export const getCourseByName = functions.https.onRequest(async (request, response) => {
  const doc = await db
    .collection('catalog')
    .doc(`${request.query.courseName}`)
    .get();

  if(doc.exists) {
    response.json(Util.sanitizeCourse(doc.data() as Course));
  }
  else {
    response.sendStatus(404);
  }
});
