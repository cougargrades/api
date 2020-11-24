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
): void {
  if (req.url.indexOf(`/${API_PREFIX}/`) === 0) {
    req.url = req.url.substring(API_PREFIX.length + 1);
  }
  next();
}

export async function authorization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> {
  // always allowed in local environments
  if (IS_HOSTED === false) return next();

  try {
    const access_token = req.get('X-Access-Token'); // retrieves the X-Access-Token header field
    const doc = firebase.firestore().collection('tokens').doc(access_token!);
    const snapshot = await doc.get();
    if (!snapshot.exists) {
      return res.sendStatus(401);
    } else {
      const token = snapshot.data() as Token.Token;
      // check if this token has (example) "update" permissions on /token
      if (
        Token.hasPermission(
          token,
          Token.HTTPMethodToOperation(
            req.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          ),
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

export function addCORSHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.set('Access-Control-Allow-Origin', '*');
  return next();
}
