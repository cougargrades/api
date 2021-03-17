import * as functions from 'firebase-functions';
import { cors } from './_httpHelper';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest((request, response) => {
  // set CORS headers
  cors(response);
  // example code
  functions.logger.info('Hello logs!', {structuredData: true});
  response.send('Hello from Firebase!');
});
