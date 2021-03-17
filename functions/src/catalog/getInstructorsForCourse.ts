import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { Course, Instructor, Util } from '@cougargrades/types';

export const getInstructorsForCourse = functions.https.onRequest(async (request, response) => {
  const doc = await db
    .collection('catalog')
    .doc(`${request.query.courseName}`)
    .get();
  
  if(doc.exists) {
    const data = doc.data() as Course;
    if(Util.isDocumentReferenceArray(data.instructors)) {
      const populated = await Util.populate<Instructor>(data.instructors);
      response.json(populated.map(item => Util.sanitizeInstructor(item)));
    }
    else {
      response.sendStatus(409);
    }
  }
  else {
    response.sendStatus(404);
  }
});