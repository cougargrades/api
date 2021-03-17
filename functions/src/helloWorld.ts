import * as functions from 'firebase-functions';
import { db } from './_common';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info('Hello logs!', {structuredData: true});
//   response.send('Hello from Firebase!');
// });

export const helloWorld = functions.https.onRequest(async (request, response) => {
  // This works in the emulator!
  const docSnap = await db
    .collection('catalog')
    .doc('COSC 2440')
    .get();
  console.log(docSnap);

  // Testing write permissions
  const testDocRef = db.collection('scientists').doc('testDoc');
  await testDocRef.set({
    hello: 'world',
    now: new Date()
  });
  
  // This function must return void, so just do this
  response.send('Hello from Firebase!');
});