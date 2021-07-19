import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { useCache, useCors } from '../_httpHelper';

export const getAllCourseNames = functions.https.onRequest(async (request, response) => {
  useCors(response);
  useCache(response);

  let docs = await db.collection('instructors').listDocuments()
    
  response.json(docs.map(item => item.id));
});