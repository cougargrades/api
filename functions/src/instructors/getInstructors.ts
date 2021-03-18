import * as functions from 'firebase-functions';
import { db } from '../_firebaseHelper';
import { useCache, useCors, zeroIfNaN } from '../_httpHelper';

export const getInstructors = functions.https.onRequest(async (request, response) => {
  useCors(response);
  useCache(response);

  const LIMIT_PER_PAGE = 25;

  const offset: number = zeroIfNaN(request.query.offset);
  let limit: number = zeroIfNaN(request.query.limit);
  if(limit === 0 || limit >= LIMIT_PER_PAGE) {
    limit = LIMIT_PER_PAGE;
  }

  const query = await db
    .collection('instructors')
    .orderBy('lastName')
    .orderBy('firstName')
    .offset(offset)
    .limit(limit)
    .get();

  response.json(query.docs.map(item => item.id));
});