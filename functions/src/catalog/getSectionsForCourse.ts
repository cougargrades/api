import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { Course, Section, Util } from '@cougargrades/types';

export const getSectionsForCourse = functions.https.onRequest(async (request, response) => {
  const doc = await db
    .collection('catalog')
    .doc(`${request.query.courseName}`)
    .get();

  if(doc.exists) {
    const data = doc.data() as Course;
    if(Util.isDocumentReferenceArray(data.sections)) {
      const populated = await Util.populate<Section>(data.sections);
      response.json(populated.map(item => Util.sanitizeSection(item)));
    }
    else {
      response.sendStatus(409);
    }
  }
  else {
    response.sendStatus(404);
  }
});