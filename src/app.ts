import express from 'express';
import { Request, Response } from 'express';
import compression from 'compression'; // compresses requests
import bodyParser from 'body-parser';
import { query } from 'express-validator';
import { getRoutes } from 'get-routes';
import { rewriteFirebaseHosting } from './util/middleware';
import * as sanitizer from './util/sanitizer';

// Controllers (route handlers)
import * as helloController from './controllers/hello';
import * as catalogController from './controllers/catalog';
import * as instructorController from './controllers/instructors';

// Create Express server
const app = express();

// Express configuration
app.set('port', process.env.PORT || 3000);
app.use(rewriteFirebaseHosting);
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
app.get('/', (req: Request, res: Response) => res.json(getRoutes(app)));

export default app;
