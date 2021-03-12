import * as functions from 'firebase-functions';
//import errorHandler from 'errorhandler';
import app from './app';

/**
 * Error Handler. Provides full stack - remove for production
 */
//app.use(errorHandler());
export const api = functions
  .runWith({ memory: '256MB', timeoutSeconds: 120 })
  .https.onRequest(app);

export { 
  whenUploadQueueAdded,
  saveUserToDatabase,
  deleteUserFromDatabase,
} from './triggers';
