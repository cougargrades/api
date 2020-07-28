import dotenv from 'dotenv';
import * as fs from 'fs';

// Identify whether or not we're on GCP
// See: https://cloud.google.com/functions/docs/env-var#nodejs_10_and_subsequent_runtimes
export const IS_HOSTED =
  Object.keys(process.env).includes('FUNCTION_TARGET') &&
  typeof process.env.FUNCTION_TARGET === 'string';

// Setup
if (fs.existsSync('.env')) {
  //console.debug('Using .env file to supply config environment variables');
  dotenv.config({ path: '.env' });
} else {
  //console.debug('Using .env.example file to supply config environment variables');
}
export const ENVIRONMENT = process.env.NODE_ENV;

// Secrets
export const GOOGLE_APPLICATION_CREDENTIALS = IS_HOSTED
  ? undefined
  : process.env['GOOGLE_APPLICATION_CREDENTIALS'];
if (IS_HOSTED) delete process.env['GOOGLE_APPLICATION_CREDENTIALS']; // prevent firebase SDK from using environment variable to source credentials

export const FIREBASE_PROJECT_ID = process.env['FIREBASE_PROJECT_ID'];
