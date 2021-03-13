import * as functions from "firebase-functions";

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export * as groupA from './groupA';
export * as firestore from './firestore';

// Export examples
// export { Course, PublicationInfo } from './Course';
// export { default as User } from './User';
// export * as GradeDistributionCSVRow from './GradeDistributionCSVRow';