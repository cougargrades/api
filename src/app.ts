import express from 'express';
import { Request, Response } from 'express';
import compression from 'compression'; // compresses requests
import bodyParser from 'body-parser';
import { query, body } from 'express-validator';
import { getRoutes } from 'get-routes';
import { is } from 'typescript-is';
import {
  rewriteFirebaseHosting,
  authorization,
  addCORSHeaders,
} from './util/middleware';
import * as sanitizer from './util/sanitizer';

// Controllers (route handlers)
import * as helloController from './controllers/hello';
import * as catalogController from './controllers/catalog';
import * as instructorController from './controllers/instructors';
import * as privateController from './controllers/private';
import { GradeDistributionCSVRow } from '@cougargrades/types/dist/GradeDistributionCSVRow';
import { Patchfile } from '@cougargrades/types/dist/Patchfile';

// Create Express server
const app = express();

// Express configuration
app.set('port', process.env.PORT || 3000);
app.use(rewriteFirebaseHosting);
app.use(addCORSHeaders);
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Primary app routes.
 */
app.get('/hello', helloController.world);
app.get(
  '/catalog',
  [
    query('limit')
      .isInt()
      .customSanitizer((x) => sanitizer.integer(x, 10, 0, 100)),
    query('offset')
      .isInt()
      .customSanitizer((x) => sanitizer.integer(x, 0, 0)),
  ],
  catalogController.getCourses,
);
app.get('/catalog/:courseName', catalogController.getCourseByName);
app.get(
  '/catalog/:courseName/sections',
  catalogController.getSectionsForCourse,
);
app.get(
  '/catalog/:courseName/instructors',
  catalogController.getInstructorsForCourse,
);
app.get(
  '/instructors',
  [
    query('limit')
      .isInt()
      .customSanitizer((x) => sanitizer.integer(x, 10, 0, 100)),
    query('offset')
      .isInt()
      .customSanitizer((x) => sanitizer.integer(x, 0, 0)),
  ],
  instructorController.getInstructors,
);
app.get(
  '/instructors/:instructorName',
  instructorController.getInstructorByName,
);

app.use('/private/*', authorization);
app.get('/private/hello', helloController.world);
app.put(
  '/private/GradeDistributionCSVRow',
  [
    body().custom((value) => is<GradeDistributionCSVRow>(value)), // checks if what was submitted conforms to TypeScript interface
  ],
  privateController.uploadRecord,
);
app.post(
  '/private/Patchfile',
  [
    body().custom((value) => is<Patchfile>(value)), // checks if what was submitted conforms to TypeScript interface
  ],
  privateController.uploadPatchFile,
);
app.post('/private/upload_queue_backlog', privateController.processBacklog);
app.get('/private/tokens/self', privateController.getSelfToken);

app.get('/', (req: Request, res: Response) => res.json(getRoutes(app)));

export default app;
