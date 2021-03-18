import * as functions from 'firebase-functions';
import { useCors } from './_httpHelper';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest((request, response) => {
  // set CORS headers
  useCors(response);
  // example code
  functions.logger.info('Hello logs!', {structuredData: true});
  response.send('Hello from Firebase!');
});
