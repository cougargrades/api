import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { zeroIfNaN } from '../_httpHelper';

export const getCourses = functions.https.onRequest(async (request, response) => {
  const LIMIT_PER_PAGE = 25;

  const offset: number = zeroIfNaN(request.query.offset);
  let limit: number = zeroIfNaN(request.query.limit);
  if(limit === 0 || limit >= LIMIT_PER_PAGE) {
    limit = LIMIT_PER_PAGE;
  }

  const query = await db
    .collection('catalog')
    .orderBy('department')
    .orderBy('catalogNumber')
    .offset(offset)
    .limit(limit)
    .get();
    
  response.json(query.docs.map(item => item.id));
});