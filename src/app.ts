import express from 'express';
import compression from 'compression'; // compresses requests
import bodyParser from 'body-parser';
//import { MONGODB_URI, SESSION_SECRET } from './util/secrets';

// Controllers (route handlers)
import * as homeController from './controllers/home';
import * as userController from './controllers/user';

// Create Express server
const app = express();

// Express configuration
app.set('port', process.env.PORT || 3000);
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/user', userController.getUser);
app.get('/user/secret', userController.getSecret);

export default app;
