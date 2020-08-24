import { Request, Response, NextFunction } from 'express';
import firebase from './firebase';
import { Token } from '@cougargrades/types';
import { IS_HOSTED } from './secrets';

export const API_PREFIX = 'api';

// Rewrite Firebase hosting requests: /api/:path => /:path
// see: https://stackoverflow.com/a/49216233
export function rewriteFirebaseHosting(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.url.indexOf(`/${API_PREFIX}/`) === 0) {
    req.url = req.url.substring(API_PREFIX.length + 1);
  }
  next();
}

export async function authorization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // always allowed in local environments
  if (IS_HOSTED === false) return next();

  try {
    let access_token = req.get('X-Access-Token'); // retrieves the X-Access-Token header field
    let doc = firebase.firestore().collection('tokens').doc(access_token!);
    let snapshot = await doc.get();
    if (!snapshot.exists) {
      return res.sendStatus(403);
    } else {
      let temp = snapshot.data() as Token;
      let token = new Token(
        temp.application,
        temp.bearer,
        temp.permissions,
        temp.createdDate,
      );
      // check if this token has (example) "update" permissions on /token
      if (
        token.hasPermission(
          token.operation(req.method as 'GET' | 'POST' | 'PUT' | 'DELETE'),
          req.path,
        )
      ) {
        // carry token information to the requested endpoint
        res.locals.token = token;
        return next();
      } else {
        return res.sendStatus(403);
      }
    }
  } catch (err) {
    return res.sendStatus(403);
  }
}
