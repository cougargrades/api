import dotenv from 'dotenv';
import * as fs from 'fs';

// Setup
if (fs.existsSync('.env')) {
  console.debug('Using .env file to supply config environment variables');
  dotenv.config({ path: '.env' });
} else {
  console.debug(
    'Using .env.example file to supply config environment variables',
  );
}
export const ENVIRONMENT = process.env.NODE_ENV;
//const prod = ENVIRONMENT === 'production'; // Anything else is treated as 'dev'

// Secrets
export const GOOGLE_APPLICATION_CREDENTIALS =
  process.env['GOOGLE_APPLICATION_CREDENTIALS'];
export const FIREBASE_PROJECT_ID = JSON.parse(
  fs.readFileSync('.firebaserc', { encoding: 'utf-8' }),
)['projects']['default'];

// if (!SESSION_SECRET) {
//   console.error('No client secret. Set SESSION_SECRET environment variable.');
//   process.exit(1);
// }
